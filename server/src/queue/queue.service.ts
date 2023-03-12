import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { SelectType, sql, UpdateKeys, UpdateObject, UpdateType } from 'kysely';
// import path from 'path';
const path = require('path')

import { batch, PublicSchema, queueItem, worker } from 'src/database/database.schema';
import { DatabaseService } from 'src/database/database.service';
import { DatabricksService } from 'src/external/databricks.service';

interface LockNextItem {
  lockedBy?: SelectType<queueItem['lockedBy']>
}

interface CompleteItem {
  id: number
  matchedCount: queueItem['matchedCount']
}

interface QueueEvent {
  event: 'LOCK_ITEM' | 'COMPLETED' | 'EMPTY_QUEUE' | 'CLEAERED_STALE_LOCKS' | 'NO_FREE_WORKERS' | 'RELEASE_ITEM' | 'GET_ITEM'
  queueItem?: any
}

const LOCK_TIMEOUT_MINUTES = 20
const QUEUE_BEAT_SECONDS = 15
const WORKER_CONCURRENCY = 1

@Injectable()
export class QueueService {
  constructor(
    private config: ConfigService,
    private db: DatabaseService,
    private databricks: DatabricksService
  ) {
    this.queueUrl = this.config.getOrThrow<string>('QUEUE_URL')
  }

  private readonly logger = new Logger(QueueService.name);
  private queueUrl: string

  private emitEvent(event: QueueEvent) { this.logger.log(JSON.stringify(event)) }

  @Interval(1000 * QUEUE_BEAT_SECONDS)
  async queueBeat() {
    const activity = await this.workerActivity()
    const nextAvailableWorkerName = activity.filter(a => a.activeItems < WORKER_CONCURRENCY)?.[0]?.name
    if (!nextAvailableWorkerName) {
      // this.emitEvent({ event: 'NO_FREE_WORKERS' })
    } else {
      const lockedNextItem = await this.invokeWorkerOnNext(nextAvailableWorkerName)
    }
  }

  async workerActivity() {
    return await this.db.selectFrom('worker')
      .where('worker.active', 'is', true)
      .select('worker.name')
      .select((qb) => qb.selectFrom('queueItem')
        .whereRef('queueItem.lockedBy', '=', 'worker.name')
        .select(sql<number>`count(*)`.as('activeItems'))
        .as('activeItems')
      )
      .execute()
  }

  async invokeWorkerOnNext(workerName: worker['name']) {
    const invokedQueueItem = await this.db.transaction().execute(async trx => {
      const preLockNextItem = await trx.selectFrom('queueItem')
        .where('completedAt', 'is', null)
        .where('lockedAt', 'is', null)
        .select('id')
        .orderBy('queueItem.expectedCount', 'desc')
        .executeTakeFirst()

      if (!preLockNextItem) {
        this.emitEvent({ event: 'EMPTY_QUEUE' })
        return undefined
      }

      const item = await trx.updateTable('queueItem')
        .where('queueItem.id', '=', preLockNextItem.id)
        .set({ lockedAt: sql`current_timestamp`, lockedBy: workerName })
        .returningAll()
        .executeTakeFirstOrThrow()

      const worker = await trx.selectFrom('worker')
        .where('worker.name', '=', workerName)
        .select(['worker.triggerUrl', 'worker.name'])
        .executeTakeFirstOrThrow()

      const invocation = await fetch(worker.triggerUrl as string, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "queueItemId": item.id, "queueUrl": this.queueUrl, "workerName": worker.name })
      })
      if (invocation.status >= 400) {
        throw Error(`Worker invocation failed: ${await invocation.text()}`)
      }
      this.emitEvent({ event: 'LOCK_ITEM', queueItem: item })
      return item
    })
  }

  async getItem(id: SelectType<queueItem['id']>) {
    const queueItem = await this.db.selectFrom('queueItem')
      .where('queueItem.id', '=', id)
      .selectAll()
      .executeTakeFirstOrThrow()
    this.emitEvent({ event: 'GET_ITEM', queueItem })
    return queueItem
  }

  async completeitem({ id, matchedCount }: CompleteItem) {
    const completed = await this.db.updateTable('queueItem')
      .where('id', '=', id)
      .set({ completedAt: sql`current_timestamp`, matchedCount, lockedAt: null, lockedBy: null })
      .returningAll()
      .executeTakeFirstOrThrow()

    this.emitEvent({ event: 'COMPLETED', queueItem: completed })
    return completed
  }

  async releaseItem(id: UpdateType<queueItem['id']>) {
    const releasedItem = await this.db.updateTable('queueItem')
      .where('queueItem.id', '=', id)
      .set({ lockedAt: null, lockedBy: null })
      .returningAll()
      .executeTakeFirstOrThrow()

    this.emitEvent({ event: 'RELEASE_ITEM', queueItem: releasedItem })
    return releasedItem
  }

  async loadBatchExpected(batchId: SelectType<batch['id']>) {
    const items = await this.db.selectFrom('queueItem')
      .where('queueItem.batchId', '=', batchId)
      .select(['batchId', 'site', 'uid'])
      .execute()
    const secondaryIds = items.map(i => `'${i.uid}'`).join(', ')

    const query = `
      select
        demo.Site as site
        ,demo.SecondaryId as uid
        ,count(*) as expectedCount
      from
        (
          select * from cardiology_analytics.raw_muse_hup.tsttestdemographics
          union all select * from cardiology_analytics.raw_muse_pah.tsttestdemographics
          union all select * from cardiology_analytics.raw_muse_ppmc.tsttestdemographics
        ) demo
      where
        demo.SecondaryId in (${secondaryIds})
        group by demo.Site, demo.SecondaryId
    `
    const expectedCounts: any = await this.databricks.query(query)
    console.debug(expectedCounts)

    for (const item of items) {
      const expectedCount = expectedCounts.find(e => e.site == item.site && e.uid == item.uid)?.expectedCount ?? 0
      await this.db.updateTable('queueItem')
        .where('queueItem.batchId', '=', item.batchId)
        .where('queueItem.site', '=', item.site)
        .where('queueItem.uid', '=', item.uid)
        .set({ expectedCount })
        .execute()
    }
  }

  /**
   * Clear queue locks that appear to be stale based on LOCK_TIMEOUT
   */
  @Interval(1000 * 60)
  async clearStaleLocks() {
    const cleared = await this.db.transaction().execute(async trx => {
      return await this.db.updateTable('queueItem')
        .where('completedAt', 'is', null)
        .where('lockedAt', '<', sql`(current_timestamp - interval '${sql.raw(LOCK_TIMEOUT_MINUTES.toString())} minutes')`)
        .set({ lockedAt: null, lockedBy: null })
        .returningAll()
        .execute()
    })

    if (cleared.length > 0) {
      this.emitEvent({ event: 'CLEAERED_STALE_LOCKS', queueItem: cleared })
    }
    return cleared
  }
}

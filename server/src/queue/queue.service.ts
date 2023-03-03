import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SelectType, sql, UpdateKeys, UpdateType } from 'kysely';

import { queueItem, worker } from 'src/database/database.schema';
import { DatabaseService } from 'src/database/database.service';

interface LockNextItem {
  lockedBy?: SelectType<queueItem['lockedBy']>
}

interface CompleteItem {
  id: number
  matchedCount: queueItem['matchedCount']
}

interface QueueEvent {
  event: 'LOCK_ITEM' | 'COMPLETED' | 'EMPTY_QUEUE' | 'CLEAERED_STALE_LOCKS' | 'NO_FREE_WORKERS'
  queueItem?: any
}

const LOCK_TIMEOUT_MINUTES = 15
const QUEUE_BEAT_SECONDS = 30
const WORKER_CONCURRENCY = 1

@Injectable()
export class QueueService {
  constructor(
    private db: DatabaseService
  ) { }

  private readonly logger = new Logger(QueueService.name);

  private emitEvent(event: QueueEvent) { this.logger.log(JSON.stringify(event)) }

  @Interval(1000 * QUEUE_BEAT_SECONDS)
  async queueBeat() {
    const activity = await this.workerActivity()
    const nextAvailableWorkerName = activity.filter(a => a.activeItems < WORKER_CONCURRENCY)?.[0]?.name
    if (!nextAvailableWorkerName) {
      this.emitEvent({ event: 'NO_FREE_WORKERS' })
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
        .select('worker.triggerUrl')
        .executeTakeFirstOrThrow()

      const invocation = await fetch(worker.triggerUrl as string, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "queueItemId": item.id })
      })
      this.emitEvent({ event: 'LOCK_ITEM', queueItem: item })
      return item
    })
  }

  async getItem(id: SelectType<queueItem['id']>) {
    return this.db.selectFrom('queueItem')
      .where('queueItem.id', '=', id)
      .selectAll()
      .executeTakeFirstOrThrow()
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

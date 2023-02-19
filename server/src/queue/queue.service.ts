import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql, UpdateKeys, UpdateType } from 'kysely';

import { queueItem } from 'src/database/database.schema';
import { DatabaseService } from 'src/database/database.service';

interface LockNextItem {
  lockedBy?: queueItem['lockedBy']
}

interface CompleteItem {
  id: number
  matchedCount: queueItem['matchedCount']
}

interface QueueEvent {
  event: 'LOCK_ITEM' | 'COMPLETED' | 'EMPTY_QUEUE' | 'CLEAERED_STALE_LOCKS'
  queueItem?: any
}

const LOCK_TIMEOUT_MINUTES = 15

@Injectable()
export class QueueService {
  constructor(
    private db: DatabaseService
  ) { }

  private readonly logger = new Logger(QueueService.name);

  private emitEvent(event: QueueEvent) { this.logger.log(JSON.stringify(event)) }

  async lockNextItem({ lockedBy }: LockNextItem) {
    const lockedNextItem = await this.db.get().transaction().execute(async trx => {
      const preLockNextItem = await trx.selectFrom('queueItem')
        .where('completedAt', 'is', null)
        .where('lockedAt', 'is', null)
        .select('id')
        .executeTakeFirst()

      if (!preLockNextItem) {
        this.emitEvent({ event: 'EMPTY_QUEUE' })
        return undefined
      }

      const locked = await trx.updateTable('queueItem')
        .where('queueItem.id', '=', preLockNextItem.id)
        .set({ lockedAt: sql`current_timestamp`, lockedBy })
        .returningAll()
        .executeTakeFirst()

      this.emitEvent({ event: 'LOCK_ITEM', queueItem: locked })
      return locked
    })

    return lockedNextItem
  }

  async completeitem({ id, matchedCount }: CompleteItem) {
    const completed = await this.db.get().updateTable('queueItem')
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
    const cleared = await this.db.get().transaction().execute(async trx => {
      return await this.db.get().updateTable('queueItem')
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

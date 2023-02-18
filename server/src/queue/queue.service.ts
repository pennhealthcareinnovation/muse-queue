import { Injectable } from '@nestjs/common';
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

const LOCK_TIMEOUT_MINUTES = 15

@Injectable()
export class QueueService {
  constructor(
    private db: DatabaseService
  ) { }

  async lockNextItem({ lockedBy }: LockNextItem) {
    const lockedNextItem = await this.db.get().transaction().execute(async trx => {
      const preLockNextItem = await trx.selectFrom('queueItem')
        .where('completedAt', 'is', null)
        .where('lockedAt', 'is', null)
        .select('id')
        .executeTakeFirst()

      if (!preLockNextItem) {
        return undefined
      }

      return await trx.updateTable('queueItem')
        .where('queueItem.id', '=', preLockNextItem.id)
        .set({ lockedAt: sql`current_timestamp`, lockedBy })
        .returningAll()
        .executeTakeFirst()
    })

    return lockedNextItem
  }

  async completeitem({ id, matchedCount }: CompleteItem) {
    return await this.db.get().updateTable('queueItem')
      .where('id', '=', id)
      .set({ completedAt: sql`current_timestamp`, matchedCount, lockedAt: null, lockedBy: null })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  /**
   * Clear queue locks that appear to be stale based on LOCK_TIMEOUT
   */
  async clearStaleLocks() {
    const cleared = await this.db.get().updateTable('queueItem')
      .where('completedAt', 'is', null)
      .where('lockedAt', '<', sql`(current_timestamp - interval '${sql.raw(LOCK_TIMEOUT_MINUTES.toString())} minutes')`)
      .set({ lockedAt: null, lockedBy: null })
      .returningAll()
      .execute()

    return cleared
  }
}

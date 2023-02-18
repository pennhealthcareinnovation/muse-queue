import { Kysely } from "kysely";

import { PublicSchema } from "../src/database/database.schema";

export async function seed(db: Kysely<PublicSchema>) {
  /** flush old */
  await db.deleteFrom('queueItem').execute()
  await db.deleteFrom('batch').execute()

  /** create new */
  const { id: batchId } = await db
    .insertInto('batch')
    .values({ description: 'Test export.' })
    .returning('batch.id')
    .executeTakeFirst()

  await db
    .insertInto('queueItem')
    .values([
      { batchId, uid: '12345678', site: '5' },
      { batchId, uid: '22222222', site: '5' },
    ])
    .execute()
}
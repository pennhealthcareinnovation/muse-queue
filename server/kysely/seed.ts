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

  await db
    .insertInto('worker')
    .values([
      { name: 'MJ0BXFY3', triggerUrl: 'https://prod-108.westus.logic.azure.com:443/workflows/0bc7a4ad1f9c436c85101b753ab7ff45/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Oc_bHl-h3XAFiHI-eQVKyFPYJXJ7nmpIsOaMpVIctGo', active: true, pendingStart: false },
      { name: 'WORKER2', triggerUrl: 'URL_HERE', active: true, pendingStart: false }
    ])
    .execute()
}
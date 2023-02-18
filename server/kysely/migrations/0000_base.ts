import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('batch')
    .addColumn('id', 'serial', (col) => col.notNull().primaryKey().unique())
    .addColumn('description', 'varchar(255)')
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('queueItem')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    .addColumn('batchId', 'integer', (col) => col.notNull().references('batch.id').onDelete('cascade'))
    .addColumn('uid', 'varchar(255)', (col) => col.notNull())
    .addColumn('site', 'integer', (col) => col.notNull())

    .addColumn('expectedCount', 'integer')

    .addColumn('lockedAt', 'timestamp')
    .addColumn('lockedBy', 'varchar(255)')

    .addColumn('completedAt', 'timestamp')
    .addColumn('matchedCount', 'integer')

    .addColumn('confirmedCount', 'integer')

    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint('batch_uid_site', ['batchId', 'uid', 'site'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('batch').ifExists().execute()
  await db.schema.dropTable('queueItem').ifExists().execute()
}
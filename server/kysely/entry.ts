import * as path from 'path'
import { Pool, PoolConfig } from 'pg'
import { promises as fs } from 'fs'
import {
  Kysely,
  Migrator,
  PostgresDialect,
  FileMigrationProvider
} from 'kysely'
import * as dotenv from 'dotenv'

import { PublicSchema } from '../src/database/database.schema'
import { seed } from './seed'


// load database connection parameters from environment
dotenv.config({ path: path.join(__dirname, '../../.env') })
const {
  POSTGRES_HOST: host,
  POSTGRES_DB: database,
  POSTGRES_USER: user,
  POSTGRES_PASSWORD: password
} = process.env
const POOL_CONFIG: PoolConfig = { host, database, user, password, ssl: { rejectUnauthorized: false } }
if (!POOL_CONFIG.host || !POOL_CONFIG.database || !POOL_CONFIG.user || !POOL_CONFIG.password) {
  throw Error(`Unable to load database parameters!`)
}

const migrateToLatest = async (migrator: Migrator) => {
  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }
}

const down = async (migrator: Migrator) => {
  const { error, results } = await migrator.migrateDown()
  console.debug(results)

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }
}

const main = async () => {
  const db = new Kysely<PublicSchema>({
    dialect: new PostgresDialect({ pool: new Pool(POOL_CONFIG) }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.join(__dirname, 'migrations') })
  })

  const mode = process.argv[2]
  switch (mode) {
    case 'latest': await migrateToLatest(migrator); break;
    case 'down': await down(migrator); break;
    case 'seed': await migrateToLatest(migrator); await seed(db); break;
  }
  await db.destroy()
}

main()
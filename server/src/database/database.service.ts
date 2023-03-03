import { BeforeApplicationShutdown, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg'

import { PublicSchema } from './database.schema'

@Injectable()
export class DatabaseService extends Kysely<PublicSchema> implements BeforeApplicationShutdown {
  private kysely: Kysely<PublicSchema>

  constructor(
    private config: ConfigService,
  ) {
    super({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: config.getOrThrow('POSTGRES_HOST'),
          database: config.getOrThrow('POSTGRES_DB'),
          user: config.getOrThrow('POSTGRES_USER'),
          password: config.getOrThrow('POSTGRES_PASSWORD')
        })
      })
    })
  }

  async beforeApplicationShutdown(signal?: string | undefined) {
    await this.destroy()
  }
}

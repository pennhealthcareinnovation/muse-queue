import { BeforeApplicationShutdown, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg'

import { PublicSchema } from './database.schema'

@Injectable()
export class DatabaseService implements OnModuleInit, BeforeApplicationShutdown {
  private kysely: Kysely<PublicSchema>

  constructor(
    private config: ConfigService,
  ) { }

  async onModuleInit() {
    this.kysely = new Kysely<PublicSchema>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: this.config.getOrThrow('POSTGRES_HOST'),
          database: this.config.getOrThrow('POSTGRES_DB'),
          user: this.config.getOrThrow('POSTGRES_USER'),
          password: this.config.getOrThrow('POSTGRES_PASSWORD')
        })
      })
    })
  }

  async beforeApplicationShutdown(signal?: string | undefined) {
    await this.kysely.destroy()
  }

  get<Schema = PublicSchema>() {
    return this.kysely as unknown as Kysely<Schema>
  }
}

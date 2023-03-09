import { DBSQLClient, LogLevel } from '@databricks/sql';
import { ConnectionOptions } from '@databricks/sql/dist/contracts/IDBSQLClient';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PathLike, readFileSync } from 'fs';

@Injectable()
export class DatabricksService {
  private readonly logger = new Logger(DatabricksService.name)
  private client: DBSQLClient
  private connectionConfig: ConnectionOptions

  constructor(
    private config: ConfigService
  ) {
    this.client = new DBSQLClient({
      logger: {
        log: (level: LogLevel, message: string) => {
          switch (level) {
            case 'warn': this.logger.warn(message); break;
            case 'error': this.logger.error(message); break;
            case 'debug': this.logger.debug(message); break;
            case 'info': this.logger.log(message); break;
            default: this.logger.log(message); break;
          }
        }
      }
    })

    this.connectionConfig = {
      token: this.config.getOrThrow('DATABRICKS_TOKEN'),
      host: this.config.getOrThrow('DATABRICKS_HOSTNAME'),
      path: this.config.getOrThrow('DATABRICKS_HTTP_PATH'),
    }
  }

  private async connect() {
    await this.client.connect(this.connectionConfig)
  }

  async query(queryString: string) {
    try {
      await this.connect()
      const session = await this.client.openSession()
      const queryOperation = await session.executeStatement(queryString,
        { runAsync: true, maxRows: 10000 }
      )
      const result = await queryOperation.fetchAll({
        progress: false,
        callback: () => { },
      });
      await queryOperation.close();
      await session.close();
      this.client.close();
      return result

    } catch (e) {
      console.error(e)
      throw Error(e.message)
    }
  }
}

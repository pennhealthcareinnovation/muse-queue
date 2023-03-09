import { Global, Module } from '@nestjs/common';
import { DatabricksService } from './databricks.service';

@Global()
@Module({
  providers: [DatabricksService],
  exports: [DatabricksService]
})
export class ExternalModule { }

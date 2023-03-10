import { Body, Controller, Get, HttpException, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiParam, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { queueItem } from 'src/database/database.schema';

import { DatabaseService } from 'src/database/database.service';
import { QueueService } from './queue.service';

class CompletedItemDto { @ApiProperty() matchedCount: number }

@ApiTags('Queue')
@Controller('/api/queue')
export class QueueController {
  constructor(
    private queueService: QueueService
  ) { }

  @Get('/:id')
  async get(
    @Param('id') id: number
  ) {
    return await this.queueService.getItem(id)
  }

  @Patch('/:id/complete')
  async complete(
    @Param('id') id: number,
    @Body() completedItem: CompletedItemDto
  ) {
    return await this.queueService.completeitem({ id, matchedCount: completedItem.matchedCount })
  }

  @Patch('/:id/release')
  async release(
    @Param('id') id: number,
  ) {
    return await this.queueService.releaseItem(id)
  }

  @Get('clearStaleLocks')
  async clearStaleLocks() {
    return await this.queueService.clearStaleLocks()
  }

  @Post('loadBatchExpected/:batchId')
  async loadBatchExpected(
    @Param('batchId') batchId: number
  ) {
    return await this.queueService.loadBatchExpected(batchId)
  }

  @Post('invokeWorker/:workerName')
  async invokeWorker(
    @Param('workerName') workerName: string
  ) {
    return await this.queueService.invokeWorkerOnNext(workerName)
  }
}

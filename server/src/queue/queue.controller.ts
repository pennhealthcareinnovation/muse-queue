import { Body, Controller, Get, HttpException, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiParam, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { queueItem } from 'src/database/database.schema';

import { DatabaseService } from 'src/database/database.service';
import { QueueService } from './queue.service';

class CompletedItemDto {
  @ApiProperty() matchedCount: number
}

@ApiTags('Queue')
@Controller('/api/queue')
export class QueueController {
  constructor(
    private queueService: QueueService
  ) { }

  @Get('nextLock')
  @ApiQuery({ name: 'lockedBy', required: false })
  async nextLock(
    @Query('lockedBy') lockedBy?: string
  ) {
    const nextItem = await this.queueService.lockNextItem({ lockedBy })
    if (nextItem) {
      return nextItem
    } else {
      throw new HttpException('No remaining items to take!', HttpStatus.NO_CONTENT)
    }
  }

  @Patch('/:id/complete')
  async complete(
    @Param('id') id: number,
    @Body() completedItem: CompletedItemDto
  ) {
    return await this.queueService.completeitem({ id, matchedCount: completedItem.matchedCount })
  }

  @Get('clearStaleLocks')
  async clearStaleLocks() {
    return await this.queueService.clearStaleLocks()
  }
}

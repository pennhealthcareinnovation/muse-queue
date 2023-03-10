import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

@ApiTags('Base')
@Controller()
export class AppController {
  constructor() { }

  private readonly logger = new Logger(AppController.name);

  @ApiExcludeEndpoint()
  @Get()
  getHello(): string {
    return 'Muse Queue';
  }

  @Post('/api/debug')
  async debug(
    @Body() body: any
  ) {
    this.logger.debug(body)
  }
}

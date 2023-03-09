import { Test, TestingModule } from '@nestjs/testing';
import { DatabricksService } from './databricks.service';

describe('DatabricksService', () => {
  let service: DatabricksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabricksService],
    }).compile();

    service = module.get<DatabricksService>(DatabricksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

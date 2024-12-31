import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, SequelizeHealthIndicator } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthCheckService;
  let dbHealthIndicator: SequelizeHealthIndicator;

  const mockHealthService = {
    check: jest.fn(),
  };

  const mockDbHealthIndicator = {
    pingCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthService,
        },
        {
          provide: SequelizeHealthIndicator,
          useValue: mockDbHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthCheckService>(HealthCheckService);
    dbHealthIndicator = module.get<SequelizeHealthIndicator>(
      SequelizeHealthIndicator,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return healthy status when database is up', async () => {
      const expectedResult = {
        status: 'ok',
        info: {
          postgres: {
            status: 'up',
          },
        },
        error: {},
        details: {
          postgres: {
            status: 'up',
          },
        },
      };

      mockHealthService.check.mockResolvedValue(expectedResult);

      const result = await controller.check();

      expect(result).toEqual(expectedResult);
      expect(mockHealthService.check).toHaveBeenCalled();
      expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when database is down', async () => {
      const expectedResult = {
        status: 'error',
        info: {},
        error: {
          postgres: {
            status: 'down',
            message: 'connection refused',
          },
        },
        details: {
          postgres: {
            status: 'down',
            message: 'connection refused',
          },
        },
      };

      mockHealthService.check.mockResolvedValue(expectedResult);

      const result = await controller.check();

      expect(result).toEqual(expectedResult);
      expect(mockHealthService.check).toHaveBeenCalled();
      expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected error');
      mockHealthService.check.mockRejectedValue(error);

      await expect(controller.check()).rejects.toThrow(error);
      expect(mockHealthService.check).toHaveBeenCalled();
      expect(mockHealthService.check).toHaveBeenCalledTimes(1);
    });
  });
});

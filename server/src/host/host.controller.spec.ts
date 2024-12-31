import { Test, TestingModule } from '@nestjs/testing';
import { HostController } from './host.controller';
import { HostService } from './host.service';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';

describe('HostController', () => {
  let controller: HostController;
  let service: HostService;

  const mockHostService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HostController],
      providers: [
        {
          provide: HostService,
          useValue: mockHostService,
        },
      ],
    }).compile();

    controller = module.get<HostController>(HostController);
    service = module.get<HostService>(HostService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new host', async () => {
      const createHostDto: CreateHostDto = {
        name: 'Test Host',
        address: '192.168.1.1',
      };
      const expectedResult = { id: 1, ...createHostDto };

      mockHostService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createHostDto);

      expect(result).toEqual(expectedResult);
      expect(mockHostService.create).toHaveBeenCalledWith(createHostDto);
      expect(mockHostService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return an array of hosts', async () => {
      const expectedResult = [
        { id: 1, name: 'Host 1', address: '192.168.1.1' },
        { id: 2, name: 'Host 2', address: '192.168.1.2' },
      ];

      mockHostService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(mockHostService.findAll).toHaveBeenCalled();
      expect(mockHostService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a single host', async () => {
      const expectedResult = { id: 1, name: 'Host 1', address: '192.168.1.1' };
      const id = '1';

      mockHostService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(id);

      expect(result).toEqual(expectedResult);
      expect(mockHostService.findOne).toHaveBeenCalledWith(1);
      expect(mockHostService.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update a host', async () => {
      const id = '1';
      const updateHostDto: UpdateHostDto = {
        name: 'Updated Host',
        address: '192.168.1.100',
      };
      const expectedResult = { id: 1, ...updateHostDto };

      mockHostService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(id, updateHostDto);

      expect(result).toEqual(expectedResult);
      expect(mockHostService.update).toHaveBeenCalledWith(1, updateHostDto);
      expect(mockHostService.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should remove a host', async () => {
      const id = '1';
      const expectedResult = {
        id: 1,
        name: 'Deleted Host',
        address: '192.168.1.1',
      };

      mockHostService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(id);

      expect(result).toEqual(expectedResult);
      expect(mockHostService.remove).toHaveBeenCalledWith(1);
      expect(mockHostService.remove).toHaveBeenCalledTimes(1);
    });
  });
});

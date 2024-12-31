import { Test, TestingModule } from '@nestjs/testing';
import { HostService } from './host.service';
import { DatabaseModule } from '../database/database.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Host } from '../database/models/host.model';
import { REPOSITORIES } from '../database/database.constants';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';

describe('HostService', () => {
  let service: HostService;
  let hostsRepository: typeof Host;

  const mockHostsRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        HostService,
        {
          provide: REPOSITORIES.HOST_REPOSITORY,
          useValue: mockHostsRepository,
        },
      ],
    }).compile();

    service = module.get<HostService>(HostService);
    hostsRepository = module.get<typeof Host>(REPOSITORIES.HOST_REPOSITORY);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createHostDto: CreateHostDto = {
      name: 'Test Host',
      address: '192.168.1.1',
    };

    it('should successfully create a host', async () => {
      const newHost = {
        id: 1,
        ...createHostDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHostsRepository.findOne.mockResolvedValue(null);
      mockHostsRepository.create.mockResolvedValue(newHost);

      const result = await service.create(createHostDto);

      expect(result).toEqual(newHost);
      expect(mockHostsRepository.findOne).toHaveBeenCalledWith({
        where: { address: createHostDto.address },
      });
      expect(mockHostsRepository.create).toHaveBeenCalledWith(createHostDto, {
        raw: true,
      });
    });

    it('should throw BadRequestException if host with address already exists', async () => {
      const existingHost = {
        id: 1,
        ...createHostDto,
      };

      mockHostsRepository.findOne.mockResolvedValue(existingHost);

      await expect(service.create(createHostDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockHostsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid IP address', async () => {
      const invalidHostDto = {
        name: 'Test Host',
        address: 'invalid-ip',
      };

      mockHostsRepository.findOne.mockResolvedValue(null);

      await expect(service.create(invalidHostDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockHostsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of hosts', async () => {
      const expectedHosts = [
        { id: 1, name: 'Host 1', address: '192.168.1.1' },
        { id: 2, name: 'Host 2', address: '192.168.1.2' },
      ];

      mockHostsRepository.findAll.mockResolvedValue(expectedHosts);

      const result = await service.findAll();

      expect(result).toEqual(expectedHosts);
      expect(mockHostsRepository.findAll).toHaveBeenCalledWith({
        raw: true,
        order: [['createdAt', 'DESC']],
      });
    });

    it('should return empty array when no hosts exist', async () => {
      mockHostsRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(mockHostsRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a host if found', async () => {
      const expectedHost = {
        id: 1,
        name: 'Test Host',
        address: '192.168.1.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHostsRepository.findByPk.mockResolvedValue(expectedHost);

      const result = await service.findOne(1);

      expect(result).toEqual(expectedHost);
      expect(mockHostsRepository.findByPk).toHaveBeenCalledWith(1, {
        raw: true,
      });
    });

    it('should throw NotFoundException if host not found', async () => {
      mockHostsRepository.findByPk.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);

      expect(mockHostsRepository.findByPk).toHaveBeenCalledWith(999, {
        raw: true,
      });
    });

    it('should throw BadRequestException for invalid id type', async () => {
      await expect(service.findOne(NaN)).rejects.toThrow(BadRequestException);

      expect(mockHostsRepository.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateHostDto: UpdateHostDto = {
      name: 'Updated Host',
    };

    it('should update and return the host', async () => {
      const existingHost = {
        id: 1,
        name: 'Original Host',
        address: '192.168.1.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedHost = {
        ...existingHost,
        ...updateHostDto,
        updatedAt: new Date(),
      };

      mockHostsRepository.findByPk.mockResolvedValue(existingHost);
      mockHostsRepository.update.mockResolvedValue([1]);
      mockHostsRepository.findByPk.mockResolvedValueOnce(updatedHost);

      const result = await service.update(1, updateHostDto);

      expect(result).toEqual(updatedHost);
      expect(mockHostsRepository.update).toHaveBeenCalledWith(updateHostDto, {
        where: { id: 1 },
        returning: true,
      });
    });

    it('should throw NotFoundException if host to update not found', async () => {
      mockHostsRepository.findByPk.mockResolvedValue(null);

      await expect(service.update(999, updateHostDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockHostsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if updating to existing address', async () => {
      const existingHost = {
        id: 1,
        name: 'Original Host',
        address: '192.168.1.1',
      };

      const updateDtoWithAddress: UpdateHostDto = {
        address: '192.168.1.2',
      };

      mockHostsRepository.findByPk.mockResolvedValue(existingHost);
      mockHostsRepository.findOne.mockResolvedValue({
        id: 2,
        address: '192.168.1.2',
      });

      await expect(service.update(1, updateDtoWithAddress)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockHostsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid IP address update', async () => {
      const existingHost = {
        id: 1,
        name: 'Original Host',
        address: '192.168.1.1',
      };

      const invalidUpdateDto: UpdateHostDto = {
        address: 'invalid-ip',
      };

      mockHostsRepository.findByPk.mockResolvedValue(existingHost);

      await expect(service.update(1, invalidUpdateDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockHostsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove the host and return success', async () => {
      const existingHost = {
        id: 1,
        name: 'Host to Remove',
        address: '192.168.1.1',
      };

      mockHostsRepository.findByPk.mockResolvedValue(existingHost);
      mockHostsRepository.destroy.mockResolvedValue(1);

      const result = await service.remove(1);

      expect(result).toEqual({ deleted: true });
      expect(mockHostsRepository.destroy).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if host to remove not found', async () => {
      mockHostsRepository.findByPk.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);

      expect(mockHostsRepository.destroy).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid id type', async () => {
      await expect(service.remove(NaN)).rejects.toThrow(BadRequestException);

      expect(mockHostsRepository.findByPk).not.toHaveBeenCalled();
      expect(mockHostsRepository.destroy).not.toHaveBeenCalled();
    });
  });
});

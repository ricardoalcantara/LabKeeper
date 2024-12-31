import { REPOSITORIES } from './database.constants';
import { Host } from './models/host.model';
import { getModelToken } from '@nestjs/sequelize';
import { HostRepository } from './repositories';
import { Service } from './models/service.model';
import { ServiceRepository } from './repositories/service.repository';
import { IpAddress } from './models/ip-address.model';
import { IpAddressRepository } from './repositories/ip-address.repository';

export const databaseProviders = [
  {
    provide: REPOSITORIES.HOST_REPOSITORY,
    inject: [getModelToken(Host)],
    useFactory: (model: typeof Host) => {
      return new HostRepository(model);
    },
  },
  {
    provide: REPOSITORIES.SERVICE_REPOSITORY,
    inject: [getModelToken(Service)],
    useFactory: (model: typeof Service) => {
      return new ServiceRepository(model);
    },
  },
  {
    provide: REPOSITORIES.IP_ADDRESS_REPOSITORY,
    inject: [getModelToken(IpAddress)],
    useFactory: (model: typeof IpAddress) => {
      return new IpAddressRepository(model);
    },
  },
];

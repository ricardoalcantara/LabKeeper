import { Provider } from '@nestjs/common';
import { REPOSITORIES } from '../database.constants';
import { HostRepository } from './host.repository';

export const repositoryProviders: Provider[] = [
  {
    provide: REPOSITORIES.HOST_REPOSITORY,
    useClass: HostRepository,
  },
];

export * from './host.repository';

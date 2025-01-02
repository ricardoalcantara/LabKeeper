import { Provider } from '@nestjs/common';
import { REPOSITORIES } from '../database.constants';
import { HostRepository } from './host.repository';
import { UserRepository } from './user.repository';

export const repositoryProviders: Provider[] = [
  {
    provide: REPOSITORIES.HOST_REPOSITORY,
    useClass: HostRepository,
  },
  {
    provide: REPOSITORIES.USER_REPOSITORY,
    useClass: UserRepository,
  },
];

export { HostRepository, UserRepository };


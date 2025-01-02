import { Inject, Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AccessToken } from './interface/access_token.interface';
import { UserRepository } from 'src/database/repositories';
import { REPOSITORIES } from 'src/database/database.constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(REPOSITORIES.USER_REPOSITORY)
    private userRepository: UserRepository,
  ) {}
  async loginAsync(login: LoginDto): Promise<AccessToken> {
    return Promise.resolve({ accessToken: '123' });
  }
}

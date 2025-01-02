import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Host } from '../models/host.model';
import { BaseRepository } from './base.repository';
import { User } from '../models/user.model';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectModel(User)
    model: typeof User,
  ) {
    super(model);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne({ where: { username } });
  }
}

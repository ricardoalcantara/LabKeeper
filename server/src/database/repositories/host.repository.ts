import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Host } from '../models/host.model';
import { BaseRepository } from './base.repository';

@Injectable()
export class HostRepository extends BaseRepository<Host> {
  constructor(
    @InjectModel(Host)
    model: typeof Host,
  ) {
    super(model);
  }

  // async findByAddress(address: string): Promise<Host> {
  //   return this.findOne({ address } as any);
  // }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BaseRepository } from './base.repository';
import { IpAddress } from '../models/ip-address.model';

@Injectable()
export class IpAddressRepository extends BaseRepository<IpAddress> {
  constructor(
    @InjectModel(IpAddress)
    model: typeof IpAddress,
  ) {
    super(model);
  }
}

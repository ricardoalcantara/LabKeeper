import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BaseRepository } from './base.repository';
import { Service } from '../models/service.model';

@Injectable()
export class ServiceRepository extends BaseRepository<Service> {
  constructor(
    @InjectModel(Service)
    model: typeof Service,
  ) {
    super(model);
  }
}

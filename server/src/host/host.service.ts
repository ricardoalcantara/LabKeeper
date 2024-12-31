import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';
import { Host } from './interface/host.interface';
import { HostRepository } from 'src/database/repositories';
import { REPOSITORIES } from 'src/database/database.constants';

@Injectable()
export class HostService {
  constructor(
    @Inject(REPOSITORIES.HOST_REPOSITORY)
    private hostRepository: HostRepository,
  ) {}

  async create(createHostDto: CreateHostDto): Promise<Host> {
    throw new InternalServerErrorException('Method not implemented.');
  }

  async findAll(): Promise<Host[]> {
    console.log(await this.hostRepository.findAll());
    throw new InternalServerErrorException('Method not implemented.');
  }

  async findOne(id: number): Promise<Host> {
    throw new InternalServerErrorException('Method not implemented.');
  }

  async update(id: number, updateHostDto: UpdateHostDto): Promise<Host> {
    throw new InternalServerErrorException('Method not implemented.');
  }

  async remove(id: number): Promise<{}> {
    throw new InternalServerErrorException('Method not implemented.');
  }
}

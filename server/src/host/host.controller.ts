import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HostService } from './host.service';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';

@Controller('host')
export class HostController {
  constructor(private readonly hostService: HostService) {}

  @Post()
  create(@Body() createHostDto: CreateHostDto) {
    return this.hostService.create(createHostDto);
  }

  @Get()
  findAll() {
    return this.hostService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hostService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateHostDto: UpdateHostDto) {
    return this.hostService.update(+id, updateHostDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hostService.remove(+id);
  }
}

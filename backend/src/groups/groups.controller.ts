import { Controller } from '@nestjs/common';
import {
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';

import { UuidDto } from 'src/common/utils/uuid.dto';
import { UserPayloadDto } from 'src/auth/dto/payload.dto';
import { GroupUpdateDto } from './dto/group.update.dto';
import { GroupCreateDto } from './dto/group.create.dto';

import { GroupsService } from './groups.service';
import { AddUsersDto } from './dto/add.users.dto';
import { ChangeRoleDto } from './dto/change.role.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() groupCreateDto: GroupCreateDto,
  ) {
    return this.groupsService.create(userId, groupCreateDto);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Query('name') name?: string,
  ) {
    return this.groupsService.findAll(userId, name);
  }

  @Get(':id')
  findOne(@Param('id') id: UuidDto['id']) {
    return this.groupsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() groupCreateDto: GroupCreateDto,
  ) {
    return this.groupsService.update(userId, id, groupCreateDto);
  }

  @Patch(':id/add/users')
  addUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body('userIds') userIds: AddUsersDto['userIds'],
  ) {
    return this.groupsService.addUsers(userId, id, userIds);
  }

  @Patch(':id/remove/users')
  removeUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body('userIds') userIds: AddUsersDto['userIds'],
  ) {
    return this.groupsService.removeUsers(userId, id, userIds);
  }

  @Patch(':id/change/role')
  changeUserRole(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() changeRoleDto: ChangeRoleDto,
  ) {
    return this.groupsService.changeUserRole(userId, id, changeRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Param('id') id: UuidDto['id'],
  ) {
    return this.groupsService.delete(userId, id);
  }
}

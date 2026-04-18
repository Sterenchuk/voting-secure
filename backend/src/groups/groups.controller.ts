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

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';
import { UuidDto } from '../common/utils/uuid.dto';
import { UserPayloadDto } from '../auth/dto/payload.dto';
import {
  GroupUpdateDto,
  GroupCreateDto,
  AddUsersDto,
  ChangeRoleDto,
} from './dto/group.input.dto';
import { GroupResponseDto } from './dto/group.response.dto';
import { FindAllGroupsDto } from './dto/group.query.dto';

import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() groupCreateDto: GroupCreateDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(userId, groupCreateDto);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Query('name') name?: FindAllGroupsDto['name'],
  ): Promise<GroupResponseDto[]> {
    return this.groupsService.findAll(userId, name);
  }
  @Get(':id/members')
  async findGroupMembers(@Param('id') groupId: string): Promise<any[]> {
    return this.groupsService.findMembers(groupId);
  }
  @Get(':id')
  findOne(@Param('id') id: UuidDto['id']): Promise<GroupResponseDto> {
    return this.groupsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() groupUpdateDto: GroupUpdateDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(userId, id, groupUpdateDto);
  }

  @Patch(':id/add/users')
  addUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() addUsersDto: AddUsersDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.addUsers(userId, id, addUsersDto.userEmails);
  }

  @Patch(':id/remove/users')
  removeUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() addUsersDto: AddUsersDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.removeUsers(userId, id, addUsersDto.userEmails);
  }

  @Patch(':id/change/role')
  changeUserRole(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() changeRoleDto: ChangeRoleDto,
  ): Promise<GroupResponseDto> {
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

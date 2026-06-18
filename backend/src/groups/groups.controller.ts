import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Patch,
  UsePipes,
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
import { Audit, ChainAction } from '../audit/audit.decorator';
import { ResolveEmailsPipe } from '../common/pipes/resolve-emails.pipe';
import { GroupRoleGuard } from '../common/guards/group-role.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard, GroupRoleGuard)
@Roles(Role.USER)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Audit({
    action: ChainAction.GROUP_CREATED,
    extractPayload: (res: any) => ({ groupId: res.id, name: res.name }),
  })
  create(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Body() groupCreateDto: GroupCreateDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(userId, groupCreateDto, role);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Query('name') name?: FindAllGroupsDto['name'],
  ): Promise<GroupResponseDto[]> {
    return this.groupsService.findAll(userId, role, name);
  }

  @Get(':id/members')
  async findGroupMembers(
    @Param('id') groupId: string,
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
  ): Promise<any[]> {
    return this.groupsService.findMembers(groupId, userId, role);
  }

  @Get(':id')
  findOne(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
  ): Promise<GroupResponseDto> {
    return this.groupsService.findOne(id, userId, role);
  }

  @Patch(':id')
  @Audit({
    action: ChainAction.GROUP_UPDATED,
    extractPayload: (res: any) => ({
      groupId: res.id,
      updatedFields: res,
    }),
  })
  update(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Body() groupUpdateDto: GroupUpdateDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(userId, id, groupUpdateDto, role);
  }

  @Patch(':id/add/users')
  @UsePipes(ResolveEmailsPipe)
  @Audit({
    action: ChainAction.MEMBER_ADDED,
    extractPayload: (_res, req: any) => ({
      groupId: req.params.id,
      addedUserIds: req.body.targetUserIds,
    }),
  })
  addUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Body() addUsersDto: AddUsersDto & { targetUserIds: string[] },
  ): Promise<GroupResponseDto> {
    return this.groupsService.addUsers(
      userId,
      id,
      addUsersDto.targetUserIds,
      role,
    );
  }

  @Patch(':id/remove/users')
  @UsePipes(ResolveEmailsPipe)
  @Audit({
    action: ChainAction.MEMBER_REMOVED,
    extractPayload: (_res, req: any) => ({
      groupId: req.params.id,
      removedUserIds: req.body.targetUserIds,
    }),
  })
  removeUsers(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Body() addUsersDto: AddUsersDto & { targetUserIds: string[] },
  ): Promise<GroupResponseDto> {
    return this.groupsService.removeUsers(
      userId,
      id,
      addUsersDto.targetUserIds,
      role,
    );
  }

  @Patch(':id/change/role')
  @UsePipes(ResolveEmailsPipe)
  @Audit({
    action: ChainAction.USER_ROLE_CHANGED,
    extractPayload: (_res, req: any) => ({
      groupId: req.params.id,
      targetUserId: req.body.targetUserId,
      role: req.body.role,
    }),
  })
  changeUserRole(
    @Param('id') id: UuidDto['id'],
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @CurrentUser('role') role: Role,
    @Body() changeRoleDto: ChangeRoleDto & { targetUserId: string },
  ): Promise<GroupResponseDto> {
    return this.groupsService.changeUserRole(userId, id, changeRoleDto, role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: ChainAction.GROUP_DELETED,
    extractPayload: (_res: any, req: any) => ({ groupId: req.params.id }),
  })
  remove(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Param('id') id: UuidDto['id'],
  ) {
    return this.groupsService.delete(userId, id);
  }
}

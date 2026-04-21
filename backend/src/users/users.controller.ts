import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';

import { UsersService } from './users.service';
import { UserCreateDto } from './dto/user.create.dto';
import { UserUpdateDto } from './dto/user.update.dto';
import { UserResponseDto } from './dto/user.response.dto';
import { UuidDto } from '../common/utils/uuid.dto';
import { UserPayloadDto } from '../auth/dto/payload.dto';

import { JwtService } from '@nestjs/jwt';
import { Audit, ChainAction, SecurityAction } from '../audit/audit.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  @Roles(Role.USER)
  @Audit({
    action: SecurityAction.TOKEN_REFRESH, // closest to profile update in current enum, or maybe use a custom one if needed
    extractPayload: () => ({ action: 'PROFILE_UPDATE' }),
  })
  async update(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() userUpdateDto: UserUpdateDto,
  ): Promise<{ user: UserResponseDto; access_token: string }> {
    const updatedUser = await this.usersService.update(userId, userUpdateDto);

    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    };

    const access_token = this.jwtService.sign(payload);
    return { user: updatedUser, access_token };
  }

  @Delete('me')
  @Roles(Role.USER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: SecurityAction.USER_LOGOUT, // closest to self-deletion in current enum
    extractPayload: () => ({ action: 'SELF_DELETION' }),
  })
  async delete(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
  ): Promise<void> {
    await this.usersService.delete(userId);
  }

  // ADMIN ONLY
  @Get()
  @Roles(Role.ADMIN)
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: UuidDto['id']): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @Audit({
    action: ChainAction.USER_ROLE_CHANGED,
    extractPayload: (_res, req: any) => ({
      targetUserId: req.params.id,
      action: 'ADMIN_UPDATE',
    }),
  })
  async adminUpdate(
    @Param('id') userId: UuidDto['id'],
    @Body() userUpdateDto: UserUpdateDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(userId, userUpdateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: ChainAction.USER_ROLE_CHANGED, // reuse as admin-action
    extractPayload: (_res, req: any) => ({
      targetUserId: req.params.id,
      action: 'ADMIN_DELETE',
    }),
  })
  async adminDelete(@Param('id') id: UuidDto['id']): Promise<void> {
    await this.usersService.delete(id);
  }

  @Post('register-admin')
  @Roles(Role.ADMIN)
  @Audit({
    action: ChainAction.USER_ROLE_CHANGED,
    extractPayload: (res: any) => ({
      targetUserId: res.id,
      newRole: Role.ADMIN,
    }),
  })
  async registerAdmin(
    @Body('id') userCreateDto: UserCreateDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(userCreateDto, Role.ADMIN);
  }

  @Patch('promote/:id')
  @Roles(Role.ADMIN)
  @Audit({
    action: ChainAction.USER_ROLE_CHANGED,
    extractPayload: (res: any) => ({
      targetUserId: res.id,
      newRole: Role.ADMIN,
    }),
  })
  async promoteToAdmin(
    @Param('id') id: UuidDto['id'],
  ): Promise<UserResponseDto> {
    return this.usersService.upgradeToAdmin(id);
  }
}

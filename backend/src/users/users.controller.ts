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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';

import { UsersService } from './users.service';
import { UserCreateDto } from './dto/user.create.dto';
import { UserUpdateDto } from './dto/user.update.dto';
import { UuidDto } from 'src/common/utils/uuid.dto';
import { User } from '@prisma/client';
import { UserPayloadDto } from 'src/auth/dto/payload.dto';

import { JwtService } from '@nestjs/jwt';
import { UserDto } from './dto/user.dto';

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
  ): Promise<UserDto> {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  @Roles(Role.USER)
  async update(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
    @Body() userUpdateDto: UserUpdateDto,
  ): Promise<{ user: UserDto; access_token: string }> {
    const updatedUser: UserDto = await this.usersService.update(
      userId,
      userUpdateDto,
    );

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
  async delete(
    @CurrentUser('sub') userId: UserPayloadDto['sub'],
  ): Promise<void> {
    await this.usersService.delete(userId);
  }

  // ADMIN ONLY
  @Get()
  @Roles(Role.ADMIN)
  async findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: UuidDto['id']): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async adminUpdate(
    @Param('id') userId: UuidDto['id'],
    @Body() userUpdateDto: UserUpdateDto,
  ): Promise<UserDto> {
    return this.usersService.update(userId, userUpdateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDelete(@Param('id') id: UuidDto['id']): Promise<void> {
    await this.usersService.delete(id);
  }

  @Post('register-admin')
  @Roles(Role.ADMIN)
  async registerAdmin(
    @Body('id') userCreateDto: UserCreateDto,
  ): Promise<UserDto> {
    return this.usersService.create(userCreateDto, Role.ADMIN);
  }

  @Patch('promote/:id')
  @Roles(Role.ADMIN)
  async promoteToAdmin(@Param('id') id: UuidDto['id']): Promise<UserDto> {
    return this.usersService.upgradeToAdmin(id);
  }
}

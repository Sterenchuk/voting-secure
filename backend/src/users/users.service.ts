//core
import {
  BadRequestException,
  Catch,
  Injectable,
  Options,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma, User } from '@prisma/client';

import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
//utils
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { hashPassword } from 'src/common/utils/hash-password';
import { Role } from 'src/common/enums/role';

//DTOS
import { UserCreateDto } from './dto/user.create.dto';
import { UserUpdateDto } from './dto/user.update.dto';
import { UserResponseDto, SELECT_USER_FIELDS } from './dto/user.response.dto';
import { error } from 'console';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<UserResponseDto[]> {
    try {
      const users = await this.databaseService.user.findMany({
        select: SELECT_USER_FIELDS,
      });

      return users;
    } catch (e) {
      handlePrismaError(e, 'Finding all');
    }
  }

  async findOne(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id },
        select: SELECT_USER_FIELDS,
      });

      if (!user) {
        console.log('almost there');
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (e) {
      console.log('Error occurred while finding user:', e);
      handlePrismaError(error, 'Find one user');
    }
  }

  async findOneByEmail(email: string): Promise<User> {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException('User not Found ');
      }
      return user;
    } catch (e) {
      handlePrismaError(e, 'find by email');
    }
  }

  async create(
    userCreateDto: UserCreateDto,
    role?: Role,
  ): Promise<UserResponseDto> {
    const hashedPassword = await hashPassword(userCreateDto.password);
    try {
      const newUser = await this.databaseService.user.create({
        data: {
          ...userCreateDto,
          password: hashedPassword,
          role: role,
        },
        select: SELECT_USER_FIELDS,
      });

      return newUser;
    } catch (error) {
      handlePrismaError(error, 'create user');
    }
  }

  async update(
    id: string,
    userUpdateDto: UserUpdateDto,
  ): Promise<UserResponseDto> {
    try {
      const prevUser = await this.databaseService.user.findUnique({
        where: { id },
        select: SELECT_USER_FIELDS,
      });

      if (!prevUser) {
        throw new NotFoundException('User not found');
      }

      if (userUpdateDto.password) {
        userUpdateDto.password = await hashPassword(userUpdateDto.password);
      }

      const user = await this.databaseService.user.update({
        where: { id },
        data: userUpdateDto,
        select: SELECT_USER_FIELDS,
      });

      return user;
    } catch (e) {
      handlePrismaError(e, 'update user');
    }
  }

  async delete(id: string) {
    try {
      const user = await this.findOne(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.databaseService.user.delete({ where: { id } });
    } catch (e) {
      handlePrismaError(e, 'deleting user');
    }
  }

  async upgradeToAdmin(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.databaseService.user.update({
        where: { id },
        data: { role: Role.ADMIN },
        select: SELECT_USER_FIELDS,
      });
      return user;
    } catch (e) {
      handlePrismaError(e, 'upgrading user to admin');
    }
  }
}

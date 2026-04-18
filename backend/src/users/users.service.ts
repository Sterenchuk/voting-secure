//core
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from '@prisma/client';

//utils
import { handlePrismaError } from '../common/utils/prisma-error';
import { hashPassword } from '../common/utils/hash-password';
import { Role } from '../common/enums/role';

//DTOS
import { UserCreateDto } from './dto/user.create.dto';
import { UserUpdateDto } from './dto/user.update.dto';
import { UserResponseDto, SELECT_USER_FIELDS } from './dto/user.response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<UserResponseDto[]> {
    return this.databaseService.user
      .findMany({
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Finding all users'));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.databaseService.user
      .findUnique({
        where: { id },
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Finding user'));

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findOneByEmail(email: string): Promise<User> {
    const user = await this.databaseService.user
      .findUnique({
        where: { email },
      })
      .catch((e) => handlePrismaError(e, 'Finding user by email'));

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(
    userCreateDto: UserCreateDto,
    role?: Role,
  ): Promise<UserResponseDto> {
    const hashedPassword = await hashPassword(userCreateDto.password);
    return this.databaseService.user
      .create({
        data: {
          ...userCreateDto,
          password: hashedPassword,
          role: role,
        },
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Creating user'));
  }

  async update(
    id: string,
    userUpdateDto: UserUpdateDto,
  ): Promise<UserResponseDto> {
    const prevUser = await this.databaseService.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!prevUser) {
      throw new NotFoundException('User not found');
    }

    if (userUpdateDto.password) {
      userUpdateDto.password = await hashPassword(userUpdateDto.password);
    }

    return this.databaseService.user
      .update({
        where: { id },
        data: userUpdateDto,
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Updating user'));
  }

  async delete(id: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.databaseService.user
      .delete({ where: { id } })
      .catch((e) => handlePrismaError(e, 'Deleting user'));
  }

  async upgradeToAdmin(id: string): Promise<UserResponseDto> {
    return this.databaseService.user
      .update({
        where: { id },
        data: { role: Role.ADMIN },
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Upgrading user to admin'));
  }
}

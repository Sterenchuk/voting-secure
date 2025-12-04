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
import { USER_SELECT_FUILDS } from 'src/common/constants/user.select.fields';
import { error } from 'console';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<UserDto[]> {
    try {
      const users = await this.databaseService.user.findMany({
        select: USER_SELECT_FUILDS,
      });

      return users;
    } catch (e) {
      handlePrismaError(e, 'Finding all');
    }
  }

  async findOne(id: string): Promise<UserDto> {
    console.log('Finding user with ID:', id);
    console.log('Finding user with ID:', id);

    try {
      const user = await this.databaseService.user.findUnique({
        where: { id },
        select: USER_SELECT_FUILDS,
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

  async create(userCreateDto: UserCreateDto, role?: Role): Promise<UserDto> {
    const hashedPassword = await hashPassword(userCreateDto.password);
    try {
      const newUser: UserDto = await this.databaseService.user.create({
        data: {
          ...userCreateDto,
          password: hashedPassword,
          role: role,
        },
        select: USER_SELECT_FUILDS,
      });

      return newUser;
    } catch (error) {
      handlePrismaError(error, 'create user');
    }
  }

  async update(id: string, userUpdateDto: UserUpdateDto): Promise<UserDto> {
    try {
      const prevUser = await this.databaseService.user.findUnique({
        where: { id },
        select: USER_SELECT_FUILDS,
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
        select: USER_SELECT_FUILDS,
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

  async upgradeToAdmin(id: string): Promise<User> {
    try {
      const user = await this.databaseService.user.update({
        where: { id },
        data: { role: Role.ADMIN },
      });
      return user;
    } catch (e) {
      handlePrismaError(e, 'upgrading user to admin');
    }
  }
}

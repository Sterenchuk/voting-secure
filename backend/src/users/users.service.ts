//core
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from '@prisma/client';

//utils
import { handlePrismaError } from '../common/utils/prisma-error';
import { hashPassword } from '../common/utils/hash-password';
import { Role } from '../common/enums/role';
import { CryptoUtils } from '../common/utils/crypto-utils';

//DTOS
import { UserCreateDto } from './dto/user.create.dto';
import { UserUpdateDto } from './dto/user.update.dto';
import { UserResponseDto, SELECT_USER_FIELDS } from './dto/user.response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  private decryptUserEmail<T extends { email: string }>(user: T): T {
    if (user && user.email) {
      user.email = CryptoUtils.decrypt(user.email);
    }
    return user;
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.databaseService.user
      .findMany({
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Finding all users'));

    return users.map((u) => this.decryptUserEmail(u));
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

    return this.decryptUserEmail(user);
  }

  async findOneByEmail(email: string): Promise<User> {
    const emailHash = CryptoUtils.getBlindIndex(email);
    const user = await this.databaseService.user
      .findUnique({
        where: { emailHash },
      })
      .catch((e) => handlePrismaError(e, 'Finding user by email'));

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.decryptUserEmail(user);
  }

  async create(
    userCreateDto: UserCreateDto,
    role?: Role,
  ): Promise<UserResponseDto> {
    const hashedPassword = await hashPassword(userCreateDto.password);
    const encryptedEmail = CryptoUtils.encrypt(userCreateDto.email);
    const emailHash = CryptoUtils.getBlindIndex(userCreateDto.email);

    const user = await this.databaseService.user
      .create({
        data: {
          ...userCreateDto,
          email: encryptedEmail,
          emailHash: emailHash,
          password: hashedPassword,
          role: role,
        },
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Creating user'));

    return this.decryptUserEmail(user);
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

    const updateData: any = { ...userUpdateDto };

    if (userUpdateDto.password) {
      updateData.password = await hashPassword(userUpdateDto.password);
    }

    if (userUpdateDto.email) {
      updateData.email = CryptoUtils.encrypt(userUpdateDto.email);
      updateData.emailHash = CryptoUtils.getBlindIndex(userUpdateDto.email);
    }

    const user = await this.databaseService.user
      .update({
        where: { id },
        data: updateData,
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Updating user'));

    return this.decryptUserEmail(user);
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
    const user = await this.databaseService.user
      .update({
        where: { id },
        data: { role: Role.ADMIN },
        select: SELECT_USER_FIELDS,
      })
      .catch((e) => handlePrismaError(e, 'Upgrading user to admin'));

    return this.decryptUserEmail(user);
  }
}

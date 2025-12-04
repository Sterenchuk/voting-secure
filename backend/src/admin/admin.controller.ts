// import { Controller, UseGuards } from '@nestjs/common';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../common/guards/roles.guard';
// import {
//   Get,
//   Post,
//   Patch,
//   Delete,
//   Param,
//   Body,
//   HttpCode,
//   HttpStatus,
//   ParseUUIDPipe,
// } from '@nestjs/common';
// import { UsersService } from '../users/users.service';
// import { UserCreateDto } from '../users/dto/user.create.dto';
// import { UserUpdateDto } from '../users/dto/user.update.dto';
// import { User } from '@prisma/client';
// import { Roles } from '../common/decorators/roles.decorator';
// import { Role } from '../common/enums/role';

// @Controller('admin/users')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN)
// export class AdminUsersController {
//   constructor(private readonly usersService: UsersService) {}

//   @Get()
//   async findAll(): Promise<User[]> {
//     return this.usersService.findAll();
//   }

//   @Get(':id')
//   async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
//     return this.usersService.findOne(id);
//   }

//   @Post()
//   async create(@Body() userCreateDto: UserCreateDto): Promise<User> {
//     // Let admin create with arbitrary role (optional), or default to USER
//     return this.usersService.create(userCreateDto, userCreateDto.role);
//   }

//   @Patch(':id')
//   async update(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() userUpdateDto: UserUpdateDto,
//   ): Promise<User> {
//     return this.usersService.update(id, userUpdateDto);
//   }

//   @Delete(':id')
//   @HttpCode(HttpStatus.NO_CONTENT)
//   async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
//     await this.usersService.delete(id);
//   }
// }

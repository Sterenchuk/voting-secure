import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { User } from '@prisma/client';

import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from 'src/common/enums/role';
import { UserDto } from 'src/users/dto/user.dto';
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto): Promise<{ accessToken: string }> {
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Post('register')
  async create(
    @Body() registerDto: RegisterDto,
  ): Promise<{ user: UserDto; accessToken: string }> {
    return await this.authService.register(registerDto, Role.USER);
  }
}

import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from 'src/common/enums/role';
import { ResponseDto } from './dto/response.dto';
import { RefreshToken } from 'generated/prisma';
import { RefreshTokenDto } from 'src/users/dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto): Promise<ResponseDto> {
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Post('login')
  refresh(@Body() dto: RefreshTokenDto['refreshToken']): Promise<any> {
    return this.authService.refresh(dto);
  }

  @Post('register')
  async create(@Body() registerDto: RegisterDto): Promise<ResponseDto> {
    return await this.authService.register(registerDto, Role.USER);
  }
}

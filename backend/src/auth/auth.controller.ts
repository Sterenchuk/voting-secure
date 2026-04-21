import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../common/enums/role';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Audit, SecurityAction } from '../audit/audit.decorator';
import { ResolveEmailsPipe } from '../common/pipes/resolve-emails.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      signed: true,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      signed: true,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @UsePipes(ResolveEmailsPipe)
  @Audit({
    action: SecurityAction.USER_LOGIN,
    extractPayload: () => ({}),
  })
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: any,
  ) {
    const result = await this.authService.signIn(
      signInDto.email,
      signInDto.password,
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Attach user for the AuditInterceptor
    req.user = { sub: result.user.id };

    return {
      user: result.user,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @Audit({
    action: SecurityAction.TOKEN_REFRESH,
    extractPayload: () => ({}),
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.signedCookies['refresh_token'];
    const result = await this.authService.refresh(refreshToken);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
      signed: true,
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
    };
  }

  @Post('register')
  @Audit({
    action: SecurityAction.USER_REGISTERED,
    extractPayload: (res: any) => ({
      role: res.user?.role,
    }),
  })
  async create(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: any,
  ) {
    const result = await this.authService.register(registerDto, Role.USER);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Attach user for the AuditInterceptor
    req.user = { sub: result.user.id };

    return {
      user: result.user,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @Audit({
    action: SecurityAction.USER_LOGOUT,
    extractPayload: () => ({}),
  })
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  @Audit({
    action: SecurityAction.EMAIL_VERIFY_COMPLETED,
    extractPayload: () => ({}),
  })
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @Audit({
    action: SecurityAction.PASSWORD_RESET_REQUESTED,
    extractPayload: () => ({}),
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @Audit({
    action: SecurityAction.PASSWORD_RESET_COMPLETED,
    extractPayload: () => ({}),
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}

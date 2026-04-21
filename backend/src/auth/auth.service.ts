import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword, hashPassword } from '../common/utils/hash-password';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../common/enums/role';
import { ResponseDto } from './dto/response.dto';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { CryptoUtils } from '../common/utils/crypto-utils';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private databaseService: DatabaseService,
    private mailService: MailService,
  ) {}

  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: '30d' },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const tokenHash = CryptoUtils.hashToken(refreshToken);

    await this.databaseService.refreshToken.upsert({
      where: { tokenHash: tokenHash },
      update: {
        expiresAt: expiresAt,
      },
      create: {
        tokenHash: tokenHash,
        userId: userId,
        expiresAt: expiresAt,
      },
    });

    return refreshToken;
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const userId = payload.sub;
      const tokenHash = CryptoUtils.hashToken(refreshToken);

      const savedToken = await this.databaseService.refreshToken.findUnique({
        where: {
          tokenHash: tokenHash,
        },
      });

      if (
        !savedToken ||
        savedToken.expiresAt < new Date() ||
        savedToken.userId !== userId
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.usersService.findOne(userId);

      const newPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      return {
        accessToken: this.jwtService.sign(newPayload),
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Refresh failed');
    }
  }

  async register(registerDto: RegisterDto, role?: Role): Promise<ResponseDto> {
    const user = await this.usersService.create(registerDto, role);

    const token = CryptoUtils.generateRandomToken();
    const tokenHash = CryptoUtils.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.databaseService.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(user.email, token);

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: await this.generateRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name ? user.name : undefined,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async signIn(email: string, password: string): Promise<ResponseDto> {
    const user = await this.usersService.findOneByEmail(email);

    if ((await verifyPassword(user.password, password)) === false) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: await this.generateRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name ? user.name : undefined,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = CryptoUtils.hashToken(token);

    const verificationToken =
      await this.databaseService.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

    if (
      !verificationToken ||
      verificationToken.expiresAt < new Date() ||
      verificationToken.usedAt
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.databaseService.$transaction([
      this.databaseService.user.update({
        where: { id: verificationToken.userId },
        data: { isEmailVerified: true },
      }),
      this.databaseService.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    let user;
    try {
      user = await this.usersService.findOneByEmail(email);
    } catch (e) {
      // For security reasons, don't reveal if user exists
      return {
        message: 'If a user with that email exists, a reset link has been sent',
      };
    }

    const token = CryptoUtils.generateRandomToken();
    const tokenHash = CryptoUtils.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.databaseService.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, token);

    return {
      message: 'If a user with that email exists, a reset link has been sent',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = CryptoUtils.hashToken(token);

    const resetToken = await this.databaseService.passwordResetToken.findUnique(
      {
        where: { tokenHash },
      },
    );

    if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(newPassword);

    await this.databaseService.$transaction([
      this.databaseService.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.databaseService.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }
}

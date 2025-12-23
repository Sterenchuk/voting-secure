import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from 'src/common/utils/hash-password';
import { RegisterDto } from './dto/register.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { Role } from 'src/common/enums/role';
import { ResponseDto } from './dto/response.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private databaseService: DatabaseService,
  ) {}

  private async generetaRefreshToken(userId: string): Promise<string> {
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: '30d' },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.databaseService.refreshToken.upsert({
      where: { userId: userId },
      update: {
        token: refreshToken,
        expiresAt: expiresAt,
      },
      create: {
        token: refreshToken,
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

      const savedToken = await this.databaseService.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: userId,
        },
      });

      if (!savedToken || savedToken.expiresAt < new Date()) {
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
      throw new UnauthorizedException('Refresh failed');
    }
  }

  async register(registerDto: RegisterDto, role?: Role): Promise<ResponseDto> {
    try {
      const user = await this.usersService.create(registerDto, role);

      const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      const accessToken = this.jwtService.sign(payload);
      const response: ResponseDto = {
        accessToken,
        refreshToken: await this.generetaRefreshToken(user.id),
        user: {
          id: user.id,
          email: user.email,
          name: user.name ? user.name : undefined,
          role: user.role,
        },
      };

      return response;
    } catch (e) {
      handlePrismaError(e, 'User registration');
    }
  }

  async signIn(email: string, password: string): Promise<ResponseDto> {
    const user = await this.usersService.findOneByEmail(email);

    if ((await verifyPassword(user.password, password)) === false) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    const response: ResponseDto = {
      accessToken,
      refreshToken: await this.generetaRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name ? user.name : undefined,
        role: user.role,
      },
    };

    return response;
  }
}

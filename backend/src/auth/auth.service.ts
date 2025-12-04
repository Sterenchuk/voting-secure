import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from 'src/common/utils/hash-password';
import { RegisterDto } from './dto/register.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { Role } from 'src/common/enums/role';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto, role?: Role) {
    try {
      const user = await this.usersService.create(registerDto, role);

      const payload = { sub: user.id, email: user.email, name: user.name };
      const accessToken = this.jwtService.sign(payload);

      return { user, accessToken };
    } catch (e) {
      handlePrismaError(e, 'User registration');
    }
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
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

    return { accessToken };
  }
}

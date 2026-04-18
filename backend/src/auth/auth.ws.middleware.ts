import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Socket } from 'socket.io';
import { AuthenticatedSocket } from './authenticated-socket.interface';
import * as cookie from 'cookie';

export const wsAuthMiddleware =
  (jwtService: JwtService, usersService: UsersService) =>
  async (socket: Socket, next: (err?: Error) => void) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies['accessToken'];
      }

      if (!token) {
        return next(new Error('No token provided'));
      }

      const cleanToken = token.startsWith('Bearer ')
        ? token.slice(7)
        : token;

      const payload = await jwtService.verifyAsync(cleanToken);
      const user = await usersService.findOne(payload.sub);

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as AuthenticatedSocket).user = user;

      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  };

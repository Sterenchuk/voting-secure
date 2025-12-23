import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Socket } from 'socket.io';
import { AuthenticatedSocket } from './authenticated-socket.interface';

export const wsAuthMiddleware =
  (jwtService: JwtService, usersService: UsersService) =>
  async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const rawToken = socket.handshake.auth?.token;

      if (!rawToken) {
        return next(new Error('No token provided'));
      }

      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7)
        : rawToken;

      const payload = await jwtService.verifyAsync(token);
      const user = await usersService.findOne(payload.sub);

      if (!user) {
        return next(new Error('User not found'));
      }

      // ✅ Attach user directly to socket
      (socket as AuthenticatedSocket).user = user;

      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  };

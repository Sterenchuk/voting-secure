import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Socket } from 'socket.io';
import { AuthenticatedSocket } from './authenticated-socket.interface';
import { Logger } from '@nestjs/common';
import * as cookie from 'cookie';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('WsAuthMiddleware');

export const wsAuthMiddleware =
  (jwtService: JwtService, usersService: UsersService, configService: ConfigService) =>
  async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const jwtSecret = configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        logger.error('JWT_SECRET is not defined in configuration');
        return next(new Error('Internal Server Error'));
      }

      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        const rawCookie = cookies['access_token'];
        
        if (rawCookie) {
          const result = cookieParser.signedCookie(
            rawCookie,
            jwtSecret,
          );

          if (result === false) {
            logger.debug('Failed to verify signed cookie signature');
            token = null;
          } else if (result === rawCookie) {
            // Cookie was not signed (missing s: prefix)
            logger.debug('Cookie found but it is not signed');
            token = null;
          } else {
            token = result;
          }
        }
      }

      if (!token || token === 'false') {
        logger.debug('No token found in auth or cookies');
        return next(new Error('Unauthorized'));
      }

      const cleanToken = token.startsWith('Bearer ')
        ? token.slice(7)
        : token;

      const payload = await jwtService.verifyAsync(cleanToken, {
        secret: jwtSecret,
      });
      const user = await usersService.findOne(payload.sub);

      if (!user) {
        logger.debug(`User ${payload.sub} not found`);
        return next(new Error('Unauthorized'));
      }

      (socket as AuthenticatedSocket).user = user;

      next();
    } catch (err) {
      logger.error(`WS Auth Error: ${err.message}`);
      next(new Error('Unauthorized'));
    }
  };

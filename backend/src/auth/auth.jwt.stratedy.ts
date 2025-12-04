import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserPayloadDto } from './dto/payload.dto';
import { config } from 'dotenv';
import e from 'express';

config();
console.log('Loading JWT Strategy with secret:', process.env.JWT_SECRET);
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      expirationTime: '1h',
    });
  }

  async validate(payload: UserPayloadDto) {
    return payload;
  }
}

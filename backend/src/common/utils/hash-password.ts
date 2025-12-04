import { InternalServerErrorException } from '@nestjs/common';
import * as argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new InternalServerErrorException('Failed to hash password');
  }
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hashed, plain);
  } catch (err) {
    console.error('Error verifying password:', err);
    throw new InternalServerErrorException('Failed to verify password');
  }
}

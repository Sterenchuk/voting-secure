import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (P2002)
    if (error.code === 'P2002') {
      const targets = Array.isArray(error.meta?.target)
        ? error.meta.target
        : error.meta?.target
          ? [error.meta.target]
          : [];

      const fields = targets.length > 0 ? targets.join(', ') : 'unknown field';

      if (targets.includes('email')) {
        throw new ConflictException(`Email in ${context} is already taken.`);
      }

      throw new ConflictException(
        `Unique constraint violated in ${context}: ${fields}`,
      );
    }

    // Other known Prisma errors
    console.error(`Prisma error (${error.code}) in ${context}:`, error);
    throw new InternalServerErrorException(`Could not complete ${context}`);
  }

  // Non-Prisma or unknown errors
  console.error(`Unexpected error in ${context}:`, error);
  throw new InternalServerErrorException(`Could not complete ${context}`);
}

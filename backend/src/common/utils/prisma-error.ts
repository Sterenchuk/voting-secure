import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    // --- Rewritten error handler for use directly in the service ---
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === 'P2002') {
        const targets = Array.isArray(error.meta?.target)
          ? error.meta?.target
          : [error.meta?.target].filter(Boolean);

        if (targets.includes('email')) {
          throw new ConflictException(`Email in ${context} is already taken.`);
        }

        throw new ConflictException(`Unique constraint violated in ${context}`);
      }

      // Add more specific Prisma error handling as needed using error.code...

      console.error(`Prisma error in ${context}:`, error);
      throw new InternalServerErrorException(`Could not complete ${context}`);
    }

    throw error as any;

    console.error(`Prisma error in ${context}:`, error);
    throw new InternalServerErrorException(`Could not complete ${context}`);
  }

  throw error as any;
}

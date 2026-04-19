import {
  HttpException,
} from '@nestjs/common';

/**
 * @deprecated Use global ExceptionsFilter instead. 
 * This function is kept for backward compatibility as requested by the user.
 * It attaches context to the error and rethrows it, letting the global filter handle it.
 */
export function handlePrismaError(error: unknown, context: string): never {
  if (error instanceof HttpException) {
    throw error;
  }

  if (error instanceof Error) {
    (error as any).context = context;
  }

  throw error;
}

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

@Catch()
export class ExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? (res as any).message || res : res;
      error = (res as any).error || exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const context = (exception as any).context ? ` in ${(exception as any).context}` : '';
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = `Unique constraint failed on: ${((exception.meta?.target as string[]) || []).join(', ')}${context}`;
          error = 'Conflict';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = `${(exception.meta?.cause as string) || 'Record not found'}${context}`;
          error = 'Not Found';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = `Foreign key constraint failed${context}`;
          error = 'Bad Request';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Database error ${exception.code}${context}`;
          error = 'Bad Request';
          break;
      }
    } else if (exception instanceof Error) {
      const msg = exception.message.toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('expired')) {
        status = HttpStatus.UNAUTHORIZED;
        error = 'Unauthorized';
      } else if (msg.includes('forbidden') || msg.includes('permission')) {
        status = HttpStatus.FORBIDDEN;
        error = 'Forbidden';
      } else if (msg.includes('not found')) {
        status = HttpStatus.NOT_FOUND;
        error = 'Not Found';
      } else if (msg.includes('invalid') || msg.includes('bad request') || msg.includes('validation')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
      }

      const context = (exception as any).context ? `[${(exception as any).context}] ` : '';
      message = `${context}${exception.message}`;
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        error = exception.name;
      }
    }

    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${exception instanceof Error ? exception.stack : JSON.stringify(exception)}`,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`);
    }

    response.status(status).json(responseBody);
  }
}

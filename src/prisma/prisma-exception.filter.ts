import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);
    const status = httpException.getStatus();

    response.status(status).json({
      statusCode: status,
      message: httpException.message,
      error: this.getErrorLabel(status),
    });
  }

  private toHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    if (exception.code === 'P2002') {
      return new ConflictException('Bu kayıt zaten mevcut.');
    }

    if (exception.code === 'P2025') {
      return new NotFoundException('Kayıt bulunamadı.');
    }

    return new InternalServerErrorException('Beklenmeyen bir hata oluştu.');
  }

  private getErrorLabel(status: number): string {
    if (status === 409) {
      return 'Conflict';
    }

    if (status === 404) {
      return 'Not Found';
    }

    return 'Internal Server Error';
  }
}

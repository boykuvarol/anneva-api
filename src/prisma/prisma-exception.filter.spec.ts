import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

type ResponseMock = {
  status: jest.MockedFunction<(statusCode: number) => ResponseMock>;
  json: jest.MockedFunction<(body: unknown) => ResponseMock>;
};

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let response: ResponseMock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    response = {
      status: jest.fn<ResponseMock, [number]>().mockReturnThis(),
      json: jest.fn<ResponseMock, [unknown]>().mockReturnThis(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as ArgumentsHost;
  });

  it('maps Prisma P2002 errors to 409 Conflict', () => {
    filter.catch(createPrismaError('P2002'), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Bu kayıt zaten mevcut.',
      error: 'Conflict',
    });
  });

  it('maps Prisma P2025 errors to 404 Not Found', () => {
    filter.catch(createPrismaError('P2025'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Kayıt bulunamadı.',
      error: 'Not Found',
    });
  });
});

function createPrismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

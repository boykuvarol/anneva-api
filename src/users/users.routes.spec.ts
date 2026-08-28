import { METHOD_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller';

describe('Users routes', () => {
  it('does not expose public GET /users', () => {
    expect(getRouteHandlers()).not.toContain('GET');
  });

  it('does not expose public POST /users', () => {
    expect(getRouteHandlers()).not.toContain('POST');
  });
});

function getRouteHandlers(): string[] {
  const prototype = UsersController.prototype;

  return Object.getOwnPropertyNames(prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .map((propertyName) => {
      const method: unknown = Reflect.getMetadata(
        METHOD_METADATA,
        prototype[propertyName as keyof UsersController],
      );

      return method;
    })
    .filter((method): method is number => typeof method === 'number')
    .map((method) => (method === 0 ? 'GET' : method === 1 ? 'POST' : 'OTHER'));
}

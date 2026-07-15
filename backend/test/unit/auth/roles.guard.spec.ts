import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../../src/shared/constants/metadata-keys';
import { RolesGuard } from '../../../src/shared/guards/roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const createContext = (user?: { role: UserRole }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows access when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.LEGAL_ADMIN,
      UserRole.LEGAL_MANAGER,
    ]);

    expect(
      guard.canActivate(
        createContext({ role: UserRole.LEGAL_MANAGER } as never),
      ),
    ).toBe(true);
  });

  it('denies access when user role is not allowed', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.LEGAL_ADMIN]);

    expect(() =>
      guard.canActivate(createContext({ role: UserRole.VIEWER } as never)),
    ).toThrow(ForbiddenException);
  });

  it('denies access when user context is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.LEGAL_ADMIN]);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('reads roles metadata from handler and class', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createContext();

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});

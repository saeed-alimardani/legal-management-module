import { ConfigService } from '@nestjs/config';

export function createMockConfigService(
  timezone = 'Asia/Tehran',
): jest.Mocked<Pick<ConfigService, 'get'>> {
  return {
    get: jest.fn().mockReturnValue(timezone),
  };
}

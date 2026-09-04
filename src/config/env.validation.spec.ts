import { envValidation } from './env.validation';

describe('envValidation', () => {
  it('creates ephemeral secrets for local development', () => {
    const config = envValidation({ NODE_ENV: 'development', PORT: '3001' });

    expect(config.PORT).toBe(3001);
    expect(config.JWT_ACCESS_SECRET).toHaveLength(64);
    expect(config.JWT_REFRESH_SECRET).toHaveLength(64);
    expect(config.IP_HASH_SECRET).toHaveLength(64);
  });

  it('rejects missing production configuration', () => {
    expect(() => envValidation({ NODE_ENV: 'production' })).toThrow(
      'Missing production environment variables',
    );
  });

  it('rejects an access token lifetime above the security maximum', () => {
    expect(() =>
      envValidation({
        NODE_ENV: 'development',
        JWT_ACCESS_TTL_SECONDS: '3600',
      }),
    ).toThrow('Invalid environment configuration');
  });
});

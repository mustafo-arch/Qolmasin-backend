import { readAdminSeedConfig } from './admin-seed.validation';

const validEnvironment = {
  SEED_ADMIN_EMAIL: ' Admin@Example.com ',
  SEED_ADMIN_PHONE: '+998901234567',
  SEED_ADMIN_PASSWORD: 'Strong-Admin-2026!',
  SEED_ADMIN_NAME: ' Platform Admin ',
};

describe('readAdminSeedConfig', () => {
  it('normalizes valid admin seed values', () => {
    expect(readAdminSeedConfig(validEnvironment)).toEqual({
      email: 'admin@example.com',
      phone: '+998901234567',
      password: 'Strong-Admin-2026!',
      fullName: 'Platform Admin',
    });
  });

  it('fails closed when any required value is missing', () => {
    expect(() =>
      readAdminSeedConfig({ ...validEnvironment, SEED_ADMIN_PHONE: '' }),
    ).toThrow('SEED_ADMIN_PHONE');
  });

  it('rejects a weak admin password', () => {
    expect(() =>
      readAdminSeedConfig({
        ...validEnvironment,
        SEED_ADMIN_PASSWORD: 'weakpassword',
      }),
    ).toThrow('SEED_ADMIN_PASSWORD');
  });

  it('rejects a non-E.164 phone number', () => {
    expect(() =>
      readAdminSeedConfig({
        ...validEnvironment,
        SEED_ADMIN_PHONE: '998901234567',
      }),
    ).toThrow('SEED_ADMIN_PHONE');
  });
});

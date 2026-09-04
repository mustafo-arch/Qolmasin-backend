export interface AdminSeedConfig {
  email: string;
  phone: string;
  password: string;
  fullName: string;
}

export function readAdminSeedConfig(
  environment: NodeJS.ProcessEnv,
): AdminSeedConfig {
  const email = environment.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const phone = environment.SEED_ADMIN_PHONE?.trim();
  const password = environment.SEED_ADMIN_PASSWORD;
  const fullName = environment.SEED_ADMIN_NAME?.trim();
  const missing = [
    ['SEED_ADMIN_EMAIL', email],
    ['SEED_ADMIN_PHONE', phone],
    ['SEED_ADMIN_PASSWORD', password],
    ['SEED_ADMIN_NAME', fullName],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required admin seed variables: ${missing.join(', ')}`,
    );
  }

  if (email!.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email!)) {
    throw new Error('SEED_ADMIN_EMAIL is invalid');
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone!)) {
    throw new Error('SEED_ADMIN_PHONE must use E.164 format');
  }
  if (fullName!.length < 2 || fullName!.length > 120) {
    throw new Error(
      'SEED_ADMIN_NAME must contain between 2 and 120 characters',
    );
  }
  if (
    password!.length < 14 ||
    password!.length > 128 ||
    !/[a-z]/.test(password!) ||
    !/[A-Z]/.test(password!) ||
    !/\d/.test(password!) ||
    !/[^A-Za-z0-9]/.test(password!)
  ) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be 14-128 characters and include uppercase, lowercase, number, and symbol',
    );
  }

  return {
    email: email!,
    phone: phone!,
    password: password!,
    fullName: fullName!,
  };
}

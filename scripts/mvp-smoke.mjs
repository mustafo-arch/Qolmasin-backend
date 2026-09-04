import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000/api/v1';

async function loadEnvironment() {
  const content = await readFile(new URL('../.env', import.meta.url), 'utf8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function api(path, { method = 'GET', token, body } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `${method} ${baseUrl}${path} network request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

async function reserveRaw(token, offerId) {
  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ items: [{ offerId, quantity: 1 }] }),
  });
  return {
    status: response.status,
    payload: await response.json().catch(() => null),
  };
}

async function main() {
  const environment = await loadEnvironment();
  const suffix = randomUUID().slice(0, 8);
  const admin = await api('/auth/login', {
    method: 'POST',
    body: {
      identifier: environment.SEED_ADMIN_EMAIL,
      password: environment.SEED_ADMIN_PASSWORD,
      deviceName: 'MVP smoke test',
    },
  });
  const adminToken = admin.accessToken;

  const category = await api('/admin/categories', {
    method: 'POST',
    token: adminToken,
    body: { name: `MVP Bakery ${suffix}`, slug: `mvp-bakery-${suffix}` },
  });
  const business = await api('/businesses', {
    method: 'POST',
    token: adminToken,
    body: { name: `MVP Business ${suffix}`, type: 'BAKERY' },
  });
  const branch = await api(`/businesses/${business.id}/branches`, {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'MVP Main Branch',
      address: '1 MVP Test Street',
      countryCode: 'UZ',
      city: 'Tashkent',
      latitude: 41.311081,
      longitude: 69.240562,
      timezone: 'Asia/Tashkent',
      currency: 'UZS',
      openingTime: '08:00',
      closingTime: '22:00',
    },
  });
  await api(`/businesses/${business.id}/submit-verification`, {
    method: 'POST',
    token: adminToken,
  });
  await api(`/admin/businesses/${business.id}/review`, {
    method: 'POST',
    token: adminToken,
    body: { status: 'VERIFIED' },
  });
  const product = await api(`/businesses/${business.id}/products`, {
    method: 'POST',
    token: adminToken,
    body: { categoryId: category.id, name: `MVP Bread ${suffix}` },
  });
  await api(`/businesses/${business.id}/products/${product.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE' },
  });

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'ignored-name.png');
  form.set('sortOrder', '0');
  const uploadResponse = await fetch(
    `${baseUrl}/businesses/${business.id}/products/${product.id}/images`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: form,
    },
  );
  const image = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(`Image upload failed: ${JSON.stringify(image)}`);
  }
  const mediaResponse = await fetch(image.url);
  if (!mediaResponse.ok || mediaResponse.headers.get('content-type') !== 'image/png') {
    throw new Error('Uploaded media could not be read back safely');
  }

  const now = Date.now();
  const offerInput = {
    branchId: branch.id,
    productId: product.id,
    originalPrice: '20000.00',
    discountPrice: '10000.00',
    quantity: 5,
    pickupStart: new Date(now - 60_000).toISOString(),
    pickupEnd: new Date(now + 60 * 60_000).toISOString(),
    expiresAt: new Date(now + 65 * 60_000).toISOString(),
  };
  const offer = await api(`/businesses/${business.id}/offers`, {
    method: 'POST',
    token: adminToken,
    body: offerInput,
  });
  await api(`/businesses/${business.id}/offers/${offer.id}/publish`, {
    method: 'POST',
    token: adminToken,
  });
  const nearby = await api(
    `/offers/nearby?lat=41.311081&lng=69.240562&radius=5&minDiscount=40`,
  );
  if (!nearby.data.some((item) => item.id === offer.id)) {
    throw new Error('Published offer was not returned by nearby search');
  }

  const customerPassword = `Customer-${suffix}-9!Aa`;
  const customer = await api('/auth/register', {
    method: 'POST',
    body: {
      fullName: 'MVP Customer',
      phone: `+1555${Date.now().toString().slice(-7)}`,
      email: `mvp-${suffix}@example.com`,
      password: customerPassword,
      deviceName: 'MVP smoke test',
    },
  });
  const customerToken = customer.accessToken;
  const order = await api('/orders', {
    method: 'POST',
    token: customerToken,
    body: { items: [{ offerId: offer.id, quantity: 2 }] },
  });
  await api(`/businesses/${business.id}/orders/${order.id}/ready`, {
    method: 'POST',
    token: adminToken,
  });
  const completed = await api(
    `/businesses/${business.id}/orders/${order.id}/complete`,
    {
      method: 'POST',
      token: adminToken,
      body: { pickupCode: order.pickupCode },
    },
  );
  if (completed.status !== 'COMPLETED') {
    throw new Error('Pickup did not complete the order');
  }

  const raceOffer = await api(`/businesses/${business.id}/offers`, {
    method: 'POST',
    token: adminToken,
    body: { ...offerInput, quantity: 1 },
  });
  await api(`/businesses/${business.id}/offers/${raceOffer.id}/publish`, {
    method: 'POST',
    token: adminToken,
  });
  const race = await Promise.all([
    reserveRaw(customerToken, raceOffer.id),
    reserveRaw(customerToken, raceOffer.id),
  ]);
  const winner = race.find((result) => result.status === 201);
  const loser = race.find((result) => result.status === 409);
  if (!winner || !loser || loser.payload?.code !== 'INVENTORY_UNAVAILABLE') {
    throw new Error(`Atomic inventory race failed: ${JSON.stringify(race)}`);
  }
  await api(`/orders/${winner.payload.id}/cancel`, {
    method: 'POST',
    token: customerToken,
  });

  console.info(
    JSON.stringify({
      status: 'ok',
      upload: 'verified',
      nearby: 'verified',
      order: completed.status,
      atomicInventory: 'one-winner-one-rejected',
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

# Qolmasin Backend

Qolmasin marketplace uchun NestJS, Prisma va PostgreSQL asosidagi modular monolith backend.

## Talablar

- Node.js 24+
- npm 11+
- PostgreSQL

## Lokal ishga tushirish

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run local:setup
npm run start:dev
```

`local:setup` Docker Compose orqali PostgreSQL 17 containerni ko‘taradi, migrationlarni qo‘llaydi va faqat admin seedni ishga tushiradi. Database faqat `127.0.0.1:5432` orqali ochiladi va ma'lumot `postgres_data` Docker volume ichida saqlanadi. To‘xtatish uchun `npm run docker:down`, loglar uchun `npm run docker:logs` ishlating.

`.env` ichidagi placeholder secretlarni kamida 32 baytli alohida random qiymatlar bilan almashtiring. Secretlar va `.env` gitga commit qilinmaydi.

## API

Asosiy prefix: `/api/v1`

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/alerts`
- `GET /api/v1/alerts`
- `PATCH /api/v1/alerts/:alertId`
- `DELETE /api/v1/alerts/:alertId`
- `POST /api/v1/businesses`
- `GET /api/v1/businesses/mine`
- `PATCH /api/v1/businesses/:businessId`
- `POST /api/v1/businesses/:businessId/submit-verification`
- `GET /api/v1/admin/businesses?status=PENDING_REVIEW`
- `POST /api/v1/admin/businesses/:businessId/review`
- `GET /api/v1/admin/audit-logs`
- `POST /api/v1/businesses/:businessId/members`
- `GET /api/v1/businesses/:businessId/members`
- `POST /api/v1/businesses/:businessId/branches`
- `GET /api/v1/businesses/:businessId/branches`
- `POST /api/v1/businesses/:businessId/products`
- `GET /api/v1/businesses/:businessId/products`
- `PATCH /api/v1/businesses/:businessId/products/:productId`
- `POST /api/v1/businesses/:businessId/products/:productId/images`
- `GET /api/v1/products/:productId`
- `POST /api/v1/businesses/:businessId/offers`
- `GET /api/v1/businesses/:businessId/offers`
- `PATCH /api/v1/businesses/:businessId/offers/:offerId`
- `POST /api/v1/businesses/:businessId/offers/:offerId/publish`
- `POST /api/v1/businesses/:businessId/offers/quick`
- `POST /api/v1/businesses/:businessId/offers/:offerId/discount-schedules`
- `POST /api/v1/businesses/:businessId/offers/:offerId/cancel`
- `GET /api/v1/offers`
- `GET /api/v1/offers/nearby`
- `GET /api/v1/offers/ending-soon`
- `GET /api/v1/offers/biggest-discounts`
- `GET /api/v1/offers/new`
- `GET /api/v1/offers/popular`
- `GET /api/v1/offers/recommended`
- `GET /api/v1/offers/:offerId/price-history`
- `GET /api/v1/offers/:offerId`
- `GET /api/v1/businesses/public/:slug`
- `GET /api/v1/branches/:branchId`
- `POST /api/v1/orders`
- `GET /api/v1/orders/mine`
- `GET /api/v1/orders/:orderId`
- `POST /api/v1/orders/:orderId/cancel`
- `GET /api/v1/businesses/:businessId/orders`
- `POST /api/v1/businesses/:businessId/orders/:orderId/ready`
- `POST /api/v1/businesses/:businessId/orders/:orderId/complete`
- `GET /api/v1/businesses/:businessId/reviews`
- `POST /api/v1/businesses/:businessId/reviews`
- `POST /api/v1/reports`
- `GET /api/v1/admin/reports`
- `POST /api/v1/admin/reports/:reportId/resolve`
- `GET /api/v1/admin/price-anomalies`
- `POST /api/v1/admin/price-anomalies/:anomalyId/resolve`
- `POST /api/v1/admin/offers/:offerId/hide`
- `POST /api/v1/admin/offers/:offerId/unhide`
- `GET /api/v1/analytics/me/impact`
- `GET /api/v1/businesses/:businessId/analytics/overview`
- `GET /api/v1/categories`
- `GET /api/v1/products`
- `GET /health`

## MVP holati

Backend MVP ning asosiy rezerv/pickup oqimi mavjud:

```text
register/login -> business verification -> branch -> product -> offer publish
-> nearby search -> reservation -> pickup code -> COMPLETED
```

MVP checklist va qolgan release ishlar [md/QOLMASIN_MVP_STATUS.md](md/QOLMASIN_MVP_STATUS.md) faylida.

Development Swagger: `/api/docs`

Access token response bodyda qaytadi va frontend memoryda saqlanadi. Refresh token faqat `httpOnly` cookie orqali beriladi; database raw tokenni saqlamaydi.

Business review endpointi faqat `MODERATOR`, `ADMIN` va `SUPER_ADMIN` rollari uchun ochiq. Ruxsat etilgan status o'tishlari backendda majburiy tekshiriladi. Business, membership va admin category o'zgarishlari audit logga asosiy amal bilan bir DB tranzaksiyada yoziladi. Auditda raw IP emas, `IP_HASH_SECRET` orqali olingan HMAC fingerprint saqlanadi.

Email verification va password-reset tokenlari ham raw ko‘rinishda saqlanmaydi. Ular bir marta ishlaydi, expiry muddatiga ega va aynan so‘ralgan emailga bog‘langan. Password reset barcha aktiv sessiyalarni revoke qiladi.

Email yuborish uchun `.env` ichida quyidagilarni sozlang:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-16-character-google-app-password
EMAIL_FROM=Qolmasin <your-account@gmail.com>
EMAIL_TOKEN_SECRET=at-least-32-bytes-random-secret
```

Gmail uchun `SMTP_PORT=587` va `SMTP_SECURE=false` STARTTLS rejimini ishlatadi. `SMTP_PASS` oddiy Gmail paroli emas, Google App Password bo‘lishi kerak. `resend-verification` endpointi account enumerationni oldini olish uchun email xatosida ham `202 Accepted` qaytaradi; SMTP muammosi server logida ko‘rinadi.

## Tekshiruvlar

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

## Production migration

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run build
npm run start:prod
```

Productionda `DATABASE_URL`, `FRONTEND_URL`, JWT secretlar, `IP_HASH_SECRET`, `EMAIL_TOKEN_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` va `EMAIL_FROM` majburiy.

`prisma:seed` faqat bitta `ADMIN` akkauntini idempotent yaratadi yoki yangilaydi; kategoriya va demo ma'lumot yaratmaydi. Barcha `SEED_ADMIN_*` qiymatlari majburiy va default credential mavjud emas. Admin paroli 14-128 belgidan iborat bo‘lib, katta-kichik harf, raqam va maxsus belgi saqlashi shart. Parol o‘zgarsa oldingi sessiyalar revoke qilinadi va amal audit logga yoziladi.

Arxitektura va biznes talablari [md/QOLMASIN_BACKEND_AGENT.md](md/QOLMASIN_BACKEND_AGENT.md) faylida.

Frontendlar vazifasi, sahifalari, rollari va backend bilan ishlash oqimi [md/QOLMASIN_FRONTENDS_OVERVIEW.md](md/QOLMASIN_FRONTENDS_OVERVIEW.md) faylida.

# Qolmasin MVP status

## Tayyor qismlar

- JWT access token, httpOnly refresh cookie, rotation va revoke;
- Argon2 password hash, email verification va password reset;
- role va business ownership authorization;
- business verification va audit log;
- branches, categories, products va product image upload;
- public products, businesses, branches va offers;
- radius bo‘yicha nearby offers;
- transaction/serializable inventory reservation;
- reservation expiry va offer expiry;
- favorites va notifications;
- offer type, quantity unit, regular/reference price and price history;
- quick offer, scheduled dynamic discounts and ending-soon/home feed endpoints;
- nearby filters: max price, business type, search and ending soon;
- pickup-window enforcement, active-reservation cancellation protection and staff permissions;
- verified-purchase reviews, inaccurate-content reports and moderation queues;
- customer savings/impact and business sales/inventory analytics;
- personal deal alerts with location/radius, category, product, price and discount filters;
- validation, rate limiting, helmet, CORS, request ID va Swagger;
- unit tests, typecheck, lint va build.

## MVP Definition of Done

1. Customer register/login qiladi.
2. Business owner business va branch yaratadi.
3. Admin/moderator businessni `VERIFIED` qiladi.
4. Manager active category asosida product yaratadi.
5. Manager offer yaratadi va publish qiladi.
6. Customer public yoki nearby offerlarni ko‘radi.
7. Customer offerni atomik inventory reservation bilan buyurtma qiladi.
8. Business orderni `READY` qiladi.
9. Pickup code tekshiriladi va order `COMPLETED` bo‘ladi.

## Release oldidan qoladigan ishlar

- production PostgreSQL backup strategy and migration deployment;
- Supabase Storage yoki production storage konfiguratsiyasi;
- SMTP orqali verification/reset emailni tekshirish;
- Render deploy va Vercel frontend ulanishi;
- frontend customer/business ekranlarini API bilan ulash;
- production secrets, HTTPS, CORS origin va monitoring sozlamalari;
- manual acceptance test: expired reservation, wrong pickup code, parallel reservation va permission boundary.

## Keyingi product phases

Quyidagi ishlar backend MVP va Priority 1–3 dan keyingi alohida phase sifatida qoladi:

- payment, commission, promo-code va subscription;
- push/email delivery uchun production provider;
- farmer supply, B2B procurement va delivery integratsiyalari;
- bundle deal, referral/loyalty va advanced personalization;
- optional `weightGrams` asosidagi waste-impact hisoboti.

Review, reports, analytics, dynamic discount, price safety va personal deal alerts foundationlari implement qilingan.

## Tekshiruv natijasi

Lokal PostgreSQL bilan migrationlar deploy qilindi. Yakuniy typecheck, lint, build, unit/e2e test va MVP smoke test release oldidan qayta ishga tushiriladi.

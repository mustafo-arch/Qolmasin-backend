# Qolmasin backend audit

Audit repositorydagi real NestJS, Prisma va migration kodiga asoslangan. Statuslar:

- `DONE` — talab to‘liq ishlangan;
- `PARTIAL` — foundation bor, lekin product/production ishlari qolgan;
- `MISSING` — hozircha implement qilinmagan;
- `NEEDS_FIX` — mavjud qismda muhim texnik muammo bor.

## 1. Existing architecture

- NestJS modular monolith: auth, businesses, members, branches, categories, products, uploads, offers, orders, favorites, notifications, reviews, alerts va analytics modullari.
- Prisma ORM + PostgreSQL; schema o‘zgarishlari alohida forward-only migrationlar bilan boshqariladi.
- JWT access token, httpOnly refresh cookie, session rotation/revoke va auth version ishlatiladi.
- Business ownership/member role va permission boundary `BusinessAccessService` orqali tekshiriladi.
- Global validation pipe, helmet, CORS, request ID, exception filter, Swagger va Throttler mavjud.

## 2. Feature status

| Feature | Status | Evidence |
|---|---|---|
| Auth va session security | `DONE` | JWT, refresh rotation, Argon2, verification/reset |
| Business verification | `DONE` | DRAFT/PENDING_REVIEW/VERIFIED/REJECTED/SUSPENDED |
| Branch location/hours | `DONE` | latitude, longitude, timezone, opening/closing |
| Exact product marketplace | `DONE` | product name, image, unit, regular price |
| Nearby/Radar | `DONE` | Haversine SQL, radius/category/discount/price/type/search filters |
| Real stock/reservation race safety | `DONE` | serializable transaction, retry, stock invariant |
| Pickup code flow | `DONE` | READY → COMPLETED, hash, attempt limit, one-time usage |
| Quick offer | `DONE` | existing productdan offer yaratish endpointi |
| Offer types and labels | `DONE` | OfferType enum va public label |
| Dynamic discount | `DONE` | DiscountSchedule va current-time price resolution |
| Expiry/pickup safety | `DONE` | publish/order filters, automatic expiry, best-before validation |
| Fake discount protection | `DONE` | reference price, PriceHistory, configurable anomaly threshold, moderation queue |
| Personal deal alerts | `DONE` | category/product/radius/minDiscount/maxPrice, publish notification |
| Favorite business alert | `DONE` | favorite businessga yangi offer notificationi |
| Ending soon/low stock sections | `DONE` | endpoints va dynamic badges |
| Home feed endpoints | `DONE` | nearby, ending-soon, biggest-discounts, new, popular, recommended |
| Reviews | `DONE` | completed order va unique user/business cheklovi |
| Reports/moderation | `DONE` | report reasonlari, admin queue, resolve/dismiss |
| Customer savings/impact | `DONE` | completed orders asosida savings/rescued items |
| Business analytics | `DONE` | active/sold/completed/revenue/discount/expired/conversion signals |
| Favorites API | `DONE` | add/remove/list va ownership-safe query |
| Farmer/market/manufacturer types | `DONE` | BusinessType enum va migration |
| Payment/commission/subscription | `MISSING` | MVP pickup flowda yo‘q |
| Delivery integration | `MISSING` | MVP pickup-only |
| Bundle/promo/referral/loyalty | `MISSING` | alohida product phase |
| Push notification provider | `PARTIAL` | in-app notification bor, provider integration qolgan |
| Waste weight/CO2 impact | `PARTIAL` | rescued item bor, weight optional model kiritilmagan |

## 3. Missing features

Keyingi phase uchun payment, commission, promo-code, subscription, delivery, bundle deal, referral/loyalty, push provider va B2B procurement kerak. Advanced personalized recommendation hozir rule-based popular feed bilan cheklangan. `weightGrams` asosidagi impact ham optional bo‘lgani uchun qo‘shilmagan.

## 4. Security review

MVP xavfsizlik chegaralari backendda majburiy: business boshqa business offerini o‘zgartira olmaydi; staff permissionlari alohida tekshiriladi; order total frontenddan olinmaydi; pickup window, expiry va available stock transaction ichida tekshiriladi; pickup code hash ko‘rinishida saqlanadi; report/review targetlari serverda tekshiriladi; audit loglarda raw IP emas, hash ishlatiladi.

Production oldidan secret rotation, HTTPS, real CORS origin, SMTP/storage credentials, backup va monitoring sozlamalari bajarilishi shart.

## 5. Database/schema review

Schema yangi `PriceHistory`, `PriceAnomaly`, `DiscountSchedule`, `BusinessReview`, `BusinessReport` va `DealAlert` modellarini qo‘shdi. Mavjud ma’lumotni o‘chirmaydigan migrationlar ishlatilgan. Asosiy relation va FK delete policylar mavjud. Offer status/pickup, product, price history, order, reservation va favorites uchun kerakli indexlar mavjud.

`DealAlert` radius hisoblash uchun alert yaratilgan nuqtaning latitude/longitude qiymatlarini saqlaydi. PostgreSQL migrationlar lokal database’da deploy qilingan.

## 6. Performance/index review

Nearby query frontend uchun butun DB include qilmaydi; parametrli SQL, pagination, Haversine va `COUNT(*) OVER()` ishlatadi. Dynamic schedule current price subquery orqali olinadi. Analytics aggregate querylardan foydalanadi. Deal alert matching MVPda enabled alertlar bo‘yicha application-side filter qiladi; alertlar ko‘payganda PostGIS/spatial index yoki event/search indexga ko‘chirish kerak.

## 7. MVP uchun kritik kamchiliklar

Kod oqimi ishlaydi. Release blockerlar asosan infrastructure/product integration: production PostgreSQL backup/migration, production object storage, SMTP verification/reset, Render/Vercel deployment, frontend ekranlari va manual acceptance testlar.

## 8. Birinchi qilinadigan ishlar

1. Production env secretlarini alohida yaratish va rotation policy o‘rnatish.
2. PostgreSQL backup/restore test va migration deploy pipeline sozlash.
3. Storage va SMTP providerni ulash.
4. Frontendni `/offers/nearby`, `/alerts`, `/orders` va business dashboard endpointlariga ulash.
5. Expired reservation, wrong pickup code, parallel reservation, staff permission va fake discount acceptance testlarini production-like muhitda bajarish.

## 9. Phase 1–6 implementation order

- Phase 1 — `DONE`: auth, business, branch, category, product, image, offer.
- Phase 2 — `DONE`: nearby, stock, reservation, pickup, quick offer, expiry safety.
- Phase 3 — `DONE`: favorites, in-app notifications, verified reviews, reports va deal alerts.
- Phase 4 — `DONE`: price history, anomaly review, dynamic discount foundation va analytics.
- Phase 5 — `MISSING`: payment/commission, bundle, promo, referral/loyalty va advanced personalization.
- Phase 6 — `MISSING`: farmer supply, B2B procurement, delivery va external integrations.

## 10. Tavsiya etilgan o‘zgaradigan fayllar

Phase 1–4 uchun asosiy fayllar: `prisma/schema.prisma`, `prisma/migrations/*`, `src/modules/offers/offers.service.ts`, `src/modules/orders/orders.service.ts`, `src/modules/reviews/*`, `src/modules/alerts/*`, `src/modules/analytics/*`, `src/modules/notifications/*`, `src/modules/businesses/businesses.service.ts`, `src/modules/audit/audit.constants.ts`, `README.md` va `md/QOLMASIN_MVP_STATUS.md`.

Phase 5–6 boshlanganda yangi modullar sifatida payment/commission, promotions/referrals, supply/procurement va delivery adapterlar ajratilishi tavsiya qilinadi; mavjud reserve → pickup oqimini sababsiz rewrite qilish kerak emas.

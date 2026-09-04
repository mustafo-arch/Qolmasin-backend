# QOLMASIN — BACKEND AGENT SPECIFICATION

## 1. Agent roli

Sen **20+ yillik production backend tajribasiga ega Senior/Staff Backend Architect va NestJS Engineer** sifatida ishlaysan.

Sening vazifang shunchaki endpoint yozish emas. Sen:

- scalable backend arxitektura qurishing;
- xavfsiz authentication va authorization yaratishing;
- PostgreSQL sxemasini to‘g‘ri loyihalashing;
- kodni modullarga ajratishing;
- biznes qoidalarini backendda majburiy tekshirishing;
- production deployga tayyor kod yozishing;
- performance, security, logging, error handling va abuse preventionni hisobga olishing;
- kelajakda multi-city va multi-country kengayishni buzmaydigan arxitektura yaratishing kerak.

Har qanday kod yozishdan oldin mavjud loyiha strukturasini tekshir.

Mavjud ishlaydigan kodni sababsiz qayta yozma.

Backward compatibilityni saqla.

---

# 2. Loyiha haqida

**Qolmasin** — sotilmay qolayotgan yoki kun oxirida ortib qolayotgan mahsulotlarni xaridorlarga chegirmali narxda taklif qiluvchi marketplace.

Boshlang‘ich kategoriyalar:

- restoran;
- kafe;
- nonvoyxona;
- konditer;
- supermarket;
- bozor sotuvchisi;
- fermer;
- catering / to‘yxona;
- boshqa oziq-ovqat bizneslari.

Kelajakda platforma boshqa surplus mahsulot kategoriyalariga kengayishi mumkin.

Asosiy oqim:

```text
Business
   ↓
Branch
   ↓
Product
   ↓
Offer
   ↓
Customer Order / Reservation
   ↓
Pickup
   ↓
Completed
```

---

# 3. Asosiy stack

## Backend

- Node.js — current production LTS
- TypeScript
- NestJS
- REST API
- Prisma ORM
- PostgreSQL
- Swagger / OpenAPI
- class-validator
- class-transformer
- Passport
- JWT
- cookie-parser
- Helmet
- @nestjs/throttler
- Argon2

## Database

Asosiy database:

```text
PostgreSQL
```

Provider sifatida:

```text
Supabase PostgreSQL
```

yoki:

```text
Neon PostgreSQL
```

ishlatilishi mumkin.

Backend database providerga qattiq bog‘lanmasin.

Database access faqat Prisma orqali boshqarilsin.

## File Storage

MVP:

```text
Supabase Storage
```

Kelajakda:

```text
Cloudflare R2
AWS S3
```

ga ko‘chirish mumkin bo‘lsin.

Rasm binary fayllarini PostgreSQL ichiga saqlama.

Database faqat:

```text
url
storageKey
mimeType
size
```

kabi metadata saqlasin.

## Deploy

Backend:

```text
Render
```

Frontend:

```text
Vercel
```

Database:

```text
Supabase / Neon
```

Storage:

```text
Supabase Storage
```

---

# 4. Arxitektura usuli

Boshlanishida:

```text
MODULAR MONOLITH
```

ishlat.

Hozir microservice yaratma.

Har bir biznes sohasi alohida NestJS module bo‘lsin.

Tavsiya qilinadigan struktura:

```text
src/
├── app.module.ts
├── main.ts
│
├── config/
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   ├── constants/
│   ├── enums/
│   ├── types/
│   └── utils/
│
├── infrastructure/
│   ├── prisma/
│   ├── storage/
│   ├── cache/
│   ├── queue/
│   └── notifications/
│
└── modules/
    ├── auth/
    ├── users/
    ├── businesses/
    ├── business-members/
    ├── branches/
    ├── categories/
    ├── products/
    ├── offers/
    ├── orders/
    ├── payments/
    ├── locations/
    ├── uploads/
    ├── favorites/
    ├── reviews/
    ├── notifications/
    ├── reports/
    ├── support/
    ├── promo-codes/
    ├── subscriptions/
    ├── commissions/
    ├── analytics/
    ├── audit/
    └── admin/
```

---

# 5. Rollar

Asosiy rollar:

```ts
CUSTOMER
BUSINESS_OWNER
BUSINESS_STAFF
MODERATOR
ADMIN
SUPER_ADMIN
```

## CUSTOMER

Qila oladi:

- register/login;
- profilini boshqarish;
- lokatsiya berish;
- yaqin offerlarni ko‘rish;
- qidirish;
- filter qilish;
- favorite;
- rezerv/order;
- pickup code olish;
- order history;
- review;
- report;
- notification.

## BUSINESS_OWNER

Qila oladi:

- business yaratish;
- branch yaratish;
- staff qo‘shish;
- product yaratish;
- offer yaratish;
- inventory boshqarish;
- orderlarni ko‘rish;
- pickup tasdiqlash;
- analytics ko‘rish;
- business settings boshqarish.

## BUSINESS_STAFF

Faqat ruxsat berilgan branch/business doirasida:

- offerlarni ko‘rish;
- orderlarni ko‘rish;
- pickup code tekshirish;
- orderni complete qilish;
- inventoryni yangilash.

Sensitive settingsga kira olmaydi.

## MODERATOR

- business verification;
- content moderation;
- reportlarni ko‘rish;
- suspicious offerlarni tekshirish;
- business/userni vaqtincha suspend qilish.

## ADMIN

- users;
- businesses;
- branches;
- categories;
- orders;
- reports;
- promo;
- commission;
- analytics;
- moderation.

## SUPER_ADMIN

Global platform configuration:

- admin management;
- permissions;
- countries;
- currencies;
- payment providers;
- platform commission;
- feature flags;
- critical system settings.

---

# 6. Authorization

Faqat role-based guard bilan cheklanma.

RBAC + permission modelga tayyor arxitektura qil.

Misollar:

```text
business:create
business:update
branch:create
branch:update

offer:create
offer:update
offer:delete

order:read
order:complete

staff:create
staff:update

analytics:view

admin:user:suspend
admin:business:verify
```

Object ownership doimo backendda tekshirilsin.

Masalan BUSINESS_OWNER boshqa businessning offerini update qila olmasin.

Frontend yuborgan:

```text
businessId
branchId
ownerId
userId
```

qiymatlariga ko‘r-ko‘rona ishonma.

---

# 7. Authentication

## Password hashing

Password uchun:

```text
Argon2id
```

ishlat.

Plain password hech qachon databasega tushmasin.

Loglarda ham password/token chiqmasin.

## Access token

JWT Access Token:

```text
TTL = 15 minutes
```

Maksimum tavsiya:

```text
20 minutes
```

Access token frontend memoryda saqlansin.

LocalStorage'da access token saqlashni default yechim sifatida ishlatma.

JWT payload minimal bo‘lsin.

Masalan:

```json
{
  "sub": "user_uuid",
  "role": "CUSTOMER",
  "sessionId": "session_uuid",
  "authVersion": 1
}
```

Sensitive ma’lumot JWT ichiga qo‘yilmasin.

## Refresh token

Refresh token:

```text
TTL = 30 days
```

kerak bo‘lsa:

```text
7–30 days
```

oralig‘ida configurable qil.

Refresh token faqat:

```text
httpOnly cookie
```

orqali yuborilsin.

Cookie:

```ts
httpOnly: true
secure: production
sameSite: 'lax'
path: '/api/auth/refresh'
```

Frontend va backend cross-site deployment talab qilsa cookie policy environmentga mos sozlanadi.

Productionda HTTPS majburiy.

## Refresh token storage

Raw refresh tokenni databasega saqlama.

Hashini saqla.

Session jadvali bo‘lsin.

Misol:

```text
AuthSession

id
userId
refreshTokenHash
userAgent
ipHash
deviceName
expiresAt
revokedAt
createdAt
lastUsedAt
```

## Refresh rotation

Refresh endpoint chaqirilganda:

```text
old refresh token
      ↓
validate
      ↓
revoke / rotate
      ↓
new refresh token
```

ishlat.

Token reuse aniqlansa sessionni revoke qilishga tayyor arxitektura qil.

## Logout

Logout:

- current sessionni revoke qiladi;
- refresh cookie clear qiladi;
- access token frontenddan o‘chiriladi.

## Logout all devices

Endpoint bo‘lsin:

```text
POST /api/auth/logout-all
```

Bu userning barcha active sessionlarini revoke qiladi.

---

# 8. Auth Version

User modelida:

```text
authVersion Int @default(0)
```

saqlash mumkin.

Critical account change:

- password change;
- account compromise;
- admin security reset;

bo‘lganda:

```text
authVersion += 1
```

qilinadi.

Old JWTlar invalid bo‘lishi kerak.

---

# 9. Authentication endpointlar

Minimum:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/logout-all
GET  /api/auth/me
```

Keyinchalik:

```text
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/verify-phone
POST /api/auth/resend-code
```

---

# 10. Rate limiting

Global rate limit qo‘y.

Oddiy endpointlar uchun boshlang‘ich qiymat:

```text
100 requests / minute / IP
```

Lekin endpointga qarab alohida limit bo‘lsin.

## Login

```text
5 attempts / minute / IP
```

va account bo‘yicha ham limit.

Repeated failures uchun progressive cooldown qo‘shishga tayyor bo‘l.

## Register

```text
3–5 requests / hour / IP/device
```

## OTP

```text
3 sends / 10 minutes
```

va:

```text
5 verify attempts / code
```

## Refresh

Masalan:

```text
30 requests / minute / session
```

## Search

```text
60 requests / minute / user
```

## Upload

```text
10 uploads / minute / user
```

Rate limit qiymatlarini hardcode qilma.

Environment/config orqali boshqariladigan qil.

Distributed deployment boshlanganda Redis-backed throttlingga ko‘chirish mumkin bo‘lsin.

---

# 11. API abuse protection

Quyidagilarni hisobga ol:

- IP rate limiting;
- user rate limiting;
- session rate limiting;
- brute-force protection;
- payload size limit;
- file upload validation;
- MIME verification;
- pagination maximum;
- sorting whitelist;
- filtering whitelist;
- SQL injectionni Prisma orqali oldini olish;
- mass assignmentni DTO whitelist orqali to‘sish;
- account enumerationni kamaytirish;
- suspicious traffic logging.

---

# 12. Validation

Global ValidationPipe:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

ishlat.

Har bir request DTO bilan validatsiya qilinsin.

Controller ichida raw body bilan biznes logic yozma.

Misol:

```text
CreateOfferDto
UpdateOfferDto
CreateOrderDto
SearchOffersDto
PaginationDto
```

Narxlar:

```text
>= 0
```

Quantity:

```text
integer
>= 0
```

Discount price:

```text
discountPrice <= originalPrice
```

Pickup:

```text
pickupStart < pickupEnd
```

Expires:

```text
expiresAt > now
```

kabi biznes validationlar Service/Domain layerda ham tekshirilsin.

---

# 13. Error handling

Global Exception Filter yarat.

API response consistent bo‘lsin.

Misol:

```json
{
  "statusCode": 400,
  "code": "OFFER_INVALID_PRICE",
  "message": "Chegirma narxi oddiy narxdan katta bo‘lishi mumkin emas",
  "details": null,
  "timestamp": "2026-01-01T10:00:00.000Z",
  "path": "/api/offers"
}
```

Productionda:

- stack trace userga qaytarilmasin;
- Prisma internal error userga chiqmasin;
- database details leak qilinmasin.

---

# 14. Logging

Structured logging ishlat.

Minimum:

```text
requestId
userId
route
method
statusCode
duration
errorCode
```

Loglarda quyidagilar chiqmasin:

```text
password
accessToken
refreshToken
OTP
card data
secret key
cookie content
```

Har request uchun correlation/request ID bo‘lsin.

---

# 15. Database prinsiplar

Primary key:

```text
UUID
```

yoki productionda sortable ID kerak bo‘lsa UUIDv7 ko‘rib chiqilishi mumkin.

Barcha entitylarda:

```text
createdAt
updatedAt
```

bo‘lsin.

Kerak joylarda:

```text
deletedAt
```

soft delete ishlatilishi mumkin.

Pul uchun Float ishlatma.

Prisma:

```text
Decimal
```

yoki integer minor unit ishlat.

UZS holatida integer amount yetarli bo‘lishi mumkin.

Global platforma uchun tavsiya:

```text
amount
currency
```

modeli.

---

# 16. Multi-country tayyorgarligi

Boshidan quyidagilarni hisobga ol:

```text
Country
Region
City
District
Currency
Language
Timezone
```

Hardcode:

```text
UZS
Uzbekistan
Asia/Tashkent
```

qilma.

Default bo‘lishi mumkin, ammo database/arxitektura configurable bo‘lsin.

---

# 17. Business modeli

Business va Branch alohida.

```text
Business
   ├── Branch A
   ├── Branch B
   └── Branch C
```

Business:

```text
id
ownerId
name
slug
description
type
status
verifiedAt
createdAt
updatedAt
```

Branch:

```text
id
businessId
name
address
latitude
longitude
phone
timezone
status
openingTime
closingTime
createdAt
updatedAt
```

---

# 18. Business Member

Business va user orasida membership model bo‘lsin.

```text
BusinessMember

id
businessId
userId
role
status
createdAt
```

Kelajakda custom permissions uchun relation qo‘shishga tayyor bo‘l.

---

# 19. Product va Offer alohida

Bu majburiy.

## Product

Mahsulotning doimiy ma’lumoti.

```text
Product

id
businessId
categoryId
name
description
imageUrl
status
createdAt
updatedAt
```

## Offer

Ma’lum vaqt uchun sotuv taklifi.

```text
Offer

id
branchId
productId

originalPrice
discountPrice

quantity
reservedQuantity
soldQuantity

pickupStart
pickupEnd

status

publishedAt
expiresAt

createdAt
updatedAt
```

Statuslar:

```text
DRAFT
ACTIVE
LOW_STOCK
SOLD_OUT
EXPIRED
CANCELLED
```

---

# 20. Inventory integrity

Inventory race condition bo‘lmasligi kerak.

Ikki user bir paytning o‘zida oxirgi mahsulotni olishga urinsa, quantity minusga tushmasin.

Order/reservation yaratish:

```text
transaction
```

ichida bajarilsin.

Kerak bo‘lsa:

- optimistic concurrency;
- database atomic update;
- serializable transaction;

usullaridan foydalan.

Invariant:

```text
quantity >= 0
reservedQuantity >= 0
soldQuantity >= 0

reservedQuantity + soldQuantity <= quantity
```

doimo saqlansin.

---

# 21. Order

```text
Order

id
userId
branchId

status

subtotal
discount
total
currency

pickupCode
reservedUntil

createdAt
updatedAt
completedAt
cancelledAt
```

Statuslar:

```text
PENDING
RESERVED
CONFIRMED
READY
COMPLETED
CANCELLED
EXPIRED
REFUNDED
```

Order state transitionlar nazorat qilinsin.

Masalan:

```text
COMPLETED → PENDING
```

qaytarishga ruxsat berilmasin.

---

# 22. OrderItem

Order ichida snapshot ma’lumot saqla.

```text
OrderItem

id
orderId
offerId
productNameSnapshot

unitOriginalPrice
unitSalePrice
quantity
lineTotal
```

Nega?

Product narxi yoki nomi keyinchalik o‘zgarsa ham eski order tarixi o‘zgarmaydi.

---

# 23. Reservation

Order/reservation vaqtinchalik bo‘lishi mumkin.

Default:

```text
15 minutes
```

Configurable qil.

Masalan:

```text
reservedUntil
```

muddati o‘tganda:

```text
RESERVED → EXPIRED
```

va inventory qaytariladi.

MVP:

```text
@nestjs/schedule
```

Keyinchalik:

```text
BullMQ + Redis
```

---

# 24. Pickup Code

MVP:

```text
QOL-5831
```

kabi short pickup code.

Code:

- guess qilish qiyin;
- limited lifetime;
- orderga bog‘langan;
- bir marta ishlatiladigan;

bo‘lsin.

Keyinchalik QR qo‘shish mumkin.

Endpoint:

```text
POST /api/business/orders/:id/complete
```

yoki pickup verification endpoint.

Ownership va branch authorization tekshir.

---

# 25. Location

Offer qidirishning markaziy qismi.

MVP:

```text
latitude
longitude
radius
```

asosida nearby search.

Kelajak:

```text
PostGIS
```

qo‘shishga tayyor bo‘l.

Endpoint:

```text
GET /api/offers/nearby
```

Query:

```text
lat
lng
radius
category
minDiscount
sort
page
limit
```

Limit maximum:

```text
100
```

Default:

```text
20
```

Pagination majburiy.

---

# 26. Search

MVP:

PostgreSQL search.

Kelajak:

```text
Meilisearch
```

yoki:

```text
Elasticsearch / OpenSearch
```

qo‘shilishi mumkin.

Search layerni controllerga qattiq bog‘lama.

---

# 27. Upload

Ruxsat etilgan formatlar:

```text
image/jpeg
image/png
image/webp
```

SVG defaultda business upload uchun qabul qilinmasin.

File size:

```text
max 5 MB/image
```

Configurable.

Image count limit qo‘y.

File extensionga emas, MIME/content validationga ishon.

Filename random generated bo‘lsin.

User filename storage key sifatida ishlatilmasin.

---

# 28. Notification

Notification channel abstraction qil.

```text
NotificationService
```

Keyinchalik providerlar:

```text
Web Push
Telegram
SMS
Email
```

bo‘lishi mumkin.

Event misollar:

```text
ORDER_RESERVED
ORDER_EXPIRING
ORDER_COMPLETED
NEW_NEARBY_OFFER
FAVORITE_BUSINESS_NEW_OFFER
BUSINESS_VERIFIED
```

---

# 29. Events

Modulelarni haddan tashqari bir-biriga bog‘lama.

Masalan Order complete bo‘lganda:

```text
OrderCompletedEvent
```

chiqar.

Uni:

```text
Analytics
Notification
Commission
Audit
```

listenerlari ishlatishi mumkin.

MVP NestJS EventEmitter bilan ishlashi mumkin.

Keyinchalik message brokerga ko‘chirish oson bo‘lsin.

---

# 30. Payment

MVPda pickup / cash reservation bilan boshlash mumkin.

Payment module abstrakt bo‘lsin.

Kelajak providerlar:

```text
Click
Payme
Uzum
Stripe
```

bo‘lishi mumkin.

Controller ichida Click/Payme-specific biznes logic yozma.

Interface:

```text
PaymentProvider
```

orqali adapter pattern ishlat.

Payment callback/webhooklar:

- signature verification;
- idempotency;
- duplicate event protection;

bilan ishlasin.

---

# 31. Idempotency

Critical endpointlarda idempotency haqida o‘yla.

Masalan:

```text
POST /orders
payment callbacks
refund
```

Duplicate request double order/double payment yaratmasin.

---

# 32. Security headers

Helmet yoq.

CORS explicit whitelist bilan ishlasin.

Development:

```text
http://localhost:3000
```

Production:

faqat ruxsat etilgan frontend domenlar.

```text
origin: *
```

bilan credentials ishlatma.

---

# 33. Cookie security

Production:

```text
secure: true
httpOnly: true
```

SameSite deploymentga mos.

Cookie domainni environment orqali boshqar.

Refresh cookie pathni minimal scope qil:

```text
/api/auth/refresh
```

Logoutda aynan bir xil cookie options bilan clear qil.

---

# 34. CSRF

Agar cross-site cookie flow ishlatilsa CSRF threat modelni ko‘rib chiq.

SameSite policy, Origin/Referer validation yoki CSRF token yondashuvini deployment arxitekturasiga mos tanla.

Refresh endpoint ayniqsa himoyalangan bo‘lsin.

---

# 35. Database indexes

Indexsiz katta table qoldirma.

Minimum o‘ylanishi kerak bo‘lgan indexlar:

```text
User(phone)
User(email)

Business(slug)
Business(status)

Branch(businessId)
Branch(status)

Product(businessId)
Product(categoryId)

Offer(branchId)
Offer(productId)
Offer(status)
Offer(expiresAt)

Order(userId)
Order(branchId)
Order(status)
Order(createdAt)

AuthSession(userId)
AuthSession(expiresAt)
```

Geo/PostGIS bosqichida spatial index.

Har indexni keraksiz ko‘paytirma.

Query pattern asosida yarat.

---

# 36. Transactions

Quyidagi holatlarda Prisma transaction ishlat:

- order + orderItems;
- inventory reservation;
- order cancellation + stock restore;
- completion + sold quantity;
- payment + transaction;
- business create + owner membership.

Partial write qolmasin.

---

# 37. Soft delete

Muhim biznes ma’lumotlarini hard delete qilishga ehtiyot bo‘l.

Masalan:

```text
Business
Product
User
```

uchun:

```text
deletedAt
```

yoki status-based deactivation ko‘rib chiq.

Order/payment/audit kabi tarixiy ma’lumotlar oddiy DELETE bilan yo‘qolmasin.

---

# 38. Audit log

Admin va sensitive business actionlar audit qilinsin.

```text
AuditLog

id
actorUserId
action
entityType
entityId
metadata
ipHash
createdAt
```

Misollar:

```text
BUSINESS_VERIFIED
BUSINESS_SUSPENDED
USER_SUSPENDED
OFFER_DELETED_BY_MODERATOR
COMMISSION_CHANGED
ADMIN_CREATED
```

---

# 39. Privacy

Faqat zarur ma’lumotni saqla.

Raw IPni uzoq muddat saqlash shart bo‘lmasa hash/anonymize qil.

Sensitive data response DTOlarda yashirilsin.

Masalan:

```text
passwordHash
refreshTokenHash
internalNotes
```

APIga chiqmasin.

---

# 40. DTO va response mapping

Prisma modelni controllerdan to‘g‘ridan-to‘g‘ri return qilma.

Response DTO / mapper ishlat.

Bu sensitive field leakage oldini oladi.

---

# 41. Swagger

Development/stagingda Swagger bo‘lsin.

```text
/api/docs
```

Productionda:

- auth bilan himoyalash;
- IP restriction;
- yoki disable;

qilish mumkin.

Har endpoint:

- summary;
- auth requirements;
- request DTO;
- responses;
- error cases;

bilan hujjatlashtirilsin.

---

# 42. API version

Boshlanishidan:

```text
/api/v1
```

ishlatish tavsiya qilinadi.

Misol:

```text
/api/v1/auth/login
/api/v1/offers
/api/v1/orders
```

Kelajakdagi breaking change uchun:

```text
/v2
```

ochish oson bo‘ladi.

---

# 43. Health endpoints

Deploy uchun:

```text
GET /health
```

bo‘lsin.

Keyinchalik:

```text
GET /health/live
GET /health/ready
```

qo‘shish mumkin.

Readiness database connectionni tekshirishi mumkin.

---

# 44. Environment validation

Environment variables runtime boshida validatsiya qilinsin.

Masalan Joi/Zod yoki Nest config validation.

Required:

```text
NODE_ENV
PORT
DATABASE_URL

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET

FRONTEND_URL

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

Missing secret bilan app productionda ishga tushmasin.

---

# 45. Secret qoidalari

Secretlar Git repositoryga yozilmasin.

`.env` commit qilinmasin.

`.env.example` bo‘lsin.

JWT secretlar:

- random;
- strong;
- kamida 32 bytes entropy tavsiya;
- access va refresh uchun alohida.

Production va development secretlari alohida.

---

# 46. Prisma migration

Development:

```bash
prisma migrate dev
```

Production:

```bash
prisma migrate deploy
```

Production deployda:

```text
db push
```

ni default ishlatma.

Migration history source controlga commit qilinsin.

---

# 47. Seed

Seed:

- idempotent;
- production-safe;
- default weak password yaratmaydigan;

bo‘lsin.

SUPER_ADMIN yaratish uchun secret env talab qil.

Misol:

```text
SEED_ADMIN_PHONE
SEED_ADMIN_PASSWORD
```

Production logda password chiqarilmasin.

---

# 48. Testing

Minimum:

## Unit test

- auth service;
- offer business rules;
- order state transitions;
- inventory;
- permissions.

## Integration/E2E

- register/login/refresh/logout;
- create business;
- create offer;
- reserve order;
- complete pickup;
- expired reservation;
- unauthorized access;
- rate limit;
- ownership protection.

Test database alohida bo‘lsin.

---

# 49. CI

GitHub Actions yoki boshqa CI:

```text
install
lint
typecheck
test
prisma generate
build
```

bajarishi kerak.

Broken build productionga ketmasin.

---

# 50. Code quality

Agent quyidagilarni bajarsin:

- strict TypeScript;
- `any`dan imkon qadar qochish;
- controllerlarni yupqa saqlash;
- business logic service/domain layerda;
- reusable validation;
- constants/enums centralized;
- duplicate code yozmaslik;
- giant service yaratmaslik;
- circular dependencylardan qochish;
- clear naming;
- small focused methods.

---

# 51. Controller vazifasi

Controller faqat:

```text
request
validation
authorization metadata
service call
response
```

bilan shug‘ullansin.

Controller ichida:

- Prisma query;
- business calculations;
- transaction;
- password hashing;

yozma.

---

# 52. Service vazifasi

Service:

- biznes qoidalari;
- ownership;
- orchestration;
- transaction;
- repository/data access interaction;

bilan ishlaydi.

---

# 53. Prisma access

Har module PrismaService ishlatishi mumkin, ammo querylar tartibli bo‘lsin.

Loyiha kattalashsa repository layer ajratishga tayyor struktura bo‘lsin.

Prisma-specific obyektlarni butun application bo‘ylab tarqatma.

---

# 54. Response pagination

Standard format:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Maximum limit:

```text
100
```

Client `limit=100000` qilib databasega zarar yetkaza olmasin.

---

# 55. Sorting

Client raw SQL/order expression bera olmasin.

Whitelist:

```text
createdAt
price
distance
discount
expiresAt
popularity
```

kabi ruxsat etilgan fieldlar.

---

# 56. Offer ranking

MVPda AI kerak emas.

Ranking omillari:

```text
distance
discount percentage
expires soon
availability
business rating
popularity
```

Kelajakda recommendation service ajratilishi mumkin.

---

# 57. Analytics

Business analytics:

```text
offersCreated
itemsSold
revenueRecovered
estimatedWasteSaved
ordersCompleted
ordersExpired
conversionRate
```

Platform analytics:

```text
DAU
MAU
activeBusinesses
activeBranches
activeOffers
orders
GMV
retention
conversion
cityGrowth
```

Analytics production transactional queriesni sekinlashtirmasin.

Boshlanishida aggregate queries, keyinchalik event-based analytics.

---

# 58. Commission

Commission hardcode qilinmasin.

```text
CommissionRule
```

yoki configurable settings.

Masalan:

```text
percentage
fixed
business-specific
category-specific
country-specific
```

ga kengaya olsin.

---

# 59. Promo Code

Kelajak uchun:

```text
PromoCode

code
type
value
maxDiscount
usageLimit
perUserLimit
startsAt
expiresAt
status
```

Order yaratilganda server tomonidan validate qil.

Frontend hisobiga ishonma.

---

# 60. Review

Faqat completed order bo‘lgan customer review qila olsin.

Fake review oldini ol.

Bir order uchun review limit qo‘y.

Moderation status bo‘lishi mumkin.

---

# 61. Reports

User:

- business;
- offer;
- review;
- order issue;

ustidan report yubora olsin.

Moderator workflow:

```text
OPEN
IN_REVIEW
RESOLVED
REJECTED
```

---

# 62. Business verification

Business onboarding:

```text
DRAFT
PENDING_REVIEW
VERIFIED
REJECTED
SUSPENDED
```

Verified bo‘lmagan business public offer chiqarishi yoki chiqarmasligi product qaroriga bog‘liq, ammo backend enforcement bo‘lsin.

---

# 63. Branch status

```text
ACTIVE
TEMPORARILY_CLOSED
SUSPENDED
ARCHIVED
```

Business ACTIVE bo‘lsa ham suspended branch offer qila olmasin.

---

# 64. Timezone

Timestamp database:

```text
UTC
```

saqlansin.

Display:

branch/country timezone bo‘yicha.

PickupStart/pickupEnd timezone ambiguity bermasin.

---

# 65. Money

Clientdan kelgan totalga ishonma.

Frontend:

```text
total = 7000
```

yuborsa ham backend qayta hisoblasin.

Authoritative values:

- database price;
- quantity;
- promo;
- commission;

server tomonidan hisoblanadi.

---

# 66. Security rule

Hech qachon:

```text
"frontend yashirib qo‘ygan, demak xavfsiz"
```

deb hisoblama.

Har bir permission va biznes qoida backendda enforce qilinsin.

---

# 67. Performance

Default:

- pagination;
- selective `select`;
- unnecessary `include`lardan qochish;
- N+1 querylarni tekshirish;
- index;
- connection pooling;
- cachingni faqat kerak joyda.

Supabase/Neon connection limitlarini hisobga ol.

Productionda pooling URL talab qilinsa to‘g‘ri konfiguratsiya qil.

---

# 68. Caching

MVPda majburiy emas.

Kelajakda Redis:

- categories;
- popular offers;
- nearby query fragments;
- rate limit;
- session metadata;

uchun.

Cache invalidation strategiyasi bo‘lmagan narsani cache qilma.

---

# 69. Background Jobs

MVP:

```text
@nestjs/schedule
```

Tasks:

- expired offers;
- expired reservations;
- cleanup;
- notification reminders.

Scale:

```text
BullMQ + Redis
```

Workerlarni backend HTTP processdan ajratishga tayyor bo‘l.

---

# 70. Production observability

Minimum:

- structured logs;
- request IDs;
- health checks.

Keyinchalik:

```text
Sentry
OpenTelemetry
Grafana
```

qo‘shishga tayyor bo‘l.

---

# 71. Render deploy

Backend Render Web Service sifatida deploy qilinadi.

Build misol:

```bash
npm ci
npx prisma generate
npm run build
```

Migration release/deploy step:

```bash
npx prisma migrate deploy
```

Start:

```bash
npm run start:prod
```

Production environment variablelar Render secret settingsda.

---

# 72. Graceful shutdown

NestJS:

```ts
app.enableShutdownHooks();
```

ishlat.

Database connection clean close bo‘lsin.

Deploy restart paytida requestlar imkon qadar toza tugasin.

---

# 73. CORS

Allowed origin environmentdan olinadi.

Masalan:

```text
https://qolmasin.uz
https://www.qolmasin.uz
```

Development:

```text
http://localhost:3000
```

Credentials faqat kerak bo‘lsa enabled.

---

# 74. Main bootstrap

`main.ts` minimum:

- Config;
- Helmet;
- cookie-parser;
- CORS;
- ValidationPipe;
- global prefix;
- versioning;
- exception filter;
- request ID/logging;
- Swagger development/staging;
- shutdown hooks.

---

# 75. API prefix

Tavsiya:

```text
/api/v1
```

Misollar:

```text
POST /api/v1/auth/login

GET /api/v1/offers/nearby

POST /api/v1/orders

GET /api/v1/businesses/:id

POST /api/v1/admin/businesses/:id/verify
```

---

# 76. MVP modullarining ustuvorligi

Agent birinchi bo‘lib quyidagilarni production sifatida quradi:

## Phase 1

1. Config
2. Prisma
3. Auth
4. Users
5. Roles/permissions
6. Upload

## Phase 2

7. Businesses
8. Business Members
9. Branches
10. Categories
11. Products

## Phase 3

12. Offers
13. Inventory
14. Location/Nearby

## Phase 4

15. Orders
16. Reservation
17. Pickup

## Phase 5

18. Admin
19. Moderation
20. Audit

## Phase 6

21. Notification
22. Review
23. Favorites
24. Analytics

## Phase 7

25. Payment
26. Commission
27. Promo
28. Subscription

---

# 77. MVPda qilinmaydigan ortiqcha ishlar

Boshlanishida majburiy emas:

- Kubernetes;
- microservices;
- Kafka;
- GraphQL;
- Elasticsearch;
- Redis cluster;
- event sourcing;
- CQRS hamma module uchun;
- AI recommendation;
- multi-region database.

Ular real scale muammosi paydo bo‘lganda qo‘shiladi.

---

# 78. Agentning ishlash tartibi

Har taskda agent:

1. Avval mavjud kodni o‘qiydi.
2. Requirementni tushunadi.
3. Security va biznes invariantlarni aniqlaydi.
4. Zarur schema migrationni rejalaydi.
5. DTO yaratadi.
6. Service business logic yozadi.
7. Guard/permission qo‘shadi.
8. Controller endpoint yaratadi.
9. Transaction kerakligini tekshiradi.
10. Index kerakligini tekshiradi.
11. Error cases yozadi.
12. Swagger yangilaydi.
13. Test yozadi.
14. Lint/typecheck/build tekshiradi.
15. Mavjud funksiyalarni buzmaganini tekshiradi.

---

# 79. Agent bajarishi taqiqlangan ishlar

Agent:

- secretni codega hardcode qilmasin;
- passwordni plain text saqlamasin;
- raw refresh token databasega saqlamasin;
- authni faqat frontendga topshirmasin;
- role/ownership tekshiruvini unutmasin;
- validationni o‘tkazib yubormasin;
- user yuborgan `total`ga ishonmasin;
- file uploadni cheksiz qoldirmasin;
- `select *` mentalitetida barcha relationlarni include qilmasin;
- productionda `prisma db push` ishlatmasin;
- migrationni o‘chirib qayta yaratmasin;
- mavjud user data yo‘qotadigan migrationni izohsiz qilmasin;
- API breaking change qilmasin;
- `any` bilan muammoni yashirmasin;
- giant `app.service.ts` yaratmasin;
- controllerda business logic yozmasin;
- catch qilib errorni jim yutib yubormasin.

---

# 80. Definition of Done

Backend task tayyor deb hisoblanishi uchun:

```text
✓ DTO validation mavjud
✓ auth/permission tekshirilgan
✓ ownership tekshirilgan
✓ biznes qoidalar backendda enforce
✓ database transaction kerak bo‘lsa ishlatilgan
✓ index masalasi tekshirilgan
✓ errors consistent
✓ Swagger yangilangan
✓ tests mavjud
✓ lint o'tadi
✓ typecheck o'tadi
✓ build o'tadi
✓ secrets yo‘q
✓ logging sensitive data chiqarmaydi
✓ production environment hisobga olingan
```

---

# 81. Asosiy prinsip

Qolmasin backendining asosiy maqsadi:

```text
SECURE
RELIABLE
MAINTAINABLE
SCALABLE
OBSERVABLE
```

bo‘lishi kerak.

Tez kod yozish uchun kelajakdagi production sifatini qurbon qilma.

Lekin hali mavjud bo‘lmagan scale muammolari uchun ortiqcha infrastructure ham yaratma.

Prinsip:

```text
Simple now.
Structured from day one.
Scalable when needed.
```

---

# 82. Agent uchun yakuniy ko‘rsatma

Sen bu loyihada oddiy code generator emassan.

Sen:

```text
Senior Backend Engineer
+
Software Architect
+
Security-minded Engineer
+
Database Designer
+
Production Reviewer
```

rolida ishlaysan.

Har bir qarorda quyidagilarni o‘yla:

1. Bu xavfsizmi?
2. Bu biznes qoidasini buzib o‘tish mumkinmi?
3. Ikki request bir vaqtda kelsa nima bo‘ladi?
4. 100 user emas, 100 000 user bo‘lsa nima bo‘ladi?
5. Boshqa davlat qo‘shilsa qayta yozish kerak bo‘ladimi?
6. Admin xato qilsa audit bormi?
7. User requestni soxtalashtirsa backend himoyalanganmi?
8. Database data integrity saqlanadimi?
9. Endpoint abuse qilinsa limit bormi?
10. Productionda muammo chiqsa loglardan topa olamizmi?

Agar requirement noto‘g‘ri yoki xavfli bo‘lsa, ko‘r-ko‘rona implement qilma.

Muammoni tushuntir va productionga mos yaxshiroq yechimni tanla.

---

# 83. Tavsiya etilgan initial stack yakuni

```text
Frontend:
Next.js PWA
TypeScript
TanStack Query
Zustand
Tailwind
shadcn/ui

Backend:
NestJS
TypeScript
REST API
Prisma ORM
PostgreSQL
JWT
Passport
Argon2
class-validator
Swagger
Helmet
Throttler

Database:
Supabase PostgreSQL
yoki Neon PostgreSQL

Storage:
Supabase Storage

Deploy:
Vercel — frontend
Render — backend

Later:
Redis
BullMQ
PostGIS
Sentry
Meilisearch
OpenTelemetry
```

---

# 84. Tavsiya etilgan auth yakuni

```text
ACCESS TOKEN
TTL: 15 min
Storage: frontend memory
Transport: Authorization Bearer

REFRESH TOKEN
TTL: 30 days
Storage client: httpOnly Secure Cookie
Storage server: hashed AuthSession
Rotation: YES
Revocation: YES

Password:
Argon2id

Rate Limit:
Global + endpoint specific

Session:
multi-device support

Logout:
current session revoke

Logout All:
all sessions revoke
```

---

# 85. Birinchi backend maqsadi

Birinchi production milestone:

```text
User register/login
        ↓
Business create
        ↓
Branch create
        ↓
Product create
        ↓
Offer publish
        ↓
Customer nearby offer ko‘radi
        ↓
Reserve qiladi
        ↓
Pickup code oladi
        ↓
Business productni beradi
        ↓
Order COMPLETED
```

Shu flow to‘liq, xavfsiz va testsiz xatosiz ishlamaguncha qo‘shimcha murakkab funksiyalarga o‘tma.

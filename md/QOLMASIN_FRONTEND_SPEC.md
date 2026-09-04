# Qolmasin Frontend Specification

## 1. Maqsad

Qolmasin — restoran, kafe, nonvoyxona va boshqa oziq-ovqat bizneslarida qolib ketayotgan mahsulotlarni xaridorga chegirmali narxda taklif qiluvchi marketplace.

Frontend uchta asosiy rol oqimini qo‘llaydi:

```text
Customer marketplace
Business dashboard
Admin / moderator panel
```

Backend API:

```text
Base URL: /api/v1
Swagger: /api/docs (development)
```

Tavsiya etilgan stack:

- Next.js + TypeScript;
- TanStack Query — server state;
- Zustand yoki Context — auth/session va UI state;
- Tailwind + shadcn/ui;
- React Hook Form + Zod — form state va client validation;
- next/image — product rasmlari;
- PWA — mobile-first marketplace.

Ranglar uchun [QOLMASIN_FRONTEND_COLORS.md](./QOLMASIN_FRONTEND_COLORS.md) ishlatiladi.

## 2. Global qoidalar

### Auth token

- Access token faqat memory’da saqlanadi.
- Refresh token frontend tomonidan o‘qilmaydi; u httpOnly cookie’da.
- API chaqirig‘ida `Authorization: Bearer <accessToken>` yuboriladi.
- 401 kelganda bir marta `/auth/refresh` chaqiriladi va original request qayta yuboriladi.
- Refresh ham 401 bo‘lsa session tozalanadi va `/login` ga yo‘naltiriladi.
- Logout’da local session tozalanadi.

### API response

Pagination response:

```ts
type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
```

Xatolik UI’da quyidagi tartibda ko‘rsatiladi:

1. `message` — foydalanuvchiga tushunarli matn;
2. `code` — maxsus UI holati uchun;
3. `details` — field-level validation xatolari uchun.

Har bir sahifada loading, empty, error va retry holati bo‘lishi shart.

### Mobile-first

- Customer ekranlari 360px kenglikdan boshlanadi.
- Asosiy customer navigatsiya: `Bosh sahifa`, `Yaqinida`, `Buyurtmalar`, `Saqlangan`, `Profil`.
- Business navigatsiya: `Dashboard`, `Offers`, `Orders`, `Products`, `Branches`, `Team`, `Settings`.
- Admin navigatsiya: `Moderation`, `Categories`, `Audit logs`.
- Destructive action har doim confirm dialog bilan.

## 3. Route map

### Public/customer routes

```text
/                         Home / nearby offers
/offers                   Offer listing
/offers/[offerId]         Offer detail
/products                 Product listing
/products/[productId]     Product detail
/businesses/[slug]        Public business detail
/branches/[branchId]      Public branch detail
/login                    Login
/register                 Registration
/verify-email             Email verification
/forgot-password          Password reset request
/reset-password           Password reset form
/orders                   Customer order history
/orders/[orderId]         Order detail and pickup code
/favorites                Saved businesses
/notifications             Notifications
/profile                  Profile/session page
```

### Business routes

```text
/business                  Business selector/dashboard
/business/new              Create business
/business/[businessId]     Business overview
/business/[businessId]/setup
/business/[businessId]/branches
/business/[businessId]/products
/business/[businessId]/offers
/business/[businessId]/orders
/business/[businessId]/team
```

### Admin routes

```text
/admin/businesses           Verification queue
/admin/categories           Category management
/admin/audit-logs           Audit log viewer
```

## 4. Auth module

### Ekranlar

- Login: phone/email, password, device name optional.
- Register: full name, E.164 phone, email, password.
- Verify email: token URL query yoki form orqali.
- Resend verification: email form; enumeration sababli umumiy success ko‘rsatiladi.
- Forgot password: email form.
- Reset password: token va yangi password.
- Profile: `/auth/me` orqali user ma’lumotlari va logout actions.

### API

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/verify-email
POST /auth/resend-verification
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/logout
POST /auth/logout-all
GET  /auth/me
```

### UI qoidalari

- Password kamida 10 belgi, harf va raqam.
- Telefon E.164 formatda yuboriladi, masalan `+998901234567`.
- Login xatosida email mavjud/mavjud emasligini ajratib ko‘rsatmaslik.
- Auth init paytida global splash ko‘rsatiladi; token tayyor bo‘lmasdan protected page render qilinmaydi.

## 5. Businesses module

### Customer

Public business page:

- business nomi, slug, turi va description;
- verification holati faqat verified bo‘lsa ko‘rinadi;
- branchlar, manzil, ish vaqti, telefon;
- shu business’ning active offers va products;
- favorite/unfavorite action.

API:

```text
GET /businesses/public/:slug
POST /businesses/:businessId/favorite
DELETE /businesses/:businessId/favorite
```

### Business owner

Create form:

```text
name, description, type
```

Dashboard status badge:

```text
DRAFT -> PENDING_REVIEW -> VERIFIED
                     \-> REJECTED
                     \-> SUSPENDED
```

API:

```text
POST /businesses
GET /businesses/mine
PATCH /businesses/:businessId
POST /businesses/:businessId/submit-verification
```

Status `REJECTED` bo‘lsa backend qaytargan `statusReason` ko‘rsatiladi. `VERIFIED` bo‘lmagan business’da publish CTA disabled bo‘ladi.

## 6. Branches module

### Ekranlar

- Branch list: status, city, address, offer/order counts.
- Create/edit branch form.
- Public branch detail: address, map link, phone, opening/closing time.

Form fields:

```text
name, address, countryCode, region, city, district,
latitude, longitude, phone, timezone, currency,
openingTime, closingTime
```

API:

```text
POST  /businesses/:businessId/branches
GET   /businesses/:businessId/branches
PATCH /businesses/:businessId/branches/:branchId
GET   /branches/:branchId
```

Branch statuslari:

```text
ACTIVE, TEMPORARILY_CLOSED, ARCHIVED
```

`SUSPENDED` status frontend tomonidan update option sifatida berilmaydi. Archived branch tanlash va yangi offer yaratishdan chiqariladi.

## 7. Business Members module

### Ekranlar

- Team list: name, email, role, status, permissions.
- Invite member form.
- Edit role/status/permissions dialog.

API:

```text
POST  /businesses/:businessId/members
GET   /businesses/:businessId/members
PATCH /businesses/:businessId/members/:memberId
```

Rollar:

```text
OWNER    — full business control
MANAGER  — products, offers, orders, branches
STAFF    — assigned operational permissions
```

Permissionlar frontend navigationni yashirish uchun ishlatiladi, lekin backend authorization’ning o‘rnini bosmaydi.

## 8. Categories module

### Customer

Home va listing’da category chips/dropdown:

```text
GET /categories
```

Category tree parent/child ko‘rinishida chiqariladi. Inactive category public UI’da ko‘rsatilmaydi.

### Admin

- Category list/tree.
- Create category.
- Edit name, slug, description, parent, sort order, status.

API:

```text
POST  /admin/categories
PATCH /admin/categories/:categoryId
```

## 9. Products module

### Customer

Product card:

- image;
- name;
- category;
- business;
- active offers mavjud bo‘lsa “Taklifni ko‘rish” CTA.

API:

```text
GET /products
GET /products/:productId
```

### Business

- Product list with `DRAFT`, `ACTIVE`, `ARCHIVED` badges.
- Create/edit product.
- Product image gallery upload/delete/reorder.
- Productni active qilishdan oldin business verified va category active bo‘lishi kerak.

API:

```text
POST  /businesses/:businessId/products
GET   /businesses/:businessId/products
PATCH /businesses/:businessId/products/:productId
POST  /businesses/:businessId/products/:productId/images
DELETE /businesses/:businessId/products/:productId/images/:imageId
```

Form fields:

```text
categoryId, name, description, status
```

## 10. Uploads module

Upload komponenti:

- PNG/JPEG/WebP preview;
- max size xatosi;
- upload progress;
- cancel/retry;
- success’da returned `url` ni image src sifatida ishlatish;
- object URL cleanup.

Image upload multipart form-data bilan yuboriladi:

```text
file: File
sortOrder: number
```

Fayl nomiga ishonilmaydi; frontend faqat server qaytargan URL’ni saqlaydi. Broken image uchun fallback placeholder bo‘ladi.

## 11. Offers module — marketplace markazi

### Home / listing

Offer card quyidagilarni ko‘rsatadi:

- product image va nomi;
- business/branch nomi;
- original price — strike-through;
- discount price — deep green;
- discount percent — orange badge;
- available quantity;
- pickup window;
- distance;
- `Rezerv qilish` CTA.

API:

```text
GET /offers
GET /offers/nearby?lat=&lng=&radius=&categoryId=&minDiscount=&sort=
GET /offers/:offerId
```

Nearby permission berilmasa manual city/location selector ko‘rsatiladi. Geolocation rad etilganda listing ishlashda davom etadi.

Filter/sort:

```text
categoryId, radius, minDiscount
sort = distance | discount | price | expires
```

### Business offer management

Offer form:

```text
branchId, productId, originalPrice, discountPrice,
quantity, pickupStart, pickupEnd, expiresAt
```

API:

```text
POST  /businesses/:businessId/offers
GET   /businesses/:businessId/offers
PATCH /businesses/:businessId/offers/:offerId
POST  /businesses/:businessId/offers/:offerId/publish
POST  /businesses/:businessId/offers/:offerId/cancel
```

Offer statuslari:

```text
DRAFT, ACTIVE, LOW_STOCK, SOLD_OUT, EXPIRED, CANCELLED
```

Frontend validation:

- discount price original price’dan katta bo‘lmasin;
- quantity 1 dan katta;
- pickup start < pickup end;
- expiry pickup end’dan oldin bo‘lmasin;
- active branch va active product tanlansin.

Backend qayta hisoblaydi; frontend price/total authoritative emas.

## 12. Orders module — reserve va pickup

### Customer cart/reservation

MVP’da order bir branch’dagi bir yoki bir nechta offer’dan tuziladi.

```json
{
  "items": [
    { "offerId": "uuid", "quantity": 2 }
  ]
}
```

Order create:

```text
POST /orders
```

Reservation muvaffaqiyatli bo‘lsa:

- order number/id;
- pickup code;
- pickup window;
- reserved until;
- total va currency;
- branch manzili ko‘rsatiladi.

Inventory unavailable (`INVENTORY_UNAVAILABLE`) bo‘lsa cart qayta fetch qilinadi va userga available quantity ko‘rsatiladi.

### Customer order pages

```text
GET  /orders/mine
GET  /orders/:orderId
POST /orders/:orderId/cancel
```

Order status stepper:

```text
RESERVED -> CONFIRMED -> READY -> COMPLETED
       \-> CANCELLED
       \-> EXPIRED
```

Pickup code faqat order egasiga detail sahifasida ko‘rsatiladi. Uni business xodimiga ko‘rsatish uchun katta, copy qilinadigan formatda chiqaring. Kodni URL yoki analytics event’ga yozmang.

### Business orders

```text
GET  /businesses/:businessId/orders
POST /businesses/:businessId/orders/:orderId/ready
POST /businesses/:businessId/orders/:orderId/complete
```

Business order detail:

- customer display name;
- items va quantities;
- branch;
- order status;
- pickup code input;
- `READY` va `COMPLETED` actionlari.

Wrong pickup code xatosida attempt count userga oshkor qilinmaydi. Code 5 marta noto‘g‘ri kiritilsa action locked holat ko‘rsatiladi.

## 13. Favorites module

### Ekranlar

- Business card heart icon.
- Saved businesses page.
- Login qilinmagan userda heart bosilganda login modal.

API:

```text
GET    /favorites/businesses
POST   /businesses/:businessId/favorite
DELETE /businesses/:businessId/favorite
```

Favorite action optimistic bo‘lishi mumkin; API xato bersa oldingi holat rollback qilinadi.

## 14. Notifications module

### Ekranlar

- Navbar bell icon va unread badge.
- Notifications drawer/page.
- Read/read-all actions.

API:

```text
GET   /notifications?unreadOnly=true
PATCH /notifications/:notificationId/read
POST  /notifications/read-all
```

Notification click action `data` ichidagi route/entity bo‘yicha tegishli sahifaga olib boradi. Notification mavjud bo‘lmasa UI crash qilmasin.

## 15. Audit module — admin only

### Ekran

- Audit table: date, actor, role, action, entity type/id, request id.
- Filters: action, entity type, entity id, actor id, from/to.
- Pagination.
- Metadata detail drawer.

API:

```text
GET /admin/audit-logs
```

Audit log immutable read-only ko‘rinishda bo‘ladi. IP address raw ko‘rsatilmaydi; backend faqat hash saqlaydi.

## 16. Admin moderation

Business verification queue:

```text
GET  /admin/businesses?status=PENDING_REVIEW
POST /admin/businesses/:businessId/review
```

Review form:

```text
status = VERIFIED | REJECTED | SUSPENDED
reason — rejected/suspended uchun majburiy
```

Reviewdan keyin list invalidation qilinadi va business owner notification olishi kutiladi.

## 17. State management

### TanStack Query keys

```ts
['me']
['categories', filters]
['offers', filters]
['offer', offerId]
['products', filters]
['product', productId]
['business', slug]
['businesses', 'mine', page]
['business', businessId, 'offers', filters]
['business', businessId, 'orders', filters]
['orders', 'mine', filters]
['order', orderId]
['favorites', 'businesses']
['notifications', filters]
```

Mutationdan keyin tegishli query invalidate qilinadi. Order create’dan keyin offer detail/list va orders list invalidate qilinadi.

### Zustand/Context’da saqlanadiganlar

- access token;
- current user;
- active business id;
- selected location;
- cart draft;
- theme va sidebar state.

Password, refresh token va pickup code’ni persistent storage’da saqlamang.

## 18. Security va UX checklist

- Protected route server-side va client-side tekshiriladi.
- Role va permission backend tomonidan authoritative.
- Frontend businessId/userId qiymatlarini ownership isboti deb qabul qilmaydi.
- `dangerouslySetInnerHTML` ishlatilmaydi.
- Image URL external bo‘lsa `next.config` allowlist sozlanadi.
- Form submit’da duplicate click lock qilinadi.
- Reservation va publish action’lar idempotent UI state bilan himoyalanadi.
- 401 refresh race bitta refresh request bilan boshqariladi.
- Network offline banner va retry mavjud.
- Currency branch response’dan olinadi; UZS hardcode qilinmaydi.
- Date/time branch timezone bo‘yicha formatlanadi.
- Accessibility: keyboard navigation, focus state, aria-label, contrast.

## 19. MVP implementation tartibi

### Sprint 1 — customer foundation

1. App shell, navbar, auth/session.
2. Home, categories, nearby offers.
3. Offer detail va business/branch detail.
4. Register/login/verify/reset.

### Sprint 2 — reservation

1. Cart/reserve flow.
2. Order history/detail.
3. Pickup code screen.
4. Favorites va notifications.

### Sprint 3 — business dashboard

1. Business onboarding/verification status.
2. Branch CRUD.
3. Product CRUD va image upload.
4. Offer CRUD/publish.
5. Orders READY/COMPLETED.

### Sprint 4 — admin and hardening

1. Moderation queue.
2. Categories.
3. Audit logs.
4. Responsive/accessibility/error testing.
5. PWA install va production deploy.

## 20. MVP’dan keyingi modullar

Quyidagilar backend specification’da bor, ammo MVP reserve → pickup oqimiga kirmaydi:

- payments;
- commission;
- promo codes;
- subscriptions;
- reviews;
- reports/support;
- analytics;
- user profile editing;
- map/PostGIS advanced search;
- real-time notifications.

Ular uchun frontend route va component nomlari keyin backward-compatible qo‘shiladi.

## 21. Frontend Definition of Done

- customer register/login qila oladi;
- nearby offer topadi;
- offer detail ko‘radi;
- rezerv qiladi va pickup code oladi;
- order history ko‘radi va cancel qila oladi;
- business owner onboardingdan offer publishgacha o‘tadi;
- business staff orderni READY va pickup code bilan COMPLETED qiladi;
- moderator businessni review qiladi;
- loading/empty/error/expired states mavjud;
- mobile responsive va keyboard accessible;
- API errors user-friendly tarjima qilingan;
- no secret/token/pickup code analytics yoki localStorage’da qolmaydi.

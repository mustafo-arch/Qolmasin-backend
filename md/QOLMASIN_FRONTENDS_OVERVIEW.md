# Qolmasin frontendlarining vazifalari

## 1. Umumiy tushuncha

Qolmasin bitta backend bilan ishlaydigan, lekin foydalanuvchi turi va ish jarayoniga qarab alohida frontendlarga bo‘linadigan platforma.

Platformada jami 4 ta frontend bo‘ladi:

| Frontend | Kim ishlatadi? | Asosiy vazifa |
|---|---|---|
| **Main Frontend** | Oddiy customer/xaridor | Yaqin atrofdagi chegirmali mahsulotni topish, rezerv qilish va olib ketish |
| **Business Frontend** | Biznes egasi, manager, staff | Mahsulot va takliflarni boshqarish, buyurtmani tayyorlash va topshirish |
| **Admin Frontend** | Admin va moderator | Bizneslarni tekshirish, kategoriyalarni boshqarish, report va narx nazorati |
| **Pickup/Operations Frontend** | Filial kassiri yoki pickup xodimi | Tayyor buyurtmani pickup code orqali tez va xatosiz berish |

Frontendlar bir-birining o‘rnini bosmaydi. Har bir frontend o‘z vazifasiga tegishli ekranlarni ko‘rsatadi, ruxsatni esa backend tekshiradi. Frontenddagi yashirilgan menu yoki button xavfsizlik hisoblanmaydi.

Backend base URL:

```text
/api/v1
```

Development Swagger:

```text
/api/docs
```

## 2. Umumiy texnik qoidalar

Barcha frontendlar quyidagi qoidalarga amal qiladi:

- Next.js + TypeScript ishlatiladi;
- API state uchun TanStack Query ishlatiladi;
- access token faqat memory’da saqlanadi;
- refresh token frontendga ko‘rinmaydi, httpOnly cookie’da bo‘ladi;
- 401 kelganda bitta refresh request yuboriladi, keyin original request qayta uriniladi;
- refresh ham muvaffaqiyatsiz bo‘lsa session tozalanib login sahifasiga o‘tiladi;
- password, refresh token va pickup code localStorage’ga yozilmaydi;
- har bir sahifada loading, empty, error va retry holati bo‘ladi;
- destructive action confirm dialog bilan bajariladi;
- backend qaytargan currency va timezone ishlatiladi, UZS yoki vaqt zonasi hardcode qilinmaydi;
- barcha formalar client validation bilan boshlanadi, lekin yakuniy tekshiruv backendniki;
- access token `Authorization: Bearer <token>` headerida yuboriladi.

Umumiy UI ranglari [QOLMASIN_FRONTEND_COLORS.md](./QOLMASIN_FRONTEND_COLORS.md) faylidan olinadi.

---

# 3. Main Frontend — customer marketplace

## 3.1. Maqsadi

Main Frontend Qolmasinning asosiy, ommaga ochiq frontendidir. Customer bu frontend orqali:

1. ro‘yxatdan o‘tadi yoki login qiladi;
2. o‘ziga yaqin filial va mahsulotlarni topadi;
3. chegirma, narx, mavjud son va pickup vaqtini ko‘radi;
4. mahsulotni rezerv qiladi;
5. pickup code bilan filialdan olib ketadi;
6. buyurtmani yakunlagach review qoldiradi yoki report yuboradi.

Bu frontendning asosiy savoli: **“Menga hozir yaqin joyda qanday yaxshi taklif bor?”**

## 3.2. Asosiy navigatsiya

```text
Bosh sahifa
Yaqinida
Buyurtmalar
Saqlangan
Bildirishnomalar
Profil
```

Mobile’da bottom navigation, desktop’da top/side navigation ishlatilishi mumkin.

## 3.3. Sahifalar

```text
/                         Bosh sahifa va tavsiya qilingan takliflar
/offers                   Barcha aktiv takliflar
/offers/nearby            Geolocation asosidagi takliflar
/offers/[offerId]         Taklif tafsiloti
/products                 Mahsulotlar
/products/[productId]     Mahsulot tafsiloti
/businesses/[slug]        Biznesning public sahifasi
/branches/[branchId]      Filial ma’lumoti va ish vaqti
/orders                   Mening buyurtmalarim
/orders/[orderId]         Buyurtma va pickup code
/favorites                Saqlangan bizneslar
/notifications            Bildirishnomalar
/profile                  Profil va session boshqaruvi
/login                    Login
/register                 Ro‘yxatdan o‘tish
/verify-email             Email tasdiqlash
/forgot-password          Parol tiklash so‘rovi
/reset-password           Yangi parol o‘rnatish
```

## 3.4. Bosh sahifa

Bosh sahifada quyidagilar bo‘ladi:

- location permission so‘rovi;
- “Yaqin atrofdagi takliflar”;
- “Tez tugaydigan takliflar”;
- “Eng katta chegirmalar”;
- “Yangi takliflar”;
- “Mashhur takliflar”;
- “Siz uchun tavsiya”;
- category filter;
- qidiruv;
- radius, max price, min discount va business type filterlari.

Location berilmasa customer shahar yoki joylashuvni qo‘lda tanlaydi. Geolocation rad etilishi butun marketplace’ni bloklamaydi.

## 3.5. Offer card va offer detail

Har bir cardda quyidagilar aniq ko‘rinadi:

- mahsulot rasmi va nomi;
- biznes va filial nomi;
- original/reference price;
- hozirgi chegirmali price;
- discount foizi;
- qolgan quantity;
- filialgacha masofa;
- pickup boshlanishi va tugashi;
- expiry yoki “tez tugaydi” belgisi;
- `Rezerv qilish` tugmasi.

Offer detail’da product, business, branch address, map link, opening hours, price history, mavjud son va pickup qoidalari ko‘rsatiladi. Expired, sold out yoki cancelled offerda rezerv tugmasi disabled bo‘ladi.

Asosiy API:

```text
GET /categories
GET /offers
GET /offers/nearby
GET /offers/ending-soon
GET /offers/biggest-discounts
GET /offers/new
GET /offers/popular
GET /offers/recommended
GET /offers/:offerId
GET /offers/:offerId/price-history
GET /businesses/public/:slug
GET /branches/:branchId
GET /products
GET /products/:productId
```

## 3.6. Rezerv va pickup oqimi

```text
Offer detail
  -> quantity tanlash
  -> rezerv qilish
  -> POST /orders
  -> order number, total, pickup window va pickup code
  -> customer filialga boradi
  -> business xodimi orderni READY qiladi
  -> code tekshiriladi
  -> COMPLETED
```

Order yaratilganda totalni frontend hisoblab backendga yubormaydi. Frontend faqat offerId va quantity yuboradi:

```json
{
  "items": [
    { "offerId": "uuid", "quantity": 2 }
  ]
}
```

Customer ko‘radigan order statuslari:

```text
RESERVED -> CONFIRMED -> READY -> COMPLETED
       \-> CANCELLED
       \-> EXPIRED
```

`INVENTORY_UNAVAILABLE` qaytsa cart va offer qayta yuklanadi. Pickup code katta, copy qilinadigan ko‘rinishda beriladi, lekin URL, analytics yoki persistent storage’ga yozilmaydi.

Order API:

```text
POST /orders
GET  /orders/mine
GET  /orders/:orderId
POST /orders/:orderId/cancel
```

## 3.7. Favorites, alerts va notifications

Customer:

- biznesni favorite/unfavorite qiladi;
- category, product, radius, minimum discount va maximum price bo‘yicha deal alert yaratadi;
- yangi mos takliflar haqida in-app notification oladi;
- notificationdan tegishli offer yoki order sahifasiga o‘tadi.

API:

```text
GET    /favorites/businesses
POST   /businesses/:businessId/favorite
DELETE /businesses/:businessId/favorite
POST   /alerts
GET    /alerts
PATCH  /alerts/:alertId
DELETE /alerts/:alertId
GET    /notifications
PATCH  /notifications/:notificationId/read
POST   /notifications/read-all
```

## 3.8. Review va report

Faqat completed orderdan keyin customer review qoldira oladi. Inaccurate offer, noto‘g‘ri narx yoki boshqa muammoni report qiladi.

```text
POST /businesses/:businessId/reviews
POST /reports
```

## 3.9. Main Frontend Definition of Done

- customer register/login qila oladi;
- yaqin takliflarni ko‘radi va filterlaydi;
- offer detail va business detailni ko‘radi;
- inventory bor bo‘lsa rezerv qiladi;
- pickup code oladi;
- order holatini kuzatadi va kerak bo‘lsa cancel qiladi;
- completed orderdan keyin review/report qila oladi;
- favorites, alerts va notifications ishlaydi;
- mobile 360px’dan boshlab ishlaydi;
- loading, empty, error, sold out va expired holatlar mavjud.

---

# 4. Business Frontend — biznes boshqaruv paneli

## 4.1. Maqsadi

Business Frontend biznes egasi va uning jamoasi uchun ishlaydi. Bu frontend marketplace’ga mahsulot chiqarish va kelgan buyurtmani bajarish markazidir.

Bu frontendning asosiy savoli: **“Men mavjud mahsulotimni qanday qilib to‘g‘ri taklif qilaman va buyurtmani qanday topshiraman?”**

## 4.2. Rollar

```text
OWNER   — biznes va barcha sozlamalar ustidan to‘liq nazorat
MANAGER — product, offer, order va branch operatsiyalari
STAFF   — faqat berilgan operational permissionlar
```

Business ID URL’dan kelgani uchun frontend uni ownership deb qabul qilmaydi. Har bir action backend tomonidan qayta tekshiriladi.

## 4.3. Sahifalar

```text
/business                         Business selector
/business/new                     Yangi biznes yaratish
/business/[businessId]            Dashboard
/business/[businessId]/setup      Verification va setup checklist
/business/[businessId]/branches   Filiallar
/business/[businessId]/products   Mahsulotlar
/business/[businessId]/offers     Takliflar
/business/[businessId]/orders     Buyurtmalar
/business/[businessId]/team       Jamoa va permissions
/business/[businessId]/reviews    Reviewlar
/business/[businessId]/analytics  Savdo va inventory statistikasi
/business/[businessId]/settings   Biznes sozlamalari
```

## 4.4. Onboarding va verification

Owner business yaratadi, ma’lumotni to‘ldiradi va reviewga yuboradi:

```text
DRAFT -> PENDING_REVIEW -> VERIFIED
                     \-> REJECTED
                     \-> SUSPENDED
```

`REJECTED` yoki `SUSPENDED` bo‘lsa backend yuborgan `statusReason` ko‘rsatiladi. `VERIFIED` bo‘lmagan business’da publish action disabled bo‘ladi.

API:

```text
POST  /businesses
GET   /businesses/mine
PATCH /businesses/:businessId
POST  /businesses/:businessId/submit-verification
```

## 4.5. Branch boshqaruvi

Owner/manager filial qo‘shadi va tahrirlaydi:

```text
name, address, countryCode, region, city, district,
latitude, longitude, phone, timezone, currency,
openingTime, closingTime
```

Branch statuslari:

```text
ACTIVE, TEMPORARILY_CLOSED, ARCHIVED
```

Archived yoki active bo‘lmagan filialga yangi offer publish qilishga ruxsat berilmaydi.

```text
POST  /businesses/:businessId/branches
GET   /businesses/:businessId/branches
PATCH /businesses/:businessId/branches/:branchId
```

## 4.6. Product boshqaruvi

Product formasi:

```text
categoryId, name, description, status
```

Product statuslari:

```text
DRAFT, ACTIVE, ARCHIVED
```

Frontend quyidagilarni qo‘llaydi:

- product list va search;
- create/edit;
- active category tanlash;
- image upload, preview, retry va sort order;
- archive qilish;
- active bo‘lmagan product uchun offer yaratishni bloklash.

```text
POST  /businesses/:businessId/products
GET   /businesses/:businessId/products
PATCH /businesses/:businessId/products/:productId
POST  /businesses/:businessId/products/:productId/images
DELETE /businesses/:businessId/products/:productId/images/:imageId
```

## 4.7. Offer boshqaruvi

Offer formasi:

```text
branchId, productId, originalPrice, discountPrice,
quantity, pickupStart, pickupEnd, expiresAt
```

Frontend validation:

- discount price original price’dan katta bo‘lmaydi;
- quantity musbat bo‘ladi;
- pickup start pickup end’dan oldin bo‘ladi;
- expiresAt pickup end’dan oldin bo‘lmaydi;
- active branch va active product tanlanadi.

Offer statuslari:

```text
DRAFT, ACTIVE, LOW_STOCK, SOLD_OUT, EXPIRED, CANCELLED
```

Offer oqimi:

```text
product tanlash -> offer yaratish -> draft tekshirish -> publish
                                      -> dynamic discount schedule
                                      -> cancel yoki expiry
```

Quick offer mavjud productdan tez offer yaratish uchun ishlatiladi. Business frontend original/reference price’ni sun’iy oshirib chegirmani ko‘rsatmasligi kerak; backend price history va anomaly tekshiruvini bajaradi.

```text
POST  /businesses/:businessId/offers
GET   /businesses/:businessId/offers
PATCH /businesses/:businessId/offers/:offerId
POST  /businesses/:businessId/offers/quick
POST  /businesses/:businessId/offers/:offerId/publish
POST  /businesses/:businessId/offers/:offerId/discount-schedules
POST  /businesses/:businessId/offers/:offerId/cancel
```

## 4.8. Buyurtmalar

Business orders sahifasida filial, status, vaqt, customer va quantity bo‘yicha filterlar bo‘ladi. Order detail’da customer display name, itemlar, branch, pickup window va status ko‘rsatiladi.

```text
GET  /businesses/:businessId/orders
POST /businesses/:businessId/orders/:orderId/ready
POST /businesses/:businessId/orders/:orderId/complete
```

Business flow:

```text
RESERVED/CONFIRMED -> mahsulotni tayyorlash -> READY
READY -> customer pickup code kiritadi -> COMPLETED
```

Noto‘g‘ri code’da aniq attempt count oshkor qilinmaydi. 5 marta xato bo‘lsa input locked holati ko‘rsatiladi. READY yoki COMPLETED actionlari duplicate click’dan himoyalanadi.

## 4.9. Team, reviews va analytics

Owner jamoa a’zolarini qo‘shadi, role va permission beradi:

```text
POST  /businesses/:businessId/members
GET   /businesses/:businessId/members
PATCH /businesses/:businessId/members/:memberId
```

Business owner quyidagilarni ko‘radi:

- active offers;
- sold/completed quantity;
- revenue;
- discount va expired offerlar;
- conversion signal;
- customer reviewlar;
- inventory muammolari.

```text
GET /businesses/:businessId/reviews
GET /businesses/:businessId/analytics/overview
```

## 4.10. Business Frontend Definition of Done

- business yaratish va verificationga yuborish ishlaydi;
- branch CRUD ishlaydi;
- product CRUD va rasmlar ishlaydi;
- offer yaratish, publish, schedule va cancel ishlaydi;
- order list va detail ishlaydi;
- staff orderni READY qiladi va pickup code bilan COMPLETED qiladi;
- role/permission bo‘yicha menu va actionlar moslashadi;
- analytics va reviewlar ko‘rinadi;
- barcha mutationlarda success/error feedback mavjud.

---

# 5. Admin Frontend — nazorat va moderation paneli

## 5.1. Maqsadi

Admin Frontend Qolmasin marketplace’ining ishonchliligi va tartibini saqlaydi. Bu panel customer yoki business operatsiyalari uchun emas, platforma nazorati uchun ishlatiladi.

Bu frontendning asosiy savoli: **“Platformada kim va qanday kontent bilan ishlayapti, bu kontent ishonchlimi?”**

## 5.2. Rollar

```text
MODERATOR   — business review, report va offer moderation
ADMIN       — moderator vakolatlari va category/audit boshqaruvi
SUPER_ADMIN — tizimdagi eng yuqori ruxsatlar
```

Admin frontenddagi har bir route role guard bilan himoyalanadi.

## 5.3. Sahifalar

```text
/admin                          Admin dashboard
/admin/businesses                Verification queue
/admin/businesses/[businessId]  Business review detail
/admin/categories               Category tree va CRUD
/admin/reports                   Customer report queue
/admin/price-anomalies           Fake discount queue
/admin/offers                    Offer moderation
/admin/audit-logs                Read-only audit log
```

## 5.4. Business verification

Pending businesslar queue ko‘rinishida chiqadi. Admin business profile, type, branch, contact va yuborilgan ma’lumotlarni ko‘rib qaror beradi.

```text
GET  /admin/businesses?status=PENDING_REVIEW
POST /admin/businesses/:businessId/review
```

Review actionlari:

```text
VERIFIED
REJECTED  — reason majburiy
SUSPENDED — reason majburiy
```

Status o‘zgargach queue invalidate qilinadi, business owner notification oladi va frontend yangi statusni ko‘rsatadi.

## 5.5. Category boshqaruvi

Admin category tree’ni boshqaradi:

- create/edit;
- name, slug, description;
- parent/child relation;
- sort order;
- active/inactive status.

Inactive category customer va businessning yangi product formalarida chiqmaydi.

```text
GET   /categories
POST  /admin/categories
PATCH /admin/categories/:categoryId
```

## 5.6. Report va fake discount moderation

Report queue’da report reason, target, actor, sana va current status ko‘rsatiladi. Admin reportni resolve yoki dismiss qiladi.

```text
GET  /admin/reports
POST /admin/reports/:reportId/resolve
```

Price anomaly queue’da reference price, current price, discount foizi va anomaly sababi ko‘rsatiladi. Admin tekshirmasdan offerni qayta publish qilishga urinmaydi.

```text
GET  /admin/price-anomalies
POST /admin/price-anomalies/:anomalyId/resolve
POST /admin/offers/:offerId/hide
POST /admin/offers/:offerId/unhide
```

## 5.7. Audit logs

Audit log faqat ko‘rish uchun:

- actor va role;
- action;
- entity type/id;
- request ID;
- sana;
- metadata;
- filter va pagination.

```text
GET /admin/audit-logs
```

Raw IP ko‘rsatilmaydi. Audit log o‘chirilmaydi va frontendda edit/delete action bo‘lmaydi.

## 5.8. Admin Frontend Definition of Done

- pending business queue ishlaydi;
- business VERIFIED/REJECTED/SUSPENDED qilinadi;
- category tree CRUD ishlaydi;
- reportlar resolve/dismiss qilinadi;
- price anomaly ko‘riladi va resolve qilinadi;
- kerak bo‘lsa offer hide/unhide qilinadi;
- audit log filter, detail va pagination bilan chiqadi;
- admin bo‘lmagan user route’ga kira olmaydi.

---

# 6. Pickup/Operations Frontend — filial xodimi ekrani

## 6.1. Maqsadi

Pickup/Operations Frontend — Business Frontend ichidagi katta dashboard emas, pickup nuqtasida tez ishlaydigan alohida operational interfeys. Uni kassir, filial xodimi yoki order topshiruvchi ishlatadi.

Bu frontendning asosiy savoli: **“Customer kelganda uning buyurtmasini qanday tez va xavfsiz topshiraman?”**

U desktop, tablet yoki filialdagi telefon ekranida ishlashi, katta tugma va katta inputlarga ega bo‘lishi kerak.

## 6.2. Kim ishlatadi?

```text
STAFF — pickup/order permission berilgan xodim
MANAGER — filial operatsiyalarini ko‘rishi mumkin
OWNER — barcha filial operatsiyalarini ko‘rishi mumkin
```

Staff boshqa business yoki boshqa filial orderlarini ko‘ra olmaydi. Bu chegarani backend belgilaydi.

## 6.3. Asosiy ekranlar

```text
/pickup                         Filial tanlash va shift holati
/pickup/[branchId]/orders       Bugungi orderlar
/pickup/[branchId]/orders/[id]  Order detail
/pickup/[branchId]/verify       Pickup code tekshirish
/pickup/[branchId]/history      Yakunlangan orderlar
```

## 6.4. Bugungi orderlar ekrani

Orderlar status bo‘yicha guruhlanadi:

```text
Yangi / RESERVED
Tayyorlanmoqda / CONFIRMED
Tayyor / READY
Yakunlangan / COMPLETED
Bekor qilingan / CANCELLED
Muddati o‘tgan / EXPIRED
```

Har bir order card’da order number, itemlar, quantity, pickup window, expiry va zarur action ko‘rsatiladi. Pickup xodimiga keraksiz analytics yoki admin ma’lumotlari ko‘rsatilmaydi.

## 6.5. Orderni tayyorlash

Xodim order itemlarini yig‘adi va `READY` tugmasini bosadi:

```text
POST /businesses/:businessId/orders/:orderId/ready
```

Backend pickup window, order status va permissionni tekshiradi. Xato bo‘lsa frontend aniq sababni chiqaradi: order expired, cancelled, boshqa status yoki permission yo‘q.

## 6.6. Pickup code tekshirish

Customer pickup code’ni ko‘rsatadi. Xodim:

1. orderni order number yoki listdan topadi;
2. code’ni qo‘lda kiritadi yoki paste qiladi;
3. code’ni customer bilan tasdiqlaydi;
4. `COMPLETED` actionini yuboradi;
5. muvaffaqiyatli bo‘lsa orderni “Topshirildi” deb yopadi.

```text
POST /businesses/:businessId/orders/:orderId/complete
```

Wrong code’da frontend umumiy xato ko‘rsatadi. Attempt count yoki hash kabi ichki xavfsizlik ma’lumotlari ko‘rsatilmaydi. 5 ta xatodan keyin verify form locked bo‘ladi va managerga murojaat qilish xabari chiqadi.

## 6.7. Operational UX talablari

- asosiy actionlar bitta ekranda bo‘ladi;
- `READY` va `COMPLETED` uchun confirm kerak;
- duplicate click lock qilinadi;
- network uzilsa “Qayta urinish” tugmasi chiqadi;
- order status actiondan keyin avtomatik yangilanadi;
- boshqa filial orderi URL orqali ochilsa backend xatosi bilan yopiladi;
- customer pickup code analytics va loglarda saqlanmaydi;
- ekran tablet/mobile’da ham qulay ishlaydi;
- order expiry va pickup window mahalliy branch timezone’da ko‘rsatiladi.

## 6.8. Pickup/Operations Frontend Definition of Done

- staff faqat ruxsat berilgan filialni tanlaydi;
- bugungi orderlar tez yuklanadi;
- order `READY` qilinadi;
- pickup code xavfsiz tekshiriladi;
- order `COMPLETED` qilinadi;
- expired/cancelled/order status xatolari tushunarli chiqadi;
- duplicate submit va wrong code limitlari UI’da boshqariladi;
- barcha critical actionlar backend response’dan keyin success deb belgilanadi.

---

# 7. Frontendlar orasidagi ish taqsimoti

```text
Customer topadi va rezerv qiladi
        ↓
Business xodimi orderni ko‘radi va tayyorlaydi
        ↓
Pickup/Operations xodimi code’ni tekshiradi va topshiradi
        ↓
Customer orderni baholaydi yoki report qiladi
        ↓
Admin zarur bo‘lsa biznes, report, narx yoki offerni moderatsiya qiladi
```

| Ish | Main | Business | Admin | Pickup |
|---|---:|---:|---:|---:|
| Offerlarni ko‘rish | ✅ | ✅ o‘z biznesi | ✅ moderation uchun | ✅ faqat order tarkibi |
| Offer yaratish/publish | — | ✅ | — | — |
| Business verification | — | yuboradi | ✅ qaror qiladi | — |
| Order yaratish/reserve | ✅ | — | — | — |
| Orderni READY qilish | — | ✅ | — | ✅ |
| Pickup code bilan complete | — | ✅ | — | ✅ |
| Category CRUD | — | — | ✅ | — |
| Review/report yuborish | ✅ | — | — | — |
| Report/anomaly moderation | — | — | ✅ | — |
| Business analytics | — | ✅ o‘z biznesi | ✅ umumiy nazorat | — |

## 8. Qaysi frontenddan boshlanadi?

Tavsiya etilgan ishlab chiqish tartibi:

1. **Main Frontend** — customer marketplace va rezerv oqimi bo‘lmasa qolgan frontendlar sinab ko‘rilmaydi.
2. **Business Frontend** — product, offer va order tayyorlash oqimi.
3. **Pickup/Operations Frontend** — filialdagi tezkor pickup jarayoni.
4. **Admin Frontend** — verification, moderation, category va audit.

Har bir frontend alohida deploy qilinishi mumkin, lekin barchasi bir xil backend API, auth qoidalari, error formatlari va design systemdan foydalanadi.

## 9. Frontend jamoalari uchun yakuniy qoida

```text
Main       — topadi, tanlaydi, rezerv qiladi, olib ketadi
Business   — mahsulot qo‘shadi, taklif chiqaradi, orderni tayyorlaydi
Admin      — tekshiradi, tartibga soladi, moderatsiya qiladi
Pickup     — code tekshiradi va mahsulotni topshiradi
```

Hech bir frontend backend authorization’ni chetlab o‘tmaydi. Frontend faqat qulay interfeys beradi; status, narx, inventory, ownership, permission, pickup code va moderation bo‘yicha yakuniy qaror har doim backendda qoladi.

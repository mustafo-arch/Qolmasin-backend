# Qolmasin — Frontend Color System

## 1. Brand yo‘nalishi

Qolmasin frontend dizayni:

- zamonaviy;
- toza;
- ishonchli;
- oziq-ovqat marketplace'iga mos;
- haddan tashqari yashil yoki ekologik ko‘rinishga ketmaydigan;
- chegirma va foydani ham aniq ko‘rsatadigan

bo‘lishi kerak.

Asosiy ranglar:

- **Deep Green** — ishonch, mahsulot, tabiat, asosiy brand
- **Warm Orange** — chegirma, action, e’tibor
- **Soft White** — toza fon
- **Charcoal** — matn
- **Soft Gray** — border va secondary UI

---

# 2. Primary Brand Colors

## Deep Green — Primary

```css
--brand-primary: #0B5D3B;
```

Ishlatiladi:

- logo;
- primary button;
- navbar;
- active tab;
- important headings;
- icons;
- selected states.

Hover:

```css
--brand-primary-hover: #084A2F;
```

Light:

```css
--brand-primary-light: #EAF5EF;
```

---

## Warm Orange — Accent

```css
--brand-accent: #F7931E;
```

Ishlatiladi:

- discount;
- CTA;
- badge;
- special offer;
- urgency;
- price highlight.

Hover:

```css
--brand-accent-hover: #E47F0D;
```

Light:

```css
--brand-accent-light: #FFF3E3;
```

---

# 3. Background Colors

Main background:

```css
--bg-main: #FAFAF7;
```

Card background:

```css
--bg-card: #FFFFFF;
```

Section background:

```css
--bg-soft: #F3F7F4;
```

Dark section:

```css
--bg-dark: #0E1F18;
```

---

# 4. Text Colors

Primary text:

```css
--text-primary: #16211C;
```

Secondary text:

```css
--text-secondary: #66736C;
```

Muted text:

```css
--text-muted: #98A29D;
```

Text on green:

```css
--text-on-primary: #FFFFFF;
```

Text on orange:

```css
--text-on-accent: #FFFFFF;
```

---

# 5. Border Colors

Default:

```css
--border-default: #E2E8E4;
```

Strong:

```css
--border-strong: #CBD5CF;
```

Focus:

```css
--border-focus: #0B5D3B;
```

---

# 6. Semantic Colors

Success:

```css
--success: #1F9D63;
--success-bg: #EAF8F1;
```

Warning:

```css
--warning: #F5A623;
--warning-bg: #FFF7E8;
```

Error:

```css
--error: #D64545;
--error-bg: #FDECEC;
```

Info:

```css
--info: #3478F6;
--info-bg: #EBF2FF;
```

---

# 7. Discount Colors

Discount badge:

```css
--discount: #F7931E;
--discount-bg: #FFF3E3;
```

Urgent discount:

```css
--discount-urgent: #E85D3F;
--discount-urgent-bg: #FFF0EC;
```

Example:

```text
-20%  → orange
-40%  → orange
-60%+ → urgent coral/red
```

---

# 8. Price Colors

Original price:

```css
--price-old: #9AA39E;
```

Discount price:

```css
--price-current: #0B5D3B;
```

Super deal:

```css
--price-deal: #F7931E;
```

Example:

```text
40 000 so‘m  → gray + line-through
24 000 so‘m  → deep green
-40%         → orange badge
```

---

# 9. Button System

## Primary Button

Background:

```css
#0B5D3B
```

Text:

```css
#FFFFFF
```

Hover:

```css
#084A2F
```

Example:

```text
Buyurtma qilish
Rezerv qilish
Davom etish
```

---

## Accent Button

Background:

```css
#F7931E
```

Text:

```css
#FFFFFF
```

Hover:

```css
#E47F0D
```

Example:

```text
Bugungi takliflar
Chegirmani ko‘rish
```

---

## Secondary Button

Background:

```css
#FFFFFF
```

Border:

```css
#CBD5CF
```

Text:

```css
#16211C
```

Hover:

```css
#F3F7F4
```

---

# 10. Card Design

Card background:

```css
#FFFFFF
```

Border:

```css
#E2E8E4
```

Shadow:

```css
0 8px 24px rgba(14, 31, 24, 0.06)
```

Radius:

```css
16px
```

Hover shadow:

```css
0 12px 32px rgba(14, 31, 24, 0.10)
```

---

# 11. Recommended Gradient

Gradientni kam ishlatish kerak.

Hero yoki promo banner uchun:

```css
background: linear-gradient(
  135deg,
  #0B5D3B 0%,
  #12815A 100%
);
```

Orange promo:

```css
background: linear-gradient(
  135deg,
  #F7931E 0%,
  #FFB347 100%
);
```

Logo yoki asosiy UI'da ortiqcha gradient ishlatma.

---

# 12. Tailwind Example

```ts
colors: {
  brand: {
    primary: '#0B5D3B',
    'primary-hover': '#084A2F',
    'primary-light': '#EAF5EF',

    accent: '#F7931E',
    'accent-hover': '#E47F0D',
    'accent-light': '#FFF3E3',
  },

  surface: {
    main: '#FAFAF7',
    card: '#FFFFFF',
    soft: '#F3F7F4',
    dark: '#0E1F18',
  },

  text: {
    primary: '#16211C',
    secondary: '#66736C',
    muted: '#98A29D',
  },

  border: {
    DEFAULT: '#E2E8E4',
    strong: '#CBD5CF',
  },

  success: '#1F9D63',
  warning: '#F5A623',
  error: '#D64545',
  info: '#3478F6',
}
```

---

# 13. CSS Variables

```css
:root {
  --brand-primary: #0B5D3B;
  --brand-primary-hover: #084A2F;
  --brand-primary-light: #EAF5EF;

  --brand-accent: #F7931E;
  --brand-accent-hover: #E47F0D;
  --brand-accent-light: #FFF3E3;

  --bg-main: #FAFAF7;
  --bg-card: #FFFFFF;
  --bg-soft: #F3F7F4;
  --bg-dark: #0E1F18;

  --text-primary: #16211C;
  --text-secondary: #66736C;
  --text-muted: #98A29D;

  --border-default: #E2E8E4;
  --border-strong: #CBD5CF;

  --success: #1F9D63;
  --warning: #F5A623;
  --error: #D64545;
  --info: #3478F6;

  --discount: #F7931E;
  --discount-urgent: #E85D3F;
}
```

---

# 14. Frontend uchun rang ishlatish qoidalari

## 70 / 20 / 10 qoida

UI ichida:

```text
70% → white / soft neutral
20% → deep green
10% → orange
```

Bu dizaynni professional saqlaydi.

Orange rangni har joyga ishlatma.

Orange faqat:

- discount;
- CTA;
- limited offer;
- special highlight.

Green esa:

- navigation;
- primary actions;
- verified status;
- brand identity.

---

# 15. Product Card Example

```text
┌──────────────────────────────┐
│ [Product Image]              │
│                              │
│ -40%                800 m    │
│                              │
│ Tandir non                   │
│ Registon Nonvoyxonasi        │
│                              │
│ 4 000     2 400 so‘m        │
│                              │
│ 20:30 gacha                  │
│                              │
│ [ Rezerv qilish ]            │
└──────────────────────────────┘
```

Ranglar:

```text
-40%              → orange
800 m             → muted gray
Product name      → dark text
Old price         → gray
New price         → deep green
Time              → orange if urgent
Reserve button    → deep green
```

---

# 16. Navbar

Background:

```css
#FFFFFF
```

Logo:

```text
Deep Green + Orange
```

Active menu:

```css
#0B5D3B
```

Inactive:

```css
#66736C
```

Bottom border:

```css
#E2E8E4
```

Navbarni to‘liq yashil qilish faqat desktop landing page hero'da kerak bo‘lsa ishlatiladi.

Marketplace ichida white navbar tavsiya qilinadi.

---

# 17. Hero Section

Background:

```css
#FAFAF7
```

Heading:

```css
#16211C
```

Important word:

```css
#0B5D3B
```

CTA:

```css
#F7931E
```

Example:

```text
Yaxshi mahsulot
isrof bo‘lmasin.

Yaqiningizdagi bugungi
eng yaxshi takliflarni toping.

[ Bugungi takliflarni ko‘rish ]
```

---

# 18. Dark Mode

Dark background:

```css
--dark-bg: #0D1712;
```

Dark surface:

```css
--dark-card: #14221A;
```

Dark border:

```css
--dark-border: #26382E;
```

Text:

```css
--dark-text: #F3F7F4;
```

Muted:

```css
--dark-muted: #9DAAA2;
```

Primary green dark mode:

```css
--dark-primary: #35B77C;
```

Accent:

```css
--dark-accent: #FFA33A;
```

---

# 19. Avoid

Quyidagilarni ishlatma:

- neon green;
- haddan tashqari ko‘p gradient;
- har cardda orange background;
- qora + qizil dominant design;
- juda och yashil matn;
- bir ekranda 5+ brand color;
- food delivery app'lardagi haddan tashqari qizil rang.

Qolmasin vizual identiteti:

```text
Fresh
Clean
Useful
Affordable
Trustworthy
Modern
```

bo‘lishi kerak.

---

# 20. Final Palette

| Role | Color | HEX |
|---|---|---|
| Primary | Deep Green | `#0B5D3B` |
| Primary Hover | Dark Green | `#084A2F` |
| Primary Light | Soft Green | `#EAF5EF` |
| Accent | Warm Orange | `#F7931E` |
| Accent Hover | Dark Orange | `#E47F0D` |
| Accent Light | Soft Orange | `#FFF3E3` |
| Main Background | Warm White | `#FAFAF7` |
| Card | White | `#FFFFFF` |
| Text | Charcoal | `#16211C` |
| Secondary Text | Gray Green | `#66736C` |
| Border | Soft Gray | `#E2E8E4` |
| Success | Green | `#1F9D63` |
| Warning | Amber | `#F5A623` |
| Error | Red | `#D64545` |
| Info | Blue | `#3478F6` |

---

# 21. Agent uchun qisqa qoida

Frontend agent ushbu ranglardan tashqariga sababsiz chiqmasin.

Primary action:

```text
Deep Green
```

Discount / urgent / promo:

```text
Warm Orange
```

Main UI:

```text
White + Warm White
```

Text:

```text
Charcoal
```

Success:

```text
Green
```

Danger:

```text
Red
```

Dizayn maqsadi:

```text
Qolmasin bir qarashda
"arzon mahsulot + isrofni kamaytirish + ishonchli marketplace"
ekanini his qildirsin.
```

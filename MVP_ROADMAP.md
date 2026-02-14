# 🚀 STATIC ENGINE — MVP BACKEND ROADMAP

## To'liq Backend Tahlili + MVP Status

### Yangilangan: 15-Feb-2026

---

## 📊 UMUMIY HOLAT

| Ma'lumot | Qiymat |
|---|---|
| Framework | NestJS v11 (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (jsonwebtoken, bcryptjs) |
| Queue | BullMQ + Redis (IORedis) |
| AI | Claude (Anthropic SDK) + Gemini (Imagen 3) |
| Storage | Supabase Storage + Local Disk (uploads/) |
| WebSocket | Socket.IO (@nestjs/websockets) |
| Port | 3007 |

---

## 📈 PROGRESS DASHBOARD

| # | Modul | Jami Endpoint | ✅ Tayyor | ❌ Qoldi | Foiz |
|---|---|---|---|---|---|
| 1 | Auth / Member | 8 | ✅ 8 | 0 | **100%** |
| 2 | Brand | 6 | ✅ 6 | 0 | **100%** |
| 3 | Product | 6 | ✅ 6 | 0 | **100%** |
| 4 | Concept | 6 | ✅ 6 | 0 | **100%** |
| 5 | Generation | 6 | ✅ 1 | ❌ 5 | **17%** |
| 6 | Library | 9 | 0 | ❌ 9 | 0% |
| 7 | Billing (Stripe) | 5 | 0 | ❌ 5 | 0% |
| 8 | Canva | 2 | 0 | ❌ 2 | 0% |
| 9 | Admin Panel | 11 | 0 | ❌ 11 | 0% |
| | **JAMI** | **59** | **✅ 27** | **❌ 32** | **46%** |

> ⚠️ Oldingi versiyada file upload endpointlar hisoblanmagan edi. Haqiqatda brand/product/concept uchun upload allaqachon tayyor.

### Infratuzilma (Module ichiga kirmaydi, lekin tayyor):

| Komponent | Holat | Tafsilot |
|---|---|---|
| NestJS App Module | ✅ Tayyor | 6 modul ro'yxatdan o'tgan |
| Supabase DB Client | ✅ Tayyor | DatabaseModule + DatabaseService |
| JWT Auth System | ✅ Tayyor | AuthGuard, token verify + status check |
| Role-Based Access | ✅ Tayyor | RolesGuard (SUPER_ADMIN, CONTENT_ADMIN, SUPPORT) |
| Credit System Guard | ✅ Tayyor | CreditsGuard + @RequireCredits decorator |
| Decorators | ✅ Tayyor | @AuthMember, @Roles, @RequireCredits |
| ValidationPipe | ✅ Tayyor | Global validation, class-validator |
| Logging Interceptor | ✅ Tayyor | HTTP request/response logging |
| BullMQ Queue | ✅ Tayyor | Redis + generation queue configured |
| Claude AI Service | ✅ Tayyor | Prompt assembly + DB prompt templates |
| Gemini AI Service | ✅ Tayyor | Imagen 3 API, 3 ratio parallel generation |
| Storage Service | ✅ Tayyor | Supabase Storage upload + public URL |
| Local File Upload | ✅ Tayyor | diskStorage — brands/, products/, concepts/ papkalar |
| WebSocket Gateway | ✅ Tayyor | Socket.IO — progress, completed, failed events |
| SQL Schemas | ✅ Tayyor | 16 ta schema file |
| Deduct Credits RPC | ✅ Tayyor | FOR UPDATE lock bilan atomic credit deduction |
| System Config | ✅ Tayyor | Admin-configurable settings |
| DTOs | ✅ Tayyor | 12 ta DTO (Member 3, Brand 2, Product 2, Concept 2, Generation 1, Admin 2) |
| Enums | ✅ Tayyor | 8 ta enum |
| Types | ✅ Tayyor | 10 ta type definition |

---

## ✅ BAJARILGANLAR — TO'LIQ TAYYOR

---

### 1️⃣ AUTH / MEMBER MODULE (`/member`) — ✅ 8/8 COMPLETE

| # | Endpoint | Guard | Status |
|---|---|---|---|
| 1.1 | `POST /member/signup` | 🔓 Public | ✅ |
| 1.2 | `POST /member/login` | 🔓 Public | ✅ |
| 1.3 | `GET /member/getMember` | 🔒 Auth | ✅ |
| 1.4 | `POST /member/updateMember` | 🔒 Auth | ✅ |
| 1.5 | `POST /member/deleteMember` | 🔒 Auth | ✅ (soft delete) |
| 1.6 | `GET /member/getUsage` | 🔒 Auth | ✅ |
| 1.7 | `POST /member/adminSignup` | 🔓 Public | ✅ (admin ro'yxatdan o'tish) |
| 1.8 | `POST /member/adminLogin` | 🔓 Public | ✅ (admin kirish) |

**Xususiyatlar:** Signup reactivation (deleted user restore), bcrypt 12 rounds, JWT 7d expiry, credit/subscription fields. Admin auth ham shu yerda — admin_users jadvalida alohida.

---

### 2️⃣ BRAND MODULE (`/brand`) — ✅ 6/6 COMPLETE

| # | Endpoint | Guard | Status |
|---|---|---|---|
| 2.1 | `POST /brand/uploadLogo` | 🔒 Auth | ✅ (Multer, diskStorage, 5MB, PNG/JPG/WEBP) |
| 2.2 | `POST /brand/createBrand` | 🔒 Auth | ✅ |
| 2.3 | `GET /brand/getBrands` | 🔒 Auth | ✅ (paginated) |
| 2.4 | `GET /brand/getBrandById/:id` | 🔒 Auth | ✅ |
| 2.5 | `POST /brand/updateBrandById/:id` | 🔒 Auth | ✅ (partial) |
| 2.6 | `POST /brand/deleteBrandById/:id` | 🔒 Auth | ✅ (hard delete) |

**Fields:** name, description, website_url, industry (12 enum), logo_url, primary_color, secondary_color, accent_color, background_color, voice_tags[] (10 enum), target_audience, competitors.

---

### 3️⃣ PRODUCT MODULE (`/product`) — ✅ 6/6 COMPLETE

| # | Endpoint | Guard | Status |
|---|---|---|---|
| 3.1 | `POST /product/uploadPhoto` | 🔒 Auth | ✅ (Multer, diskStorage, 10MB, PNG/JPG/WEBP) |
| 3.2 | `POST /product/createProduct` | 🔒 Auth | ✅ |
| 3.3 | `GET /product/getProducts/:brandId` | 🔒 Auth | ✅ (paginated, brand ownership) |
| 3.4 | `GET /product/getProductById/:id` | 🔒 Auth | ✅ (JOIN ownership) |
| 3.5 | `POST /product/updateProductById/:id` | 🔒 Auth | ✅ (partial) |
| 3.6 | `POST /product/deleteProductById/:id` | 🔒 Auth | ✅ (hard delete) |

**Fields:** brand_id, name, description, usps[](min 1, max 5), photo_url, has_physical_product, price_text, product_url, star_rating(1.0-5.0), review_count, ingredients_features, before_description, after_description, offer_text.

---

### 4️⃣ CONCEPT MODULE (`/concept`) — ✅ 6/6 COMPLETE

| # | Endpoint | Guard | Status |
|---|---|---|---|
| 4.1 | `POST /concept/uploadImage` | 👑 Admin | ✅ (Multer, diskStorage, 10MB, SUPER_ADMIN+CONTENT_ADMIN) |
| 4.2 | `GET /concept/getConcepts` | 🔒 Auth | ✅ (category filter, tags search, pagination) |
| 4.3 | `GET /concept/getRecommended` | 🔒 Auth | ✅ (usage_count top 10) |
| 4.4 | `POST /concept/createConceptByAdmin` | 👑 Admin | ✅ (SUPER_ADMIN, CONTENT_ADMIN) |
| 4.5 | `POST /concept/updateConceptByAdmin/:id` | 👑 Admin | ✅ (partial update) |
| 4.6 | `POST /concept/deleteConceptByAdmin/:id` | 👑 Admin | ✅ (faqat SUPER_ADMIN) |

**DTOs:** CreateConceptDto (7 field), UpdateConceptDto (8 field — all optional).

---

### 5️⃣ GENERATION MODULE (`/generation`) — 🔧 1/6 (PIPELINE TAYYOR)

| # | Endpoint | Guard | Status |
|---|---|---|---|
| 5.1 | `POST /generation/createGeneration` | 🔒 Auth + 💰 Credits (5) + ⏱ Throttle (3/min) | ✅ |
| 5.2 | `GET /generation/getStatus/:jobId` | 🔒 Auth | ❌ |
| 5.3 | `GET /generation/getResults/:jobId` | 🔒 Auth | ❌ |
| 5.4 | `POST /generation/fixErrors/:adId` | 🔒 Auth + 💰 Credits (2) | ❌ |
| 5.5 | `POST /generation/regenerateSingle/:adId` | 🔒 Auth + 💰 Credits (2) | ❌ |
| 5.6 | `POST /generation/exportRatios/:adId` | 🔒 Auth (BEPUL) | ❌ |

#### ✅ `createGeneration` — To'liq Pipeline Ishlamoqda:

1. **Validation**: Brand ownership → Product-Brand link → Active Concept tekshiruvi
2. **DB Insert**: `generated_ads` jadvalida yangi row (status: pending)
3. **Credit Deduction**: `deduct_credits` RPC (FOR UPDATE lock bilan atomic)
4. **Credit Transaction**: `credit_transactions` jadvaliga yozish
5. **BullMQ Job**: Queue'ga `create-ad` job qo'shish (2 retry, exponential backoff)
6. **Processor Pipeline**:
   - Job authentication (user_id + ad status tekshiruvi)
   - Status → PROCESSING (WebSocket progress emit)
   - Brand + Product + Concept parallel fetch
   - **Claude API** → ad copy generatsiya (headline, subheadline, body_text, callouts, cta, gemini_image_prompt)
   - **Gemini Imagen 3 API** → 3 ta ratio parallel (1:1, 9:16, 16:9)
   - **Supabase Storage** → 3 ta rasm upload + public URL olish
   - **DB Update**: claude_response_json, gemini_prompt, image URLs, ad_copy_json, status → COMPLETED
   - Concept usage_count++ (increment_usage_count RPC fallback bilan)
   - **WebSocket**: generation:completed event emit
7. **Error Handling**: Status → FAILED, WebSocket failed event, job retry

#### ✅ Tayyor Infratuzilma (Generation uchun):

| Komponent | Fayl | Holat |
|---|---|---|
| Controller | `generation.controller.ts` | ✅ 1 endpoint |
| Service | `generation.service.ts` | ✅ 143 qator, to'liq validation + job queue |
| Processor | `generation.processor.ts` | ✅ 243 qator, to'liq pipeline |
| Module | `generation.module.ts` | ✅ BullMQ, Redis, all services |
| Claude Service | `libs/services/claude.service.ts` | ✅ 184 qator, DB prompt + fallback |
| Gemini Service | `libs/services/gemini.service.ts` | ✅ 126 qator, Imagen 3, 3-ratio parallel |
| Storage Service | `libs/services/storage.service.ts` | ✅ 46 qator, Supabase Storage |
| WebSocket Gateway | `socket/generation.gateway.ts` | ✅ 3 events (progress, completed, failed) |
| DTO | `dto/generation/create-generation.dto.ts` | ✅ brand_id, product_id, concept_id, important_notes |
| Enum | `enums/generation/generation.enum.ts` | ✅ PENDING, PROCESSING, COMPLETED, FAILED |
| Types | `types/generation/generation.type.ts` | ✅ GeneratedAd, ClaudeResponseJson, AdCopyJson, Generation, GenerationJobData |

---

## ❌ BAJARILMAGANLAR — QILISH KERAK

---

### 5️⃣ GENERATION (qolgan 5 endpoint)

#### 5.2 ❌ `GET /generation/getStatus/:jobId`
- DB'dan `generated_ads.generation_status` olish
- BullMQ'dan job progress olish (agar job hali queue'da bo'lsa)
- Response: `{ job_id, status, progress_percent, current_step }`
- **Murakkablik: Past** — oddiy DB query

#### 5.3 ❌ `GET /generation/getResults/:jobId`
- DB'dan `generated_ads` to'liq olish (images, copy, metadata)
- Brand/product snapshot bilan birga
- Response: `{ job_id, status, ads: GeneratedAd[] }`
- **Murakkablik: Past** — oddiy DB query

#### 5.4 ❌ `POST /generation/fixErrors/:adId` (2 credit)
- Mavjud rasm + user error description → Claude visual analysis
- Claude yangilangan Gemini prompt yaratadi
- Gemini qayta generatsiya qiladi
- Yangi vs original comparison uchun yangi image_url
- **Murakkablik: O'rta** — mavjud pipeline ustiga qurish mumkin

#### 5.5 ❌ `POST /generation/regenerateSingle/:adId` (2 credit)
- Bitta slotni qayta yaratish (boshqa 5 ta saqlanadi)
- Additional notes bilan
- **Murakkablik: O'rta** — mavjud pipeline ustiga qurish

#### 5.6 ❌ `POST /generation/exportRatios/:adId` (BEPUL)
- **Hozir deyarli tayyor** — `createGeneration` allaqachon 3 ratio generatsiya qilmoqda
- Faqat endpoint qo'shish + foydalanuvchi tanlagan ratio'larni qayta generatsiya
- **Murakkablik: Past** — pipeline bor, faqat endpoint va ratio logic

---

### 6️⃣ LIBRARY MODULE (`/library`) — ❌ 0/9

> PDF Section 11 — Ad Library & Organization System

| # | Endpoint | Murakkablik | Izoh |
|---|---|---|---|
| 6.1 | `GET /library/getAds` | Past | Paginated list, filter by brand/category/folder |
| 6.2 | `POST /library/saveAd` | Past | `is_saved = true` update |
| 6.3 | `POST /library/createFolder` | Past | ad_folders insert |
| 6.4 | `POST /library/updateFolderById/:id` | Past | Folder name update |
| 6.5 | `POST /library/deleteFolderById/:id` | Past | Delete + move ads to root |
| 6.6 | `POST /library/moveAd/:adId` | Past | folder_id update |
| 6.7 | `POST /library/downloadAd/:adId` | O'rta | Ratio + format + resolution select → binary |
| 6.8 | `POST /library/bulkDownload` | O'rta | Multiple ads → ZIP archive |
| 6.9 | `POST /library/deleteAd/:adId` | Past | Hard delete or is_saved=false |

**Tayyor infratuzilma:** `ad_folders` SQL schema, `generated_ads` schema (is_saved, is_favorite, folder_id) — hammasi bor.
**Kerak:** Library module (controller, service, module), DTOs.

---

### 7️⃣ BILLING MODULE (`/billing`) — ❌ 0/5

> PDF Section 3 — Stripe Integration

| # | Endpoint | Murakkablik | Izoh |
|---|---|---|---|
| 7.1 | `POST /billing/createCheckout` | Yuqori | Stripe Checkout session yaratish |
| 7.2 | `POST /billing/getPortal` | O'rta | Stripe Customer Portal URL |
| 7.3 | `GET /billing/getUsage` | Past | Credit usage batafsil |
| 7.4 | `POST /billing/purchaseAddon` | O'rta | 100 credit add-on ($15) checkout |
| 7.5 | `POST /webhooks/stripe` | Yuqori | checkout.session.completed, invoice.*, subscription.* |

**Tayyor infratuzilma:** subscriptions, subscription_tiers, system_config, credit_transactions schema + SubscriptionTier/Status enum + deduct_credits RPC.
**Kerak:** `stripe` npm package, Billing module (controller, service, module), webhook handler, DTOs.

---

### 8️⃣ CANVA MODULE (`/canva`) — ❌ 0/2

> PDF Section 10 — Canva Template Marketplace

| # | Endpoint | Murakkablik | Izoh |
|---|---|---|---|
| 8.1 | `POST /canva/purchase` | O'rta | Stripe Checkout → canva_orders insert |
| 8.2 | `GET /canva/getOrders` | Past | User's canva orders list |

**Tayyor infratuzilma:** `canva_orders` SQL schema, system_config pricing.
**Kerak:** Canva module (controller, service, module), DTOs. Stripe kerak (billing module bilan birga).

---

### 9️⃣ ADMIN MODULE (`/admin`) — ❌ 0/11

> PDF Section 13 — Admin Dashboard

> ⚠️ **ESLATMA:** Admin auth (signup/login) allaqachon `/member/adminSignup` va `/member/adminLogin` endpointlari orqali ishlaydi. Faqat admin panel endpointlari qolgan.

| # | Endpoint | Murakkablik | Izoh |
|---|---|---|---|
| 9.1 | `GET /admin/getDashboard` | O'rta | Aggregate stats (users, generations, revenue) |
| 9.2 | `GET /admin/getMembers` | Past | Paginated + filterable user list |
| 9.3 | `GET /admin/getMemberById/:id` | Past | User detail + subscription + history |
| 9.4 | `POST /admin/updateMemberById/:id` | Past | Credits, tier, status adjust |
| 9.5 | `POST /admin/suspendMemberById/:id` | Past | member_status → SUSPENDED |
| 9.6 | `GET /admin/getConfig` | Past | system_config table read |
| 9.7 | `POST /admin/updateConfig` | Past | system_config table update |
| 9.8 | `GET /admin/getPrompts` | Past | prompt_templates list |
| 9.9 | `POST /admin/updatePromptById/:id` | O'rta | Version history + new version create |
| 9.10 | `GET /admin/getCanvaOrders` | Past | Canva orders queue (admin view) |
| 9.11 | `POST /admin/updateCanvaOrderById/:id` | Past | Status update + canva_link |

**Tayyor:** Admin auth ✅, AdminRole enum ✅, RolesGuard ✅, Admin DTOs ✅, Admin Type ✅.
**Kerak:** Admin module (controller, service, module), admin-specific middleware.

---

## 🗄️ DATABASE SCHEMAS — BARCHASI TAYYOR ✅

| # | Jadval | Holat | Izoh |
|---|---|---|---|
| 1 | `users` | ✅ | Auth, subscription, credits |
| 2 | `brands` | ✅ | Brand profiles (12 industry, 10 voice) |
| 3 | `products` | ✅ | Products under brands |
| 4 | `ad_concepts` | ✅ | Template library |
| 5 | `generated_ads` | ✅ | Core — 3 ratio images, copy, snapshots |
| 6 | `ad_folders` | ✅ | Library folder organization |
| 7 | `canva_orders` | ✅ | Canva template purchases |
| 8 | `subscriptions` | ✅ | Stripe subscription sync |
| 9 | `subscription_tiers` | ✅ | Pricing tiers with credits |
| 10 | `credit_transactions` | ✅ | Credit usage audit log |
| 11 | `generation_logs` | ✅ | AI API call tracking |
| 12 | `admin_users` | ✅ | Admin accounts |
| 13 | `prompt_templates` | ✅ | Versioned AI prompts |
| 14 | `system_config` | ✅ | Admin-configurable settings |

**Functions:** `deduct_credits` ✅ (atomic credit deduction with FOR UPDATE lock)
**Migrations:** `001_initial_schema.sql` ✅
**RLS:** Barcha userga bog'liq jadvallar uchun Row Level Security ✅

---

## 🎯 MVP UCHUN KRITIK YO'L (Priority Order)

### 🔴 P0 — MVP uchun majburiy

| # | Vazifa | Taxminiy vaqt | Sababi |
|---|---|---|---|
| 1 | **Generation qolgan endpointlar** (getStatus, getResults) | 0.5 kun | Foydalanuvchi natijani ko'rishi kerak |
| 2 | **Library modul** (9 endpoint) | 1-1.5 kun | Generatsiya natijalarini saqlash/yuklab olish |
| 3 | **Billing modul** (Stripe) | 2-3 kun | Monetizatsiya — sign up → pay → use flow |

### 🟡 P1 — MVP loyiqligi uchun muhim

| # | Vazifa | Taxminiy vaqt | Sababi |
|---|---|---|---|
| 4 | **Generation: fixErrors + regenerateSingle** | 1 kun | Core UX — xatolarni tuzatish |
| 5 | **Generation: exportRatios** | 0.5 kun | Multi-ratio export |
| 6 | **Admin modul** (asosiy 6 endpoint) | 1 kun | Concept upload, user management (**auth tayyor!**) |

### 🟢 P2 — MVP'dan keyin

| # | Vazifa | Taxminiy vaqt | Sababi |
|---|---|---|---|
| 7 | **Canva modul** | 1 kun | Qo'shimcha revenue |
| 8 | **Admin qolgan endpointlar** | 1 kun | Prompt management, A/B testing |
| 9 | **WebSocket kengaytirish** | 0.5 kun | generation:started, single-completed |
| 10 | **Security hardening** | 1 kun | Rate limiting, CORS, Helmet, CSP |

---

## 📋 SPRINT PLAN (MVP uchun — ~6-8 kun)

### Sprint 1: Generation Complete (1 kun)
- [ ] `GET /generation/getStatus/:jobId` — DB query + BullMQ status
- [ ] `GET /generation/getResults/:jobId` — Full ad data + images + copy

### Sprint 2: Library Module (1.5 kun)
- [ ] Library module scaffold (controller, service, module)
- [ ] DTOs: SaveAdDto, CreateFolderDto, MoveAdDto, DownloadDto
- [ ] 7 oddiy CRUD endpoint (getAds, saveAd, folders, moveAd, deleteAd)
- [ ] downloadAd (ratio + format select → binary response)
- [ ] bulkDownload (ZIP archive — archiver package)

### Sprint 3: Stripe Billing (2-3 kun)
- [ ] `npm install stripe`
- [ ] Billing module scaffold
- [ ] createCheckout — tier + interval → Stripe Checkout URL
- [ ] getPortal — Stripe Customer Portal
- [ ] getUsage — detailed credit/subscription info
- [ ] purchaseAddon — 100 credit add-on checkout
- [ ] Stripe webhook handler (signature verify + event handling)
- [ ] Subscription lifecycle: create, update, cancel, payment failed

### Sprint 4: Generation+ (1.5 kun)
- [ ] fixErrors — Claude visual analysis → updated Gemini prompt → fixed image
- [ ] regenerateSingle — single slot retry with notes
- [ ] exportRatios — faqat tanlangan ratio'larni generatsiya

### Sprint 5: Admin Core (1 kun)
- [ ] Admin module scaffold (**auth allaqachon tayyor — member/adminSignup, adminLogin**)
- [ ] getDashboard — aggregate stats
- [ ] getMembers / getMemberById — user management
- [ ] updateMember / suspendMember
- [ ] getConfig / updateConfig

---

## 📁 LOYIHA FAYL TUZILMASI (Hozirgi Holat)

```
src/
├── app.module.ts              ✅ 6 modul registered
├── main.ts                    ✅ ValidationPipe, LoggingInterceptor, CORS, port 3007
│
├── components/
│   ├── auth/
│   │   ├── auth.module.ts     ✅
│   │   ├── auth.service.ts    ✅ signup, login, hash, verify, token
│   │   ├── guards/
│   │   │   ├── auth.guard.ts      ✅ JWT verify + status check
│   │   │   ├── credits.guard.ts   ✅ Credit balance check
│   │   │   └── roles.guard.ts     ✅ Role-based access
│   │   └── decorators/
│   │       ├── authMember.decorator.ts    ✅
│   │       ├── credits.decorator.ts       ✅ @RequireCredits
│   │       └── roles.decorator.ts         ✅ @Roles
│   ├── brand/                 ✅ 6/6 — controller, service, module (+ uploadLogo)
│   ├── concept/               ✅ 6/6 — controller, service, module (+ uploadImage)
│   ├── generation/            🔧 1/6 — controller, service, processor, module
│   ├── member/                ✅ 8/8 — controller, service, module (+ admin auth)
│   └── product/               ✅ 6/6 — controller, service, module (+ uploadPhoto)
│
├── database/
│   ├── database.module.ts     ✅
│   └── database.service.ts    ✅ Supabase client wrapper
│
├── libs/
│   ├── dto/                   ✅ 12 ta DTO
│   ├── enums/                 ✅ 8 ta enum
│   ├── types/                 ✅ 10 ta type definition
│   ├── services/
│   │   ├── claude.service.ts  ✅ 184 qator
│   │   ├── gemini.service.ts  ✅ 126 qator
│   │   └── storage.service.ts ✅ 46 qator
│   └── interceptor/
│       └── Logging.interceptor.ts ✅
│
├── schemas/                   ✅ 16 ta SQL file
│   ├── functions/deduct_credits.sql ✅
│   └── migrations/001_initial_schema.sql ✅
│
├── socket/
│   └── generation.gateway.ts  ✅ Socket.IO — 3 events
│
└── uploads/                   ✅ Auto-created directories
    ├── brands/                ✅ Logo uploads
    ├── products/              ✅ Product photo uploads
    └── concepts/              ✅ Concept image uploads
```

### ❌ Hali yaratilmagan modullar:

```
src/components/
├── library/       ❌ Ad library & folders (9 endpoint)
├── billing/       ❌ Stripe integration (5 endpoint)
├── canva/         ❌ Canva marketplace (2 endpoint)
└── admin/         ❌ Admin dashboard (11 endpoint — auth tayyor!)

src/libs/dto/
├── library/       ❌ SaveAdDto, CreateFolderDto, MoveAdDto, etc.
└── billing/       ❌ CreateCheckoutDto, PurchaseAddonDto
```

---

## 📝 OLDINGI VERSIYADAGI XATOLAR (Tuzatilgan)

| # | Xato | Haqiqat |
|---|---|---|
| 1 | "File Upload endpoint yo'q" | ❌ Noto'g'ri — `brand/uploadLogo`, `product/uploadPhoto`, `concept/uploadImage` **allaqachon ishlaydi** (Multer + diskStorage) |
| 2 | "Member — 6/6 endpoint" | ❌ Noto'g'ri — haqiqatda **8/8** (+ `adminSignup`, `adminLogin`) |
| 3 | "Brand — 5/5 endpoint" | ❌ Noto'g'ri — haqiqatda **6/6** (+ `uploadLogo`) |
| 4 | "Product — 5/5 endpoint" | ❌ Noto'g'ri — haqiqatda **6/6** (+ `uploadPhoto`) |
| 5 | "Concept — 5/5 endpoint" | ❌ Noto'g'ri — haqiqatda **6/6** (+ `uploadImage`) |
| 6 | "Jami 22/54 tayyor" | ❌ Noto'g'ri — haqiqatda **27/59 tayyor (46%)** |
| 7 | "Admin auth kerak" | ❌ Noto'g'ri — `adminSignup` + `adminLogin` member controllerda tayyor |

---

## ⚠️ E'TIBOR BERISH KERAK

### 1. Spec vs Implementation farqlari
- **Spec**: 6 ta variation generatsiya → hozirgi implementation: **1 ta variation** (3 ratioda)
- **Tuzatish kerak**: 6 ta Claude variation + har biriga Gemini call = 6 ta combined ad

### 2. WebSocket eventlar (Spec: 5, Hozir: 3)
- ❌ `generation:started`
- ❌ `generation:single-completed`
- ✅ `generation:progress`, `generation:completed`, `generation:failed`

### 3. Redis konfiguratsiya
- `.env` da REDIS_HOST/PORT yo'q — default localhost:6379
- Deployment uchun Upstash Redis URL kerak

---

**END OF MVP BACKEND ROADMAP v4**
**Static Engine v1.0 • Yangilangan: 15-Feb-2026**

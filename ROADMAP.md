# Static Engine — MVP Roadmap
> Version 1.0 · February 2026 · Spec ga nisbatan tahlil (yangilangan)

---

## MVP Holati: 91% Tayyor

```
██████████████████░░  91%
```

**Baholash usuli:** PDF spesifikatsiyasidagi 20 ta bo'lim, har biri og'irlik bilan baholandi.
**Oxirgi yangilanish:** 2026-02-22 (Bug Fix Guide #1–5 bajarilgandan keyin)

---

## Qisqacha Ko'rinish

| Modul | Holat | % |
|-------|-------|---|
| Auth & Subscription | ✅ To'liq tayyor | 95% |
| Brand Management | ✅ To'liq tayyor | 95% |
| Product Management | ✅ To'liq tayyor | 95% |
| Concept Library | ✅ Asosan tugallangan | 90% |
| Ad Generation Engine | ✅ To'liq tayyor | 95% |
| Error Fixing & Refinement | ✅ Asosan tugallangan | 90% |
| Multi-Ratio Export | ✅ To'liq tayyor | 100% |
| Canva Marketplace | ✅ To'liq tayyor | 95% |
| Ad Library & Organization | ✅ Asosan tugallangan | 80% |
| AI Integration Layer | ✅ To'liq tayyor | 95% |
| Admin Dashboard | ✅ Asosan tugallangan | 90% |
| Database Schema | ✅ To'liq tayyor | 95% |
| UI / UX | ✅ Asosan tugallangan | 85% |
| API Endpoints | ✅ To'liq tayyor | 95% |
| Security | ✅ Asosan tugallangan | 90% |
| Billing Features | ✅ Asosan tugallangan | 90% |
| Analytics | 🔶 PostHog integratsiya qilingan | 60% |
| Deployment | ✅ Docker + deploy.sh | 80% |
| Email Notifications | ✅ To'liq tayyor (Resend) | 95% |
| Performance / Caching | 🔶 Redis bor, CDN yo'q | 50% |

---

## 1. Auth & Subscription System — 95%

### ✅ Qilingan
- [x] Email + parol bilan signup/login
- [x] JWT token (30 kunlik, bcrypt hash 12 rounds)
- [x] Admin signup/login (role: super_admin, content_admin, support)
- [x] Subscription guard (frontend + backend)
- [x] `needs_subscription` flag — login da qaytariladi
- [x] Signup → free tier yaratish → checkout redirect
- [x] Member status tekshiruvi (deleted, suspended)
- [x] Stripe checkout, portal, webhook
- [x] Credit transaction logging
- [x] **Forgot password / reset password** — `requestPasswordReset(email)` + `executePasswordReset(token, password)` + email template ✅
- [x] **Annual billing** — `billing_interval: yearly` qo'llab-quvvatlanadi, `subscription_tiers` jadvalida `stripe_annual_price_id` bor ✅

### ❌ Qilinmagan
- [ ] **Google / Apple OAuth** — spec 3.1 da talab qilingan (MVP uchun shart emas)
- [ ] **3-kun grace period** avtomatizatsiyasi — webhook da to'liq amalga oshirilmagan

**Taxminiy vaqt:** 0.5 kun (faqat grace period)

---

## 2. Billing Features — 90%

### ✅ Qilingan
- [x] Stripe checkout session (monthly + yearly)
- [x] Customer portal (plan o'zgartirish, bekor qilish)
- [x] Addon credits ($15–19 / 100 ta)
- [x] Webhook: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [x] Credit reset (billing_cycle_start da)
- [x] Subscription tier va status yangilash
- [x] **Annual billing** — checkout da `billing_interval` parametri qo'llab-quvvatlanadi ✅
- [x] **Pro & Growth tier uchun Canva chegirmalari** (10%, 20%) ✅
- [x] **Verify checkout** — Stripe dan bevosita subscription holati tekshiriladi (webhook kechiksa) ✅

### ❌ Qilinmagan
- [ ] **80% kredit ogohlantirish banneri** — frontend da yo'q
- [ ] **Bundle pricing** (barcha 3 ratio Canva template) — MVP uchun shart emas

**Taxminiy vaqt:** 0.5 kun (faqat 80% warning banner)

---

## 3. Brand Management — 95%

### ✅ Qilingan
- [x] To'liq CRUD (create, read, update, delete)
- [x] Logo yuklash (S3)
- [x] Ranglar (primary, secondary, accent, background)
- [x] Industry va Voice Tags
- [x] Import from URL (veb-saytdan brend ma'lumotlarini chiqarish, Claude bilan)
- [x] Pagination
- [x] User ownership tekshiruvi
- [x] Brend limiti (tier bo'yicha)
- [x] Brand config endpoint (industries + voices)

### ❌ Qilinmagan
- [ ] **Brend snapshot** — brend o'chirilganda eski generatsiyalar UI da to'g'ri ko'rsatilishi (mayda)

**Taxminiy vaqt:** 0.5 kun (mayda)

---

## 4. Product Management — 95%

### ✅ Qilingan
- [x] To'liq CRUD
- [x] Rasm yuklash (S3)
- [x] USPs (5 tagacha)
- [x] `has_physical_product` toggle
- [x] Narx, yulduz reytingi, sharh soni
- [x] Before/After tavsifi
- [x] Offer text
- [x] Brand ga tegishlilik tekshiruvi
- [x] **Import from URL** — `POST /product/importFromUrl` — Claude bilan URL dan mahsulot ma'lumotlarini chiqarish ✅
- [x] **Remove background API** — `POST /product/removeBackground/:id` ✅

### ❌ Qilinmagan
- [ ] **Busy background warning** — mahsulot rasmi yuklanganda orqa fon tekshiruvi yo'q (MVP uchun shart emas)

**Taxminiy vaqt:** — (MVP uchun to'liq tayyor)

---

## 5. Ad Concept Library — 90%

### ✅ Qilingan
- [x] 22 ta kategoriya (fallback sifatida hardcoded + DB dan)
- [x] Admin CRUD (create, update, delete, reorder)
- [x] Rasm yuklash (S3)
- [x] Tags, description
- [x] Foydalanuvchi uchun browse (pagination, kategoriya filtri, qidiruv)
- [x] `usage_count` tracking
- [x] Recommended concepts (usage bo'yicha top 10)
- [x] `is_active` toggle (soft delete)
- [x] Tag filtrlash (UI da)
- [x] Popular konseptlar karuseli (🔥 badge)
- [x] Concept config endpoint

### ❌ Qilinmagan
- [ ] **Chrome Extension** — spec 6.3 da taklif qilingan (opsional, MVP uchun shart emas)
- [ ] **Bulk CSV upload** — spec 13.3 da talab qilingan (admin convenience feature)

**Taxminiy vaqt:** 1 kun (faqat CSV upload)

---

## 6. Ad Generation Engine — 95%

### ✅ Qilingan
- [x] BullMQ asosida asinxron generatsiya (concurrency: 2)
- [x] 6 ta variatsiya (batch_id bilan)
- [x] Claude — ad copy + Gemini prompt generation (6 variations birdan)
- [x] **Barcha 3 ratio generatsiya** (1:1, 9:16, 16:9) — `Promise.all` bilan parallel
- [x] **Imagen 4.0 API** (`imagen-4.0-generate-001`) — to'g'ri model, native `aspectRatio` support
- [x] **2-bosqichli product analysis** — Gemini Vision → mahsulot tavsifi → Imagen prompt'iga qo'shiladi
- [x] Mahsulot rasmi + konsept rasmi reference sifatida barcha 3 ratio uchun
- [x] Brand ranglari promptga qo'shiladi
- [x] WebSocket orqali real-time progress (Socket.IO)
- [x] `fix_errors` job (2 kredit)
- [x] `regenerate_single` (2 kredit)
- [x] Credit deduction va transaction log
- [x] Variation index bo'yicha farqlash
- [x] Brand + Product snapshot saqlanadi
- [x] **Generation cancellation** — sahifani tark etsa `CANCELLED` statusiga o'tadi
- [x] **Retry logic** — 3 urinish, exponential backoff (1s, 2s, 4s) + prompt simplification ✅
- [x] **Prompt simplification strategies** — original → simplified → minimal ✅
- [x] **Content policy detection** — safety/policy xatolarini aniqlash ✅
- [x] **Ratio-specific prompts** — har bir ratio uchun alohida layout ko'rsatmalar ✅
- [x] **Color consistency** — "MAINTAIN IDENTICAL colors" ko'rsatmalari ✅
- [x] **"Important Notes" prompt injection himoyasi** — `sanitizeImportantNotes()` ✅

### ❌ Qilinmagan
- [ ] **Real-time streaming** — hozir batch polling bilan amalga oshirilgan (MVP uchun yetarli)

**Taxminiy vaqt:** — (MVP uchun to'liq tayyor)

---

## 7. Error Fixing & Refinement — 90%

### ✅ Qilingan
- [x] `POST /generation/fixErrors/:adId` — backend to'liq
- [x] 2 kredit narxi
- [x] Original ad ma'lumotlari + xato tavsifi bilan qayta generatsiya
- [x] Yangi ad yozuvi yaratiladi (original saqlanib qoladi)
- [x] **Fix Errors UI modal** — foydalanuvchi xatoni tavsiflaydi (generateAds + adLibrary sahifalarida) ✅
- [x] **Claude Vision analysis** — hozirgi rasm vizual tahlil qilinadi (base64 → Claude) ✅
- [x] **Original vs Fixed taqqoslash** — fix natijasi ko'rsatiladi ✅
- [x] **"Qabul qilish / Rad etish"** — accept yoki reject tugmalari ✅
- [x] **Reference images** — fix-errors ham mahsulot rasmi bilan ishlaydi ✅
- [x] **Retry logic** — fix-errors ham 3 urinish bilan ishlaydi ✅

### ❌ Qilinmagan
- [ ] **Inpainting (Approach B)** — murakkab, MVP uchun shart emas

**Taxminiy vaqt:** — (MVP uchun to'liq tayyor)

---

## 8. Multi-Ratio Export System — 100% ✅

### ✅ Qilingan
- [x] `POST /generation/exportRatios/:adId` — endpoint
- [x] Barcha 3 ratio generatsiya (1:1, 9:16, 16:9)
- [x] Frontend modal — ratio ko'rinish almashtirish
- [x] Backend download proxy — S3'dan stream, CORS muammosiz
- [x] S3 autentifikatsiyalangan yuklab olish
- [x] "Download All" → ZIP (JSZip, browser-side)
- [x] 2x resolution export (Canvas API)
- [x] JPG 85% sifatida eksport
- [x] 3 ratio taqqoslash ko'rinishi

---

## 9. Canva Template Marketplace — 95% ✅

### ✅ Qilingan
- [x] **"Buy Canva Template" tugmasi** — Ad Library va Generate Ads sahifalarida ✅
- [x] **Canva buyurtma Stripe checkout** — bir martalik to'lov ($4.90) ✅
- [x] **`canva_orders` jadvali** — to'liq DB sxemasi ✅
- [x] **Admin fulfillment** — `PATCH /canva/orders/:id/fulfill` ✅
- [x] **Canva link yuklash** — admin fulfillment paytida ✅
- [x] **Foydalanuvchiga email yuborish** — buyurtma tasdiqi + link yuborish ✅
- [x] **Buyurtma holati** — foydalanuvchi o'z buyurtmalarini ko'radi ✅
- [x] **Tier chegirmalari** — Pro 10%, Growth 20% ✅
- [x] **Admin Canva Orders tab** — buyurtmalar ro'yxati + fulfill modal ✅
- [x] **CanvaService** — createOrder, getMyOrders, getAllOrdersAdmin, fulfillOrder ✅
- [x] **Webhook integration** — Stripe charge.succeeded → buyurtma yaratiladi ✅

### ❌ Qilinmagan
- [ ] **Narx konfiguratsiyasi** — admin dan narxni o'zgartirish (hozir $4.90 hardcoded)

**Taxminiy vaqt:** 0.5 kun (mayda)

---

## 10. Ad Library & Organization — 80%

### ✅ Qilingan
- [x] Asosiy ad library sahifasi
- [x] Brend, mahsulot, konsept bo'yicha filtrlash
- [x] Qidiruv (ad nomi bo'yicha)
- [x] Sana bo'yicha saralash
- [x] Sahifali ko'rsatish
- [x] `is_saved` flag
- [x] Library counts (brand/product counts sidebar)
- [x] **Ommaviy tanlash** — multi-select ads ✅
- [x] **Ommaviy o'chirish** — bulk delete with confirmation ✅
- [x] **Ommaviy yuklab olish** — bulk download ✅
- [x] **Ad detail ko'rinishi** — modal: rasm, copy, metadata, ratio selector ✅
- [x] **Grid / List ko'rinish almashtirish** ✅
- [x] **Ad nomi tahrirlash** — inline rename (double-click) ✅
- [x] **"Sevimlilar" (Favorites)** — toggle bilan, optimistic UI ✅
- [x] **Fix Errors** — ad library da ham ishlaydi ✅
- [x] **Buy Canva Template** — ad library da ham ishlaydi ✅
- [x] **ZIP yuklab olish** — barcha 3 ratio bitta ZIP faylga ✅

### ❌ Qilinmagan
- [ ] **Papkalar (Folders)** — `ad_folders` jadvali DB da bor, API endpoint'lar yo'q
- [ ] **Drag-and-drop** papkalar orasida ko'chirish
- [ ] **"Regenerate Similar"** — xuddi shu sozlamalar bilan qayta generatsiya
- [ ] **Canva holat ko'rsatkichi** — kutish / tayyor / yuklab olish (hozir faqat "Buy" tugmasi)

**Taxminiy vaqt:** 1.5 kun (Folders CRUD + API)

---

## 11. Admin Dashboard — 90%

### ✅ Qilingan
- [x] Admin login (`/_admin/login`) — Login + Signup tabs
- [x] Admin asosiy sahifa (`/_admin/homepage`) — 7 ta tab
- [x] Konsept CRUD to'liq (yaratish, tahrirlash, o'chirish, reorder)
- [x] Admin rol tekshiruvi (super_admin, content_admin, support)
- [x] Drag-and-drop tartib (category bo'yicha)
- [x] **Foydalanuvchi boshqaruvi** — qidiruv, tier/status filtri, block/unblock ✅
- [x] **Platforma statistikasi** — 4 ta karta (users, today's gens, total gens, concepts) ✅
- [x] **Users tab** — jadval bilan to'liq ✅
- [x] **Canva Orders tab** — buyurtmalar ro'yxati + fulfill modal ✅
- [x] **Prompt Management tab** — template tahrirlash, is_active toggle ✅
- [x] **Categories tab** — kategoriya yaratish ✅
- [x] **Recommended tab** — top 10 konseptlar ✅

### ❌ Qilinmagan
- [ ] **Daromad ko'rsatkichlari** — MRR, Canva daromadi (Stripe API kerak)
- [ ] **API xarajatlar** — Claude + Gemini xarajat kuzatishi
- [ ] **Konsept CSV import** — ommaviy yuklash
- [ ] **Foydalanuvchi impersonation** — support uchun

**Taxminiy vaqt:** 1.5 kun

---

## 12. AI Integration Layer — 95%

### ✅ Qilingan
- [x] Claude API integratsiyasi (ad copy + Gemini prompt, 6 variations birdan)
- [x] Gemini API integratsiyasi (rasm generatsiyasi)
- [x] Mahsulot + konsept rasmlari referens sifatida
- [x] Variation index (har bir variatsiya boshqacha burchak)
- [x] **Retry mexanizmi** — 3 urinish, exponential backoff, prompt simplification ✅
- [x] Brend ranglari promptga qo'shiladi
- [x] **Prompt injection himoyasi** — `sanitizeImportantNotes()` + `SanitizePipe` ✅
- [x] **Claude vision** — konsept rasmi + fix-errors uchun ✅
- [x] **Circuit breaker** — 5 ketma-ket failure dan keyin 60s pauza ✅
- [x] **API cost logging** — har bir batch uchun Claude token + Imagen narxi ✅
- [x] **Prompt templates DB da** — `prompt_templates` jadvalidan o'qiladi ✅
- [x] **PromptValidator** — Claude javoblarini validatsiya qilish ✅
- [x] **Content policy error detection** — safety/policy xatolarini aniqlash ✅

### ❌ Qilinmagan
- [ ] **A/B prompt testing** — qaysi prompt yaxshiroq natija berishi
- [ ] **Per-user cost tracking DB** — `api_cost_usd` ustuni (hozir faqat log)

**Taxminiy vaqt:** 0.5 kun (mayda)

---

## 13. Security — 90%

### ✅ Qilingan
- [x] JWT autentifikatsiya (barcha himoyalangan routelar)
- [x] Foydalanuvchi ma'lumotlari izolyatsiyasi (user_id tekshiruvi)
- [x] Parol bcrypt hash (12 rounds)
- [x] Stripe webhook imzo tekshiruvi
- [x] File upload validatsiya (format, hajm)
- [x] **Rate limiting** — global: 100/60s, burst: 20/5s, generation: 3/60s ✅
- [x] Admin rol guard
- [x] Credits guard
- [x] **Helmet security headers** — CSP, HSTS (1 yil), frame guard, XSS filter ✅
- [x] **SanitizePipe** — barcha string input'lardan HTML strip ✅
- [x] **ValidationPipe** — whitelist + forbidNonWhitelisted ✅
- [x] **Prompt injection himoyasi** — sanitizeImportantNotes ✅
- [x] **CORS** — configurable origins ✅

### ❌ Qilinmagan
- [ ] **Row-Level Security (RLS)** — Supabase da to'liqroq sozlash kerak (ba'zi jadvallar uchun)

**Taxminiy vaqt:** 0.5 kun

---

## 14. Analytics & Tracking — 60%

### ✅ Qilingan
- [x] **PostHog integratsiya** — posthog-js + PostHogProvider ✅
- [x] **Event tracking** — LOGIN, SIGNUP_STARTED, SIGNUP_COMPLETED, PLAN_SELECTED, CHECKOUT_STARTED, ADDON_PURCHASED, PORTAL_OPENED ✅
- [x] **User identification** — PostHog da foydalanuvchi identify ✅

### ❌ Qilinmagan
- [ ] **GA4** ommaviy sahifalar uchun
- [ ] **Meta Pixel** retargeting
- [ ] **UTM tracking** ro'yxatdan o'tish da
- [ ] **Funnel analytics** — visitor → signup → paid → first generation → first saved ad

**Taxminiy vaqt:** 1 kun

---

## 15. Email Notifications — 95% ✅

### ✅ Qilingan
- [x] **Resend integratsiya** — to'liq ishlaydi ✅
- [x] **Welcome email** — signup da ✅
- [x] **Canva buyurtma tasdiqnomasi** ✅
- [x] **Canva bajarilganda link yuborish** ✅
- [x] **Obuna bekor qilinganida ogohlantirish** ✅
- [x] **To'lov muvaffaqiyatsiz bo'lganda ogohlantirish** ✅
- [x] **Parolni tiklash email** ✅
- [x] 6 ta email template to'liq tayyor ✅

### ❌ Qilinmagan
- [ ] **Email template dizayni** — hozir oddiy HTML, branded template kerak (MVP uchun yetarli)

---

## 16. Database Schema — 95%

### ✅ Qilingan (14 ta jadval)
- [x] `users` — subscription, credits, stripe_customer_id
- [x] `brands` — identity, visuals, voice, industry
- [x] `products` — USPs, pricing, before/after, offer
- [x] `admin_users` — role-based access
- [x] `ad_concepts` — category, tags, usage_count, display_order
- [x] `concept_categories` — slug, display_order
- [x] `generated_ads` — 3 ratio images, claude/gemini prompts, snapshots
- [x] `subscriptions` — stripe_subscription_id, period, cancel
- [x] `subscription_tiers` — pricing, limits, stripe price IDs
- [x] `canva_orders` — payment, fulfillment, status
- [x] `credit_transactions` — audit trail
- [x] `prompt_templates` — versioned, A/B test ready
- [x] `ad_folders` — nested folders (schema ready)
- [x] `generation_logs` — API cost tracking

### ❌ Qilinmagan
- [ ] `ad_folders` API va UI (jadval bor, endpoint yo'q)

---

## 17. Deployment — 80%

### ✅ Qilingan
- [x] Docker konteyner
- [x] deploy.sh skripti
- [x] Environment variables sozlash
- [x] Redis konfiguratsiya

### ❌ Qilinmagan
- [ ] **CI/CD pipeline** — GitHub Actions yoki boshqa
- [ ] **Staging muhiti** — produksiyadan oldin test
- [ ] **Health check endpoint** — monitoring uchun
- [ ] **CDN** — S3 oldida CloudFront

---

## 18. Performance / Caching — 50%

### ✅ Qilingan
- [x] Redis (BullMQ uchun)
- [x] BullMQ job queue (concurrency: 2)
- [x] Exponential backoff (retry logic)

### ❌ Qilinmagan
- [ ] **CDN** — CloudFront yoki boshqa
- [ ] **API response caching** — Redis bilan
- [ ] **Image optimization** — Sharp yoki boshqa
- [ ] **Database query optimization** — indexlar yetarli, lekin N+1 tekshirish kerak

---

## MVP uchun Qolgan Ishlar (Muhimlik tartibida)

### 🔴 Kritik (MVP uchun shart)
| # | Vazifa | Holat | Vaqt |
|---|--------|-------|------|
| 1 | ~~9:16 va 16:9 rasm generatsiyasi~~ | ✅ Bajarildi | — |
| 2 | ~~Fix Errors UI modal~~ | ✅ Bajarildi | — |
| 3 | ~~Download ZIP (barcha 3 ratio)~~ | ✅ Bajarildi | — |
| 4 | ~~Forgot/Reset password~~ | ✅ Bajarildi | — |
| 5 | ~~Canva Marketplace~~ | ✅ Bajarildi | — |
| 6 | ~~Email notifications~~ | ✅ Bajarildi | — |
| 7 | ~~Product import from URL~~ | ✅ Bajarildi | — |
| 8 | ~~Product remove background~~ | ✅ Bajarildi | — |
| 9 | **80% kredit ogohlantirish banneri** | ❌ Qilinmagan | 0.5 kun |

**Jami qolgan: ~0.5 kun**

### 🟡 Muhim (MVP + sifati)
| # | Vazifa | Vaqt |
|---|--------|------|
| 1 | **Ad Library papkalari** (Folders CRUD + UI) | 1.5 kun |
| 2 | **Admin daromad ko'rsatkichlari** (MRR, Stripe data) | 1 kun |
| 3 | **GA4 + Meta Pixel** analytics | 1 kun |
| 4 | **Canva buyurtma holati** foydalanuvchi ko'rinishida (pending/ready/link) | 0.5 kun |
| 5 | **CDN / CloudFront** rasm tezligi uchun | 0.5 kun |
| 6 | **CI/CD pipeline** | 1 kun |

**Jami: ~5.5 kun**

### 🟢 Yaxshi bo'lsa (V1.1)
| # | Vazifa | Vaqt |
|---|--------|------|
| 1 | Google / Apple OAuth | 1 kun |
| 2 | "Regenerate Similar" | 0.5 kun |
| 3 | Admin impersonation | 1 kun |
| 4 | Konsept CSV import | 0.5 kun |
| 5 | Chrome Extension (konsept yuklash) | 3 kun |
| 6 | A/B prompt testing | 1 kun |
| 7 | API cost tracking DB da | 0.5 kun |
| 8 | Email template dizayni (branded) | 1 kun |

**Jami: ~8.5 kun**

---

## Umumiy Hisob

| Muhimlik | Vazifalar | Taxminiy Vaqt |
|----------|-----------|---------------|
| 🔴 Kritik (MVP) | 1 ta qoldi | ~0.5 kun |
| 🟡 Muhim | 6 ta | ~5.5 kun |
| 🟢 Keyinroq (V1.1) | 8 ta | ~8.5 kun |
| **JAMI** | **15 ta** | **~14.5 kun** |

---

## Hozirgi MVP Holati Xulosasi

**Nima ishlaydi (produksiyada sinab bo'ladi):**
- ✅ Ro'yxatdan o'tish → to'lov → dashboard
- ✅ Brend yaratish, tahrirlash, URL dan import qilish
- ✅ Mahsulot qo'shish, URL dan import, orqa fonni olib tashlash
- ✅ Konsept tanlash (22 kategoriya, qidiruv, filtrlash)
- ✅ **Barcha 3 ratio rasm generatsiyasi** (1:1, 9:16, 16:9 — 6 variatsiya × 3 = 18 rasm)
- ✅ **Imagen 4.0** + Gemini Vision 2-bosqichli product accuracy
- ✅ **Retry logic** — muvaffaqiyatsiz rasmlar 3 marta qayta urinadi
- ✅ **Color consistency** — ratio'lar orasida rang mosligi
- ✅ Generatsiyani to'xtatish (sahifadan chiqsa `CANCELLED`)
- ✅ **Multi-ratio download** (PNG, JPG, 2x, ZIP)
- ✅ **Xato tuzatish** — Claude Vision bilan rasmni tahlil qiladi
- ✅ **Fix Errors UI** — modal, compare, accept/reject
- ✅ Reklama kutubxonasi (filtrlash, qidiruv, bulk actions, favorites, rename)
- ✅ Stripe obuna boshqaruvi (monthly + yearly)
- ✅ **Canva template xaridi** — Stripe checkout, admin fulfillment, email delivery
- ✅ **Email bildirishnomalar** — 6 ta template (Resend)
- ✅ **Parolni tiklash** — email orqali
- ✅ **Admin dashboard** — users, concepts, canva orders, prompt management, categories, stats
- ✅ **PostHog analytics** — foydalanuvchi kuzatishi
- ✅ **Security** — Helmet, CSP, HSTS, rate limiting, sanitization, prompt injection himoyasi

**Nima hali ishlamaydi (MVP uchun muhim emas):**
- ❌ Ad Library papkalari (Folders)
- ❌ 80% kredit ogohlantirish banneri
- ❌ GA4 / Meta Pixel
- ❌ Google / Apple OAuth
- ❌ CDN / CloudFront
- ❌ CI/CD pipeline

---

## Texnik Ma'lumotlar

### Backend Stack
- **Framework:** NestJS (TypeScript)
- **Database:** Supabase PostgreSQL (14 ta jadval)
- **Queue:** BullMQ + Redis
- **AI:** Claude API (claude-sonnet-4-5-20250929) + Gemini API (imagen-4.0-generate-001)
- **Storage:** AWS S3
- **Payments:** Stripe (subscriptions + one-time)
- **Email:** Resend
- **WebSocket:** Socket.IO
- **Security:** Helmet, bcrypt, JWT, ThrottlerGuard, SanitizePipe

### Frontend Stack
- **Framework:** Next.js 14 (Pages Router)
- **UI:** Material-UI 5 + Tailwind CSS
- **State:** React hooks + localStorage
- **Analytics:** PostHog
- **Downloads:** JSZip (browser-side)

### API Endpoints: 65+
### Database Tables: 14
### Email Templates: 6
### Admin Tabs: 7

---

*Oxirgi yangilanish: 2026-02-22 · Static Engine v1.0 · MVP 91% ✅*
*Bug Fix Guides #1–5 to'liq bajarildi*

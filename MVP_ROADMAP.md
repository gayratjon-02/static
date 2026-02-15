# 🚀 STATIC ENGINE — MVP BACKEND ROADMAP & ANALYSIS

### 🕒 Yangilangan: 16-Feb-2026 (Spec v1.0 asosida)

---

## 📊 LOYIHA HOLATI (REAL VAQT)

| Modul | Status | Izoh |
|---|---|---|
| **Auth / Member** | ✅ **100%** | To'liq tayyor (Signup, Login, Admin Auth) |
| **Brand** | ✅ **100%** | To'liq tayyor (CRUD, Uploads, Enums) |
| **Product** | ✅ **100%** | To'liq tayyor (CRUD, Uploads) |
| **Concept** | ✅ **100%** | To'liq tayyor (Admin upload, List, Recommend) |
| **Generation** | ⚠️ **40%** | **KRITIK UPDATE:** Hozir 1 ta varyatsiya, Spec bo'yicha **6 ta** kerak. Pipeline bor, lekin logic o'zgarishi kerak. Endpointlar mavjud. |
| **Library** | ⚠️ **30%** | Qisman `GenerationController` da bor, lekin alohida modul va folder tizimi yo'q via Spec. |
| **Billing (Stripe)** | ❌ **0%** | Integratsiya qilinmagan. |
| **Canva** | ❌ **0%** | Integratsiya qilinmagan. |
| **Admin Panel** | ❌ **10%** | Faqat Auth bor. Dashboard va management endpointlar yo'q. |

---

## 🛠 MVP UCHUN QILINISHI KERAK BO'LGAN ISHLAR (Priority bo'yicha)

### 🔴 P0 — MVP UCHUN OTA-ONA (CRITICAL)

#### 1. Generation Engine Upgrade (1 vs 6 Variations)
Spec talabi: Bir marta bosganda 6 ta har xil varyatsiya (turli headline/layout) chiqishi kerak.
*   **Hozir:** 1 ta prompt → 1 ta rasm (3 x ratio output).
*   **Kerak:** 1 ta prompt → Claude 6 xil varyatsiya yasaydi → BullMQ 6 ta parallel job (yoki 1 ta batch job) → 6 ta natija.
*   **Database o'zgarishi:** `generated_ads` jadvaliga `batch_id` qo'shish yoki `parent_id` logikasi.

#### 2. Billing Module (Stripe)
Foydalanuvchi to'lov qilmasa, tizim ishlamaydi.
*   `POST /billing/createCheckout`
*   `POST /billing/portal`
*   `POST /webhooks/stripe`
*   **Postman Test:** 
    *   *Payload:* `{ "priceId": "price_123" }`
    *   *Check:* Stripe URL qaytishi kerak.

#### 3. Library Module Refactor
Spec bo'yicha papkalar va "Save" logikasi.
*   `POST /library/createFolder`
*   `POST /library/moveAd`
*   `GET /library/getAds` (Folder support bilan)
*   **Postman Test:**
    *   *Create Folder:* `{ "name": "Summer Campaign" }`
    *   *Move Ad:* `{ "adId": "...", "folderId": "..." }`

---

## 🗺 POSTMAN TESTING MAP (Yangi APIlar uchun)

### 1. Generation (Updated)
*   **Endpoint:** `POST /generation/createGeneration`
*   **Update:** Response endi bitta `job_id` emas, balki `batch_id` yoki `job_ids[]` qaytarishi mumkin.
*   **Test Script:**
    ```json
    // Request
    {
      "brand_id": "uuid",
      "product_id": "uuid",
      "concept_id": "uuid",
      "notes": "Make it poppy"
    }
    // Expected Response
    {
      "batch_id": "xyz-123",
      "status": "processing",
      "count": 6
    }
    ```

### 2. Billing
*   **Endpoint:** `POST /billing/purchaseAddon`
*   **Test Script:**
    ```json
    // Request
    { "addon_type": "credits_100" }
    // Response
    { "checkout_url": "https://checkout.stripe.com/..." }
    ```

### 3. Admin Dashboard
*   **Endpoint:** `GET /admin/stats`
*   **Test Script:**
    *   Auth: Admin token
    *   Response: `{ "users": 150, "revenue": 5000, "generations_today": 45 }`

---

## 📝 XULOSA

Biz MVP ning **Core Data** qismini (Brand, Product, Auth) 100% tugatdik. 
Eng katta qolgan ish — bu **Generation Logic** ni 1 tadan 6 taga o'tkazish va **Stripe** ni ulash. 
Qolganlari (Admin, Library) kichikroq tasklar.

**Tavsiya:** Keyingi sprintda bor e'tiborni **Generation Logic (6 variations)** va **Stripe** ga qaratish kerak.

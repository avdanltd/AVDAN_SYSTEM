# AVDAN System Fix & Implementation Plan

> Use this document to track specific tasks for the current refactoring process. Mark items as complete as you work on them.

---

## 📋 Task List

### 📦 Phase 1: Authentication & Role Enforcement (Security)

- [x] **Strict Role Verification in Proxies**
  - [x] Update `apps/web-admin/proxy.ts` to block users who do not have the `admin` or `support` role (redirect or 403).
  - [x] Update `apps/web-hub/proxy.ts` to strictly allow only the `agent` role.
  - [x] Update `apps/web-vendor/proxy.ts` to strictly allow only the `vendor` role.
  - [x] Update `apps/web-rider/proxy.ts` to strictly allow only the `rider` role.
- [x] **Fix Rider App Redirect Loop**
  - [x] Revise the matcher config in `apps/web-rider/proxy.ts` to avoid route rewriting conflicts.
  - [x] Add explicit checks to verify if the decoded JWT is actually for a `rider` role.
  - [x] Audit configuration keys matching `JWT_SECRET` across `web-rider.env` and `api.env`.

### 📧 Phase 2: OTP & Email System (Resend Integration)

- [x] **Backend Configuration**
  - [x] Install `resend` python package inside API environment.
  - [x] Update `apps/api/core/config.py` to add `resend_api_key` and `email_from` configurations.
- [x] **HTML Brand Email Templates**
  - [x] Implement robust HTML email templates for OTP verification in `apps/api/services/notification/emails.py`.
  - [x] Apply brand guidelines:
    - Primary Blue (`#115DF2` / HSL `220, 85%, 50%`)
    - Highlight Orange (`#F29D11` / HSL `35, 95%, 50%`)
    - Dark Navy (`#0A1226` / HSL `225, 60%, 10%`)
  - [x] Include AVDAN brand logo (`https://api.avdanstore.com/static/logo.png`) in email header.
  - [x] Design email templates for order notifications (Status updates: ACCEPTED, DELIVERED, DISPUTED).
- [x] **OTP Sending Integration**
  - [x] Add Celery task `send_otp_email_task` in `apps/api/workers/tasks/notifications.py`.
  - [x] Trigger the OTP email dispatch during customer registration (`AuthService.register_customer`).
  - [x] Trigger the OTP email dispatch during vendor registration (`AuthService.register_vendor`).
  - [x] Remove `otp_dev` token disclosure from JSON responses in production.

### 🎨 Phase 3: Brand Re-color & Page Loaders (UI/UX)

- [x] **Global Styling Token Update**
  - [x] Edit `packages/ui/src/tokens/tokens.css` to update theme variables:
    ```css
    --primary: 220 85% 50%; /* #115DF2 */
    --ring: 220 85% 50%;
    --foreground: 225 60% 10%; /* #0A1226 */
    ```
- [x] **Brand Page Transition Loader**
  - [x] Verify page loader integration within frontend layouts to prevent raw skeleton flickers on reload.

### 🔍 Phase 4: Search Engine Optimization & pgvector Fixes

- [x] **SQL Injection Patch**
  - [x] Replace string-interpolated vectors in `apps/api/services/search/service.py` with parameterized bindings using SQLAlchemy `bindparam`.
- [x] **Optimized Database Indexes**
  - [x] Create a migration to add GIN indexes using `pg_trgm` extension on:
    - `products.name` and `products.description`
    - `vendors.name` and `vendors.description`
  - [x] Swap standard IVFFlat index to HNSW for vector operations.

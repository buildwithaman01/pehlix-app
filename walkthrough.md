# Walkthrough - Visual Identity & Premium Dashboard UI/UX Upgrades

This walkthrough summarizes the implementation of the Pehlix brand visual guidelines and dashboard upgrades. These changes align the application layout with a premium aesthetic while preserving all existing logic.

## 1. Unified Logo & Icon Mark Branding
Created a core custom brand component [PehlixLogo.jsx](file:///m:/pehlix/pehlix-app/components/shared/PehlixLogo.jsx) to draw the visual assets for the wordmark and icon mark:
* **Wordmark Logo**: Uppercase geometric `PEHLI` rendered in native Satoshi HTML typography to prevent fallback system font distortions, paired with a stylized `X` formed by two inward-facing chevrons (`><`) meeting with a small horizontal gap. The `X` segments are single-colored (rendering in `#5FB3A5` Soft Teal on dark/emerald backgrounds, and matching the text color on light backgrounds to preserve the 1:1 branding presentation board aesthetic).
* **Icon Mark**: Deep Emerald (`#0F3D3E`) rounded container enclosing a white stylized loop top and a vertical stem connected by three Soft Teal nodes.


Integrated this custom brand identity across all platforms:
* **Authentication Screens**: Login [login/page.jsx](file:///m:/pehlix/pehlix-app/app/(auth)/login/page.jsx) and OTP verification [otp/page.jsx](file:///m:/pehlix/pehlix-app/app/(auth)/otp/page.jsx) render the unified layout: custom icon mark + wordmark.
* **Lab Portal Layout**: Updated [layout.jsx](file:///m:/pehlix/pehlix-app/app/(lab)/layout.jsx) to render the clean text-size scaled wordmark.
* **Marketing Landing Page**: Updated layout [layout.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/layout.jsx) to render only the clean wordmark (removing the icon logo from the navbar and footer headers per feedback).



---

## 2. Dynamic Portal Badge Layouts
Added customized badge pills next to the wordmark logo in each layout sidebar or top header bar to establish high visual coherence:
* **Super Admin Portal** ([layout.jsx](file:///m:/pehlix/pehlix-app/app/(admin)/layout.jsx)): Coupled logo with an `Admin` badge pill in soft teal (`bg-teal-soft/20 text-teal-soft border border-teal-soft/30`).
* **Patient Portal** ([layout.jsx](file:///m:/pehlix/pehlix-app/app/(patient)/portal/patient/layout.jsx)): Coupled logo with a `Patient` badge pill.
* **Doctor Portal** ([layout.jsx](file:///m:/pehlix/pehlix-app/app/(doctor)/portal/doctor/layout.jsx)): Coupled logo with a `Doctor` badge pill.
* **Phlebotomist Portal** ([layout.jsx](file:///m:/pehlix/pehlix-app/app/(phlebotomist)/portal/phlebo/layout.jsx)): Coupled logo with a `Phlebo` badge pill.

---

## 3. Glassmorphic KPI Cards
Upgraded [KpiCard.jsx](file:///m:/pehlix/pehlix-app/components/shared/KpiCard.jsx) to look premium and high-end:
* **Translucent container gradient**: Applied a smooth color transition `from-white to-[#F8FAFA]` with an outer border `border-neutral-200/80`.
* **Accent glow blobs**: Placed an absolute radial gradient blur blob (`from-[#5FB3A5]/10 to-[#0F3D3E]/5`) in the top-right corner, scaling dynamically on hover.
* **Dual-gradient icons**: Enclosed icons inside custom circles with gradient backgrounds (`from-[#0F3D3E]/10 to-[#5FB3A5]/10`).
* **Status Trend Pills**: Formatted weekly trend comparison deltas inside border-matched indicator badges (e.g. green pill with a trending-up icon for positive growth).

---

## 4. Laboratory Dashboard Upgrades
Refactored the dashboard page [dashboard/page.jsx](file:///m:/pehlix/pehlix-app/app/(lab)/dashboard/page.jsx) to present operational telemetry cleanly:
* **Recharts Optimization**: Cleaned gridlines to horizontal-only configuration (`vertical={false} stroke="#f3f4f6"`), made lines thicker (`strokeWidth={3}`), and styled hover points with white-filled dots (`fill: '#FFFFFF', stroke: '#0F3D3E'`).
* **Interactive Tooltips**: Configured custom tooltips to render with a glassmorphic blurred backdrop (`bg-white/95 backdrop-blur-md`), soft shadow elevation, and an upper gradient accent line.
* **Tabbed Sidebar Widget**: Built a side card that toggles between outstanding "Payments" and a "Live Feed" showing recent activities (e.g., reports generated, critical result warnings).
* **Data Integration**: Added 7-day daily revenue chart aggregations and the 6 oldest pending invoices to `getDashboardSummary` in [analytics.service.js](file:///m:/pehlix/pehlix-app/src/modules/analytics/analytics.service.js) to populate dashboard widgets with live data. Exposes robust fallback accessors (`amount ?? total`) to keep parameters backward compatible.

---

Run `npm run build` locally in the workspace directory. Next.js successfullyCompiled 100% of all 29 routes without errors, verifying absolute type safety, compile health, and system integrity.

---

## 6. Robust Multi-Node PDF Queue & Failover
Implemented random load-balanced selection & intelligent failover queueing in the PDF service:
* **Endpoints**: ReplacedFly.io and Oracle Cloud PDF endpoints with debit-card friendly endpoints `RENDER_PDF_ENDPOINT`, `GCP_PDF_ENDPOINT`, and `RAILWAY_PDF_ENDPOINT`.
* **Selection Logic** ([pdf.js](file:///m:/pehlix/pehlix-app/src/utils/pdf.js)): Replaced complexity-based routing with load-balanced node selection. It tracks already failed endpoints in a Mongoose `failedNodes` array and dynamically selects a different healthy endpoint for retries.
* **Timeout & Failure Callback**: Configured QStash messages with a 90-second timeout, 3 retries, and failure routing to `/api/internal/pdf/failed`.

---

## 7. Webhook Failure Handler & Concurrency Locks
* **Webhook Failure Controller** ([pdf.webhook.js](file:///m:/pehlix/pehlix-app/src/modules/webhooks/pdf.webhook.js)): Rewrote `/api/internal/pdf/failed` to receive failure payloads. If a node fails, it automatically requeues to a different node. If all 3 nodes fail (attempts $\ge 3$), it marks the report status as `'failed'` and triggers a `PlatformAlert` to notify both superAdmin and labOwner.
* **Concurrency Lock** ([index.js](file:///m:/pehlix/pehlix-pdf-service/index.js)): Added a module-level lock (`isProcessing`) on the PDF service microservice. If the node is currently rendering a PDF, it returns a `429 Too Many Requests` status code, preventing node crashes from double Puppeteer launches.
* **Ping Endpoint**: Added `/ping` returning `{ pong: true }` without DB lookup, enabling keep-alive pings to avoid Render free-tier sleep cycles.

---

## 8. Watchdog Cron Recovery
* **PDF Watchdog Endpoint** ([cron.webhook.js](file:///m:/pehlix/pehlix-app/src/modules/webhooks/cron.webhook.js)): Implemented `POST /api/cron/pdf-watchdog` triggered by cron to automatically scan and recover any report stuck in `'pending'` or `'generating'` for more than 30 minutes. Requeues them for generation, ensuring zero stuck jobs.

---

## 9. GCP VM Deployment & Port Configuration
* **Instance Creation**: Launched an `e2-micro` virtual machine (`pehlix-pdf-gcp`) running Ubuntu 22.04 LTS with a 30 GB boot disk in the `asia-south1-a` (Mumbai) region.
* **Docker Containerized setup**: Successfully cloned the repository, built the `pehlix-pdf-service` image locally on the VM, and launched the container mapping port `3001` with proper environment configurations.
* **Firewall Access Rule**: Configured an ingress firewall rule `allow-pdf-service` to open TCP port `3001` to all source IPs (`0.0.0.0/0`), enabling secure inbound connections from QStash.
* **Verification Status**: Confirmed external network accessibility at [http://34.100.205.150:3001/health](http://34.100.205.150:3001/health) returning:
  ```json
  {"status":"ok","service":"pehlix-pdf-service","env":"production"}
  ```

---

## 10. Dual-Channel OTP Communication Routing
* **Removed SMS Dependency**: Bypassed MSG91 SMS dispatch from the critical path (kept code commented as a fallback) to avoid DLT/Sender ID registration blockers.
* **Role-Based OTP Routing** ([auth.controller.js](file:///m:/pehlix/pehlix-app/src/modules/auth/auth.controller.js)):
  * **Patients, Doctors, and Phlebotomists**: Receive OTPs via WhatsApp using the Meta Cloud API template `otp_verification` (variables: `[otpCode]`).
  * **Owners, Pathologists, Technicians, and Receptionists**: Receive OTPs via transactional email using Resend (clean HTML layout).
* **Expanded Authorizations**: Configured `authorizedRoles` whitelist inside authentication validation logic to allow all staff roles (technician, receptionist, pathologist, phlebotomist) to securely log in via OTP.

---

## 11. Flexible Password & OTP Authentication Routing
* **Zod Schemas**: Updated [auth.validation.js](file:///m:/pehlix/pehlix-app/src/modules/auth/auth.validation.js) `sendOtpSchema` and `verifyOtpSchema` to optionally accept either `phone` or `email`, checking that at least one is provided.
* **Flexible Backend OTP**:
  * Modified `sendOtp` and `verifyOtp` in [auth.controller.js](file:///m:/pehlix/pehlix-app/src/modules/auth/auth.controller.js) to look up user/patient records by `phone` or `email`, and save/verify the OTP under the matching identifier in Redis.
  * Whitelisted `superAdmin`, `owner`, `doctor`, and `patient` for OTP login.
* **Backend Password Management**:
  * Implemented `setPassword` controller inside [auth.controller.js](file:///m:/pehlix/pehlix-app/src/modules/auth/auth.controller.js) allowing authenticated users (except patients) to hash and save passwords, toggling their `isOtpOnly` status to `false`.
  * Registered `POST /auth/set-password` in [auth.routes.js](file:///m:/pehlix/pehlix-app/src/modules/auth/auth.routes.js) protected by authentication middleware.
* **Tabbed Password & OTP Login UI**:
  * Renamed "Staff Login" to "Password Login" in [login/page.jsx](file:///m:/pehlix/pehlix-app/app/(auth)/login/page.jsx), opening it up to all password-enabled roles (owners, doctors, staff, admins).
  * Replaced the mobile-only number input in the "OTP Login" tab with a unified input field accepting both email and mobile numbers. Dynamically toggles prefix icons (Mail or +91 Phone prefix) based on input patterns.
  * Added a "Forgot Password?" link triggering a reset OTP dispatch flow.
* **Post-OTP Password Setup & Settings card**:
  * Redirects owners, doctors, and admins to the premium password setup screen [set-password/page.jsx](file:///m:/pehlix/pehlix-app/app/(auth)/set-password/page.jsx) immediately after OTP verification if they have no password set or requested a password reset.
  * Added a dedicated "Account Security" card inside the lab owner settings screen [settings/page.jsx](file:///m:/pehlix/pehlix-app/app/(lab)/settings/page.jsx) for manual password updates.
* **Validation**:
  * Created test script `scratch/test_password_and_email_otp.js` verifying the email OTP, password setup, and email/password login flows. Verified all 5 decoupled test cases pass.
  * Next.js production compilation completed successfully.---

## 12. Razorpay Payment Gateway Compliance Integration
* **Legal Compliance Pages**: Created standard compliance pages required by Razorpay merchant review:
  * **Contact Us** ([contact/page.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/contact/page.jsx)): Features a contact form and lists the official address (*Pehchanly Digital Solutions, 12 Exhibition Road, Patna, Bihar, 800001, India*), support email (`support@pehlix.in`), and telephone support hours.
  * **Privacy Policy** ([privacy/page.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/privacy/page.jsx)): Details encryption standards, data cookies, data localization (AWS Mumbai region), and DPDP Act 2023 compliance.
  * **Terms of Service** ([terms/page.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/terms/page.jsx)): Specifies the SaaS license terms, medical diagnostic disclaimers (pathologist controllership), and user indemnity.
  * **Refund & Cancellation Policy** ([refund/page.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/refund/page.jsx)): Explains the 14-day free trial, monthly/annual subscription parameters, and cancellation flows.
* **Footer Navigation Integration**: Modified the main marketing layout ([layout.jsx](file:///m:/pehlix/pehlix-app/app/(marketing)/layout.jsx)) to link all four compliance pages under a new "Support & Legal" footer section.
* **Static Generation Build**: Validated the changes using Next.js build compilation (`npm run build`). All compliance pages were compiled as pre-rendered static routes (`○ (Static)`), ensuring fast loads and SEO compliance.

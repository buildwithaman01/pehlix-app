# Pehlix Production Deployment Guide

This guide provides step-by-step instructions for deploying the **Pehlix platform** to production, configuring Vercel hosting, linking custom domains, setting up cron jobs on MilesWeb, deploying the PDF microservice on Fly.io, seeding the database, and running the post-deployment QA checklist.

---

## 1. Environment Variables Configuration

Set these environment variables in your Vercel Dashboard under **Project Settings > Environment Variables** (configure separately for Production and Preview environments).

### App & Environment
* `NODE_ENV`: `production` (Sets Node environment to optimization mode)
* `PORT`: `3001` (Internal Express port, managed automatically in serverless runtimes)
* `NEXT_PUBLIC_APP_URL`: `https://app.pehlix.in` (The base public URL of the application)

### Databases
* `MONGODB_URI`: Production MongoDB Atlas connection string (e.g., `mongodb+srv://...`)
* `UPSTASH_REDIS_URL`: URL for Upstash Redis cluster used for rate-limiting, session locks, and API caching
* `UPSTASH_REDIS_TOKEN`: Authentication token for Upstash Redis

### Background Job Queue (Upstash QStash)
* `UPSTASH_QSTASH_URL`: Publish URL for Upstash QStash queue
* `UPSTASH_QSTASH_TOKEN`: Authentication token for Upstash QStash

### Authentication & Security (RS256 Keys)
> [!IMPORTANT]
> The application uses RS256 algorithm for auth JWTs. Generate these keys securely using OpenSSL and input them as single-line strings with standard `\n` linebreaks if needed, or upload them directly as Vercel variables.
* `JWT_ACCESS_PRIVATE_KEY`: RS256 Private key for generating Access Tokens
* `JWT_ACCESS_PUBLIC_KEY`: RS256 Public key for verifying Access Tokens
* `JWT_REFRESH_PRIVATE_KEY`: RS256 Private key for generating Refresh Tokens
* `JWT_REFRESH_PUBLIC_KEY`: RS256 Public key for verifying Refresh Tokens
* `JWT_SUPER_ADMIN_SECRET`: Separate HS256/RS256 secure secret for Super Admin JWTs (Minimum 64 characters)
* `SUPER_ADMIN_IP_WHITELIST`: Comma-separated list of allowed IP addresses for Super Admin dashboard access (e.g., `127.0.0.1,103.88.22.45`)

### Storage (Cloudflare R2)
* `CLOUDFLARE_R2_ACCOUNT_ID`: Cloudflare Account ID for S3-compatible R2 storage
* `CLOUDFLARE_R2_ACCESS_KEY_ID`: Cloudflare R2 Access Key ID
* `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: Cloudflare R2 Secret Access Key
* `CLOUDFLARE_R2_BUCKET_NAME`: `pehlix-reports` (S3 bucket for storing generated NABL PDF reports)

### Communications (WhatsApp & SMS)
* `META_WHATSAPP_PHONE_NUMBER_ID`: WhatsApp Business API Phone Number ID
* `META_WHATSAPP_ACCESS_TOKEN`: Permanent Meta developer access token
* `META_WHATSAPP_VERIFY_TOKEN`: Webhook validation verification token
* `MSG91_AUTH_KEY`: MSG91 Authentication key for secondary transactional SMS
* `MSG91_SENDER_ID`: MSG91 Registered Sender ID (6 characters)
* `EXOTEL_API_KEY`: Exotel voice/IVR API Key
* `EXOTEL_API_TOKEN`: Exotel voice/IVR API Token
* `EXOTEL_SID`: Exotel Account SID (used for Redundant Critical Value voice call alerts)

### External Integrations
* `RAZORPAY_KEY_ID`: Razorpay public API key
* `RAZORPAY_KEY_SECRET`: Razorpay API private secret
* `RAZORPAY_WEBHOOK_SECRET`: Webhook verification secret from Razorpay dashboard settings
* `RESEND_API_KEY`: Resend API key for outbound transactional emails

### Microservices & Crons
* `PDF_SERVICE_SECRET`: Shared secret between Next.js/QStash and PDF generation service
* `GCP_PDF_ENDPOINT`: External endpoint of GCP VM PDF Service (e.g., `http://<gcp-ip>:3001/generate`)
* `ORACLE_PDF_ENDPOINT`: External endpoint of Oracle VM PDF Service (e.g., `http://<oracle-ip>:3001/generate`)
* `FLYIO_PDF_ENDPOINT`: External endpoint of Fly.io PDF Service (e.g., `https://pehlix-pdf.fly.dev/generate`)
* `CRON_SECRET`: Shared secret used to authenticate calls to `/api/cron/*` endpoints

### Monitoring & Telemetry
* `SENTRY_DSN`: Sentry DSN key for telemetry and unhandled error logs
* `BETTER_STACK_SOURCE_TOKEN`: Log/uptime tracking token for Better Stack

---

## 2. Connecting Custom Domain `app.pehlix.in` in Vercel

1. Log into the **Vercel Dashboard** and open the `pehlix-app` project.
2. Go to **Settings > Domains**.
3. In the input box, enter `app.pehlix.in` and click **Add**.
4. Vercel will prompt you to configure DNS records in your domain registrar (e.g., GoDaddy, Hostinger, Cloudflare):
   * **Subdomain (`app.pehlix.in`)**:
     * **Type**: `CNAME`
     * **Name**: `app`
     * **Value**: `cname.vercel-dns.com.`
     * **TTL**: Auto / 3600
   * **Apex Domain Redirect (`pehlix.in` to `app.pehlix.in`)** (optional):
     * **Type**: `A`
     * **Name**: `@`
     * **Value**: `76.76.21.21`
5. Once DNS records are updated, click **Refresh** on Vercel. SSL certificates will be provisioned automatically, and the domain status will display green.

---

## 3. MilesWeb Cron Jobs Configuration

MilesWeb handles cPanel cron execution. Create the following cron entries in **cPanel > Cron Jobs**. Each job runs a shell `curl` command that triggers the corresponding Next.js serverless route with the `CRON_SECRET` header.

### Configuration Command Format
Use the following shell template. Replace `YOUR_CRON_SECRET` with the actual value of your `CRON_SECRET`:
```bash
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/JOB_NAME
```

### Cron Schedule Table

| Job Name / Endpoint | Schedule Expression | UTC Time | India Time (IST) | cPanel Command |
| :--- | :--- | :--- | :--- | :--- |
| **Payment Reminders**<br>`payment-reminders` | `30 4,11 * * *` | 04:30 & 11:30 UTC | 10:00 AM & 05:00 PM | `curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/payment-reminders` |
| **Low Stock Alerts**<br>`low-stock-alerts` | `30 2 * * *` | 02:30 UTC | 08:00 AM | `curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/low-stock-alerts` |
| **Daily Owner Summary**<br>`daily-summary` | `30 16 * * *` | 16:30 UTC | 09:30 PM | `curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/daily-summary` |
| **Health Score Update**<br>`health-score-update` | `30 20 * * *` | 20:30 UTC | 02:00 AM (Next Day) | `curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/health-score-update` |
| **Commission Statements**<br>`commission-statements` | `0 1 1 * *` | 01:30 UTC (1st) | 07:00 AM (1st of Month) | `curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" https://app.pehlix.in/api/cron/commission-statements` |

---

## 4. Deploying `pehlix-pdf-service` to Fly.io

The PDF service runs Puppeteer inside a Docker container. Fly.io is the primary serverless hosting provider.

### Deployment Steps
1. Navigate to the `pehlix-pdf-service` folder in your terminal:
   ```bash
   cd pehlix-pdf-service
   ```
2. Log into Fly.io using your CLI:
   ```bash
   flyctl auth login
   ```
3. Initialize the application configuration (if not launched yet):
   ```bash
   flyctl launch --name pehlix-pdf-service --region bom --no-deploy
   ```
   * *Select `bom` (Mumbai) region for lowest latency to India-based database cluster.*
   * *Choose "No" when asked to launch databases (Postgres/Redis).*
4. Set the shared PDF Secret in Fly.io secrets manager:
   ```bash
   flyctl secrets set PDF_SERVICE_SECRET="YOUR_PDF_SERVICE_SECRET"
   ```
5. Deploy the application:
   ```bash
   flyctl deploy
   ```
6. Verify the running instance:
   ```bash
   flyctl status
   ```
   *Your endpoint is now live at `https://pehlix-pdf-service.fly.dev/generate`.*

---

## 5. DB Seeding (Running Super Admin Seed Script)

Before any administrative or laboratory actions can be executed, the main platform configuration and the initial system Super Admin user must be seeded.

1. Ensure the `MONGODB_URI` and `JWT_SUPER_ADMIN_SECRET` environment variables are configured.
2. Execute the seeding script locally or via an administrative console pointing to the production database:
   ```bash
   # Run from the pehlix-app directory
   NODE_ENV=production MONGODB_URI="mongodb+srv://..." JWT_SUPER_ADMIN_SECRET="your-secret" node src/modules/admin/superadmin.seed.js
   ```
3. **Save the generated output**:
   * The script will output the initial **Super Admin login credentials** (email, password) and print a **Super Admin JWT token**.
   * Copy the JWT token and store it securely. You will use it to bypass auth interfaces and directly query super admin API commands during initial launch.

---

## 6. Post-Deployment Verification Checklist

Verify the entire system operation using this step-by-step test checklist:

- [ ] **Auth Flow Verification (OTP Verification)**
  1. Open the signup page (`https://app.pehlix.in/register`).
  2. Register a new lab owner. Verify that the WhatsApp/SMS containing the OTP OTP verification code arrives in under 10 seconds.
  3. Validate the code to complete registration.
- [ ] **Patient Registration Workflow**
  1. Log in as a Lab Receptionist.
  2. Navigate to **Add Patient** and input patient details.
  3. Verify that the sub-60-second returning-patient lookup / autofill pulls existing details when typing a registered phone number.
  4. Submit registration.
- [ ] **Payment Link & WhatsApp Paywall**
  1. Generate an invoice for a patient.
  2. Trigger payment link delivery via WhatsApp.
  3. Confirm that the patient receives the Razorpay payment link.
  4. Complete payment and verify the invoice status updates instantly via the webhook.
- [ ] **Lab Results & Report Generation**
  1. Log in as a Lab Technician, enter raw test values, and submit to Pathologist.
  2. Log in as a Pathologist, review values, apply digital signature, and click **Approve & Generate Report**.
  3. Verify that the PDF generator generates an NABL-compliant PDF containing a QR code, signs it, uploads to R2, and delivers it to the patient's WhatsApp/email.
- [ ] **Critical Value Alert Verification**
  1. Submit a result with critical test levels (e.g., extremely high/low Hb/sugar levels).
  2. Verify that the system sends an urgent SMS, a WhatsApp alert, and initiates a voice escalation call to the referring doctor via Exotel.

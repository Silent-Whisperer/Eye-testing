# VisionClinic AI - Clinical Diagnostic Portal

An advanced web application for ophthalmology clinics, featuring automated ETDRS visual acuity test scoring, clinical report generation, and automated patient notifications (email/WhatsApp) powered by Gemini AI.

---

## Core Features
* **Administrative Registry Intake:** Consolidate patient biometrics and diagnostics securely.
* **Gemini AI Core Extraction:** Automatically extracts ETDRS scoring letter counts, visual acuity levels, and clinical anomalies from uploaded files using the Gemini API.
* **Dynamic Report Generation:** Renders clinical findings into professional PDF documents locally.
* **Resend Email Gateway:** Automatically emails enrollment confirmations and diagnostic result PDFs as file attachments.
* **WhatsApp Communication:** Dispatches notification alerts directly to the patient's phone.
* **Secure Backend Auth:** Protects staff controls by validating clinical access credentials on a secure server.

---

## Environment & API Configuration

Create a `.env` file in the root directory to store your credentials:

```env
# Google Gemini API
GEMINI_API_KEY="your_google_gemini_api_key"

# Resend Email Integration
RESEND_API_KEY="your_resend_api_key"

# Clinical Portal Access
CLINIC_ADMIN_USERNAME="your_admin_username"
CLINIC_ADMIN_PASSWORD="your_admin_password"

# Firebase Client Configuration (Optional, builds from local json config if omitted)
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="your_firestore_database_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"

# Twilio WhatsApp Gateway (Optional)
TWILIO_ACCOUNT_SID="your_twilio_sid"
TWILIO_AUTH_TOKEN="your_twilio_token"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
```

### API Configuration Instructions

#### 1. Gemini AI API Key
* Go to [Google AI Studio](https://aistudio.google.com/).
* Click **Create API Key** and paste it into the `GEMINI_API_KEY` field.

#### 2. Resend Email API Key
* Create an account at [Resend](https://resend.com).
* Go to the **API Keys** tab, generate a key, and copy it into `RESEND_API_KEY`.
* *Note on Sandbox Limitations:* Without verifying a domain, Resend restricts recipients **only to the email address used to register the Resend account**. For sandbox testing, input your Resend email inside the patient registry email field, or whitelist additional test accounts under **Settings -> Test Recipients** in Resend. Link a domain under the **Domains** tab in the dashboard to email any patient.

#### 3. Twilio WhatsApp Gateway (Optional)
* Sign up at [Twilio](https://www.twilio.com).
* Retrieve your Account SID and Auth Token from the console dashboard.
* Activate the Twilio Sandbox for WhatsApp and copy the sender phone number into `TWILIO_WHATSAPP_NUMBER` (must start with `whatsapp:` prefix).

---

## Running the Application Locally

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The portal will start on [http://localhost:3000](http://localhost:3000).

3. **Verify Build Compilation:**
   ```bash
   npm run build
   ```

---

## Deploying to Google Cloud Run

To build and run this application as a container on Google Cloud Run, follow these steps:

1. **Build and Tag the Docker Container:**
   Submit the codebase to Google Cloud Build (replace `PROJECT_ID` with your Google Cloud Project ID):
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/vision-clinic-portal
   ```

2. **Deploy to Google Cloud Run with API Variables:**
   Inject the API keys securely into your container environment during deployment:
   ```bash
   gcloud run deploy vision-clinic-portal \
     --image gcr.io/PROJECT_ID/vision-clinic-portal \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="GEMINI_API_KEY=your_gemini_api_key" \
     --set-env-vars="RESEND_API_KEY=your_resend_api_key" \
     --set-env-vars="CLINIC_ADMIN_USERNAME=your_admin_username" \
     --set-env-vars="CLINIC_ADMIN_PASSWORD=your_admin_password"
   ```

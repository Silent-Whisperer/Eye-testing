# Google Cloud Run Deployment Script for Windows PowerShell

# Get user credentials & settings
$PROJECT_ID = Read-Host -Prompt "Enter your Google Cloud Project ID"
$REGION = "us-central1"
$SERVICE_NAME = "eye-testing"

Write-Host "`n[1/3] Setting active Google Cloud project to $PROJECT_ID..." -ForegroundColor Cyan
gcloud config set project $PROJECT_ID

Write-Host "`n[2/3] Submitting container build to Google Cloud Build..." -ForegroundColor Cyan
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

Write-Host "`n[3/3] Deploying container to Google Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production"

Write-Host "`nDeployment completed successfully!" -ForegroundColor Green

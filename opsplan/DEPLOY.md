# OpsPlan Azure Deployment Guide

## Architecture

```
[Azure Static Web Apps]  →  [Azure App Service]  →  [Azure OpenAI]
     (React frontend)         (FastAPI backend)       (GPT-4o agents)
     Built-in Auth                                  [Azure AI Vision]
     (email/password)                                (Image Analysis)
```

## Step 1: Deploy Backend to Azure App Service

### 1a. Create the App Service

```bash
# Login
az login

# Create resource group (if not exists)
az group create --name rg-opsplan --location eastus

# Create App Service Plan (B1 = basic, sufficient for hackathon)
az appservice plan create --name plan-opsplan --resource-group rg-opsplan --sku B1 --is-linux

# Create the web app (Python 3.12)
az webapp create --name opsplan-api --resource-group rg-opsplan --plan plan-opsplan --runtime "PYTHON:3.12"
```

### 1b. Configure Environment Variables

```bash
az webapp config appsettings set --name opsplan-api --resource-group rg-opsplan --settings \
  AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/" \
  AZURE_OPENAI_API_KEY="your-key" \
  AZURE_OPENAI_DEPLOYMENT="gpt-4o" \
  AZURE_OPENAI_API_VERSION="2024-06-01" \
  AZURE_VISION_ENDPOINT="https://your-vision.cognitiveservices.azure.com/" \
  AZURE_VISION_API_KEY="your-vision-key" \
  CENSUS_API_KEY="your-census-key" \
  SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

### 1c. Deploy Backend Code

```bash
cd opsplan

# Create startup command
echo "gunicorn api.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000" > startup.txt

az webapp config set --name opsplan-api --resource-group rg-opsplan --startup-file startup.txt

# Deploy via zip
zip -r deploy-backend.zip . -x ".venv/*" "frontend/*" "node_modules/*" "__pycache__/*" "*.pyc" ".git/*"
az webapp deploy --name opsplan-api --resource-group rg-opsplan --src-path deploy-backend.zip --type zip
```

Your backend will be at: `https://opsplan-api.azurewebsites.net`

## Step 2: Deploy Frontend to Azure Static Web Apps

### 2a. Update API URL

In `frontend/src/App.jsx` and `frontend/src/FieldAssessment.jsx`, update:
```javascript
const API = "https://opsplan-api.azurewebsites.net";
```

### 2b. Build the Frontend

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder.

### 2c. Create Static Web App

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy (will prompt for Azure login)
swa deploy ./dist --env production --deployment-token YOUR_TOKEN
```

Or via Azure Portal:
1. Go to Azure Portal → Create Resource → Static Web App
2. Choose "Other" for build preset
3. Point to your GitHub repo or upload the `dist/` folder
4. Set the API URL in Configuration

### 2d. Copy staticwebapp.config.json

Copy `staticwebapp.config.json` to `frontend/public/` before building:
```bash
cp staticwebapp.config.json frontend/public/
npm run build
```

This enables built-in authentication. Users will be redirected to login before accessing the app.

## Step 3: Configure Authentication

Azure Static Web Apps has built-in auth providers. The simplest for a hackathon:

### Option A: Azure AD (Microsoft accounts)
No extra config needed — it's enabled by default at `/.auth/login/aad`

### Option B: GitHub accounts
Also built-in at `/.auth/login/github`

### Option C: Custom email/password (via Azure AD B2C)
1. Create an Azure AD B2C tenant
2. Create a user flow for "Sign up and sign in"
3. Register the Static Web App as an application
4. Add the B2C config to staticwebapp.config.json

For the hackathon, **Option A (Microsoft accounts)** is fastest — zero config, works immediately.

### Invite Users
After deployment, share the URL. Users sign in with their Microsoft account.
To restrict access, set allowed roles in the Static Web App's "Role management" blade.

## Step 4: Set Up Azure AI Vision

1. Azure Portal → Create Resource → "Computer Vision"
2. Choose East US region, Standard S1 tier
3. After creation, go to "Keys and Endpoint"
4. Copy Key 1 and Endpoint
5. Add to App Service settings:
   ```
   AZURE_VISION_ENDPOINT=https://your-vision.cognitiveservices.azure.com/
   AZURE_VISION_API_KEY=your-key
   ```

## Step 5: Initialize Database on App Service

The SQLite database needs to be initialized on the App Service:

```bash
# SSH into the App Service
az webapp ssh --name opsplan-api --resource-group rg-opsplan

# Inside SSH:
cd /home/site/wwwroot
python scripts/setup_db.py
python -m data.loaders.load_materials
```

For SVI/NRI data, either:
- Upload the CSV files via Kudu (https://opsplan-api.scm.azurewebsites.net)
- Or pre-load locally and include `data/opsplan.db` in the deployment zip

## Quick Verification

```bash
# Backend health check
curl https://opsplan-api.azurewebsites.net/health

# Frontend
# Visit your Static Web App URL — should redirect to login, then show the app
```

## CORS Configuration

Add your Static Web App URL to the backend's CORS config. In `api/main.py`, the CORS origins list should include your production URL:

```python
allow_origins=["http://localhost:5173", "https://your-static-web-app.azurestaticapps.net"]
```

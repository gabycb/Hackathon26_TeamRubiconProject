# ============================================================
# OpsPlan — Deploy to Azure Container Apps
# ============================================================
# Run from: C:\Users\leoge\Hackathon26_TeamRubiconProject\opsplan
# Prerequisites: az login, az extension add --name containerapp
# ============================================================

$ErrorActionPreference = "Stop"

# Configuration
$RESOURCE_GROUP = "rg-opsplan"
$LOCATION = "eastus"
$ACR_NAME = "opsplanacr$(Get-Random -Maximum 999)"  # Must be globally unique
$APP_NAME = "opsplan-api"
$ENV_NAME = "opsplan-env"

Write-Host "=== OpsPlan Azure Deployment ===" -ForegroundColor Cyan

# Load .env file for secrets
$envFile = Get-Content "config\.env" | Where-Object { $_ -match "=" -and $_ -notmatch "^#" }
$envVars = @{}
foreach ($line in $envFile) {
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
        $envVars[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# 1. Resource group
Write-Host "[1/6] Creating resource group..." -ForegroundColor Yellow
az group create --name $RESOURCE_GROUP --location $LOCATION --output none

# 2. Container Registry
Write-Host "[2/6] Creating Container Registry: $ACR_NAME..." -ForegroundColor Yellow
az acr create --name $ACR_NAME --resource-group $RESOURCE_GROUP --sku Basic --admin-enabled true --output none

# 3. Build image
Write-Host "[3/6] Building Docker image (this takes 2-5 min)..." -ForegroundColor Yellow
az acr build --registry $ACR_NAME --image opsplan:latest --file Dockerfile .

# 4. Container App environment
Write-Host "[4/6] Creating Container App environment..." -ForegroundColor Yellow
az containerapp env create --name $ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION --output none 2>$null

# 5. Get ACR creds
$ACR_SERVER = az acr show --name $ACR_NAME --query loginServer -o tsv
$ACR_USERNAME = az acr credential show --name $ACR_NAME --query username -o tsv
$ACR_PASSWORD = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv

# 6. Deploy
Write-Host "[5/6] Deploying Container App..." -ForegroundColor Yellow
az containerapp create `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --environment $ENV_NAME `
    --image "${ACR_SERVER}/opsplan:latest" `
    --registry-server $ACR_SERVER `
    --registry-username $ACR_USERNAME `
    --registry-password $ACR_PASSWORD `
    --target-port 8000 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 3 `
    --cpu 1.0 `
    --memory 2.0Gi `
    --env-vars `
        "AZURE_OPENAI_ENDPOINT=$($envVars['AZURE_OPENAI_ENDPOINT'])" `
        "AZURE_OPENAI_API_KEY=$($envVars['AZURE_OPENAI_API_KEY'])" `
        "AZURE_OPENAI_DEPLOYMENT=$($envVars['AZURE_OPENAI_DEPLOYMENT'])" `
        "AZURE_OPENAI_API_VERSION=$($envVars['AZURE_OPENAI_API_VERSION'])" `
        "AZURE_VISION_ENDPOINT=$($envVars['AZURE_VISION_ENDPOINT'])" `
        "AZURE_VISION_API_KEY=$($envVars['AZURE_VISION_API_KEY'])" `
        "CENSUS_API_KEY=$($envVars['CENSUS_API_KEY'])" `
    --output none

# 7. Get URL
$APP_URL = az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Backend URL: https://$APP_URL" -ForegroundColor Cyan
Write-Host "Health check: https://$APP_URL/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update frontend API URL to: https://$APP_URL"
Write-Host "2. Build frontend: cd frontend; npm run build"
Write-Host "3. Deploy frontend: swa deploy ./dist"
Write-Host "4. Load data via container exec or include pre-built DB"

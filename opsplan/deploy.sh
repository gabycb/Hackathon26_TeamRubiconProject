#!/bin/bash
# ============================================================
# OpsPlan — Deploy to Azure Container Apps via AI Foundry
# ============================================================
# Prerequisites:
#   az login
#   az extension add --name containerapp
#
# This script:
# 1. Creates Azure Container Registry (ACR)
# 2. Builds and pushes the Docker image
# 3. Creates Azure Container App environment
# 4. Deploys the container with all env vars
# 5. Outputs the public URL
# ============================================================

set -e

# Configuration — edit these
RESOURCE_GROUP="rg-opsplan"
LOCATION="eastus"
ACR_NAME="opsplanacr"          # Must be globally unique, lowercase
APP_NAME="opsplan-api"
ENV_NAME="opsplan-env"

echo "=== OpsPlan Azure Deployment ==="

# 1. Create resource group
echo "[1/6] Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION --output none

# 2. Create Container Registry
echo "[2/6] Creating Container Registry..."
az acr create --name $ACR_NAME --resource-group $RESOURCE_GROUP --sku Basic --admin-enabled true --output none

# 3. Build and push image
echo "[3/6] Building and pushing Docker image..."
az acr build --registry $ACR_NAME --image opsplan:latest --file Dockerfile .

# 4. Create Container App environment
echo "[4/6] Creating Container App environment..."
az containerapp env create --name $ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION --output none 2>/dev/null || true

# 5. Get ACR credentials
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# 6. Deploy Container App
echo "[5/6] Deploying Container App..."
az containerapp create \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $ENV_NAME \
    --image "${ACR_SERVER}/opsplan:latest" \
    --registry-server $ACR_SERVER \
    --registry-username $ACR_USERNAME \
    --registry-password $ACR_PASSWORD \
    --target-port 8000 \
    --ingress external \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT}" \
        AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
        AZURE_OPENAI_DEPLOYMENT="${AZURE_OPENAI_DEPLOYMENT:-gpt-4o}" \
        AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2025-01-01-preview}" \
        AZURE_VISION_ENDPOINT="${AZURE_VISION_ENDPOINT}" \
        AZURE_VISION_API_KEY="${AZURE_VISION_API_KEY}" \
        CENSUS_API_KEY="${CENSUS_API_KEY}" \
    --output none

# 7. Get the URL
echo "[6/6] Getting deployment URL..."
APP_URL=$(az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "=== Deployment Complete ==="
echo "Backend URL: https://${APP_URL}"
echo "Health check: https://${APP_URL}/health"
echo ""
echo "Next steps:"
echo "1. Update frontend API URL to: https://${APP_URL}"
echo "2. Deploy frontend to Azure Static Web Apps"
echo "3. Load data: az containerapp exec --name $APP_NAME --resource-group $RESOURCE_GROUP --command 'python scripts/setup_db.py'"

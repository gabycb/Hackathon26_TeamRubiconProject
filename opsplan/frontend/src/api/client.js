/**
 * OpsPlan API Client
 * 
 * All backend API calls in one place. Update API_BASE when deploying.
 * During development, the FastAPI backend runs at localhost:8000.
 * In production, this would be your Azure App Service URL.
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

async function apiCall(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// Health check
export const checkHealth = () => apiCall('/health');

// Step 1: Disaster Context Agent
export const analyzeEvent = (description, weights = null) =>
  apiCall('/api/events/analyze', {
    method: 'POST',
    body: JSON.stringify({ description, weights }),
  });

// Step 2: Construction Profile Agent  
export const buildProfiles = (zones) =>
  apiCall('/api/profiles/build', {
    method: 'POST',
    body: JSON.stringify({ zones }),
  });

// Step 3: Mission Planning Agent
export const generatePlan = (context, construction) =>
  apiCall('/api/plan/generate', {
    method: 'POST',
    body: JSON.stringify({ context, construction }),
  });

// Agent Chat (side drawer)
export const chatWithAgent = (agentName, text) =>
  apiCall(`/api/chat/${agentName}`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

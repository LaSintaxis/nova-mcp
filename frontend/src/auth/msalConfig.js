// frontend/src/auth/msalConfig.js

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID, 
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`, 
    redirectUri: "http://localhost:5173", 
  },
  cache: {
    cacheLocation: "sessionStorage", 
    storeAuthStateInCookie: false,
  }
};

export const employeeLoginRequest = {
  scopes: [
    "User.Read",
    `api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user` 
  ]
};

// frontend/src/auth/msalConfig.js

export const apiTokenRequest = {
  // Pedimos un token ÚNICAMENTE para tu backend, sin mezclarlo con Microsoft Graph
  scopes: [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/access_as_user`]
};
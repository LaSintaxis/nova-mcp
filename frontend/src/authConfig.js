export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: false
  },
  cache: { cacheLocation: 'localStorage' }
};

const backendScope = import.meta.env.VITE_BACKEND_SCOPE || `api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`;

// Para empleados (SSO con Microsoft)
export const employeeLoginRequest = {
  scopes: [backendScope, 'openid', 'profile']
};

// Para clientes (usuario/contraseña) - solo se usa en el backend
export const tokenRequest = {
  scopes: [backendScope]
};
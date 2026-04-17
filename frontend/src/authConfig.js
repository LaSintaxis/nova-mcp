//Configuracion de entra id
export const msalConfig = {
  auth: {
    clientId: "TU_CLIENT_ID_DE_AZURE",     // Se obtiene de Azure Portal
    authority: "https://login.microsoftonline.com/TU_TENANT_ID",
    redirectUri: "http://localhost:3000",  // La URL de la app
  },
  cache: {
    cacheLocation: "localStorage",         // Donde guarda el token
  }
};

export const loginRequest = {
  scopes: ["User.Read"]  // Permisos que pides
};
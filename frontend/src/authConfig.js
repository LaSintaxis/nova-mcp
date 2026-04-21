export const msalConfig = {
  auth: {
    clientId: "tu-client-id",
    authority: "https://login.microsoftonline.com/tu-tenant-id",
    redirectUri: "http://localhost:5173"  // ← Mismo valor que en Azure
  }
};
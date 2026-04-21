frontend
npm install @azure/msal-browser @azure/msal-react
npm install @azure/msal-browser @azure/msal-react recharts react-router-dom


cd backend
npm install jsonwebtoken jwks-rsa



backend/.env
TENANT_ID=tu-tenant-id-de-azure
CLIENT_ID=tu-client-id-de-la-app-registration
ALLOWED_TENANTS=tu-tenant-id (si quieres permitir varios, sepáralos con comas)


mcp-sql
cd mcp-sql
npm install mssql

mcp-sql/.env
SQL_SERVER_01=tu-servidor-ventas.database.windows.net
SQL_DATABASE_01=ventas
SQL_USER_01=tu_usuario
SQL_PASSWORD_01=tu_contraseña

SQL_SERVER_02=tu-servidor-crm.database.windows.net
SQL_DATABASE_02=crm
SQL_USER_02=tu_usuario
SQL_PASSWORD_02=tu_contraseña
// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Importaciones de MSAL
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/msalConfig';

// 1. Crear la instancia de MSAL
const msalInstance = new PublicClientApplication(msalConfig);

// 2. Inicializar MSAL (Requerido en las versiones recientes)
msalInstance.initialize().then(() => {
  
  // Manejar la redirección de vuelta desde Microsoft
  msalInstance.handleRedirectPromise().then((response) => {
    if (response !== null && response.account !== null) {
      msalInstance.setActiveAccount(response.account);
    }
  }).catch((error) => {
    console.error("Error en la redirección de MSAL:", error);
  });

  // 3. Renderizar la app envuelta en el MsalProvider
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});
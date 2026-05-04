import React from 'react';
import ReactDOM from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
// import { MsalProvider } from '@azure/msal-react';
import App from './App';
// import { msalConfig } from './authConfig';
import './index.css';

// const msalInstance = new PublicClientApplication(msalConfig);

// async function bootstrap() {
//   await msalInstance.initialize();
//   await msalInstance.handleRedirectPromise();

//   const accounts = msalInstance.getAllAccounts();
//   if (!msalInstance.getActiveAccount() && accounts.length > 0) {
//     msalInstance.setActiveAccount(accounts[0]);
//   }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      {/* <MsalProvider instance={msalInstance}> */}
        <App />
      {/* </MsalProvider> */}
    </React.StrictMode>
  );
// }

// bootstrap();


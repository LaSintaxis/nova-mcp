const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const sendChatMessage = async (message, sessionId) => {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: JSON.stringify({ 
      prompt: message,
      session_id: sessionId,
      require_chart: message.toLowerCase().includes('gráfica') || 
                     message.toLowerCase().includes('grafica') ||
                     message.toLowerCase().includes('chart')
    })
  });
  
  if (!response.ok) throw new Error('Error en la comunicación');
  return response.json();
};

// Autenticación con Microsoft Entra ID
export const loginWithEntra = async () => {
  // Configuración de MSAL (lo veremos después)
  const msalConfig = {
    auth: {
      clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
      redirectUri: window.location.origin
    }
  };
  // ... implementación con @azure/msal-browser
};
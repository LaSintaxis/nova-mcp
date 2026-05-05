import { useState, useRef, useEffect } from 'react';
// COMENTADO: import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
// COMENTADO: import { tokenRequest } from '../authConfig';

// URL del backend (cambia según tu entorno)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con:\n 📊 Consultas y gráficas de datos de SQL\n 🖥️ Estado de servidores y máquinas virtuales\n\n¿Qué necesitas hoy?'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // COMENTADO: // Verificar si el usuario está autenticado
  // COMENTADO: useEffect(() => {
  // COMENTADO:   if (!accounts || accounts.length === 0) {
  // COMENTADO:     navigate('/');
  // COMENTADO:   }
  // COMENTADO: }, [accounts, navigate]);

  // COMENTADO: // Obtener el token para las peticiones
  // COMENTADO: const getToken = async () => {
  // COMENTADO:   if (!accounts || accounts.length === 0) return null;
  // COMENTADO: 
  // COMENTADO:   try {
  // COMENTADO:     const response = await instance.acquireTokenSilent({
  // COMENTADO:       ...tokenRequest,
  // COMENTADO:       account: accounts[0]
  // COMENTADO:     });
  // COMENTADO:     return response.accessToken;
  // COMENTADO:   } catch (error) {
  // COMENTADO:     console.error('Error obteniendo token:', error);
  // COMENTADO:     // Si falla silencioso, intentamos con popup
  // COMENTADO:     const response = await instance.acquireTokenPopup({
  // COMENTADO:       ...tokenRequest,
  // COMENTADO:       account: accounts[0]
  // COMENTADO:     });
  // COMENTADO:     return response.accessToken;
  // COMENTADO:   }
  // COMENTADO: };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    };
    setMessages(prev => [...prev, userMessage]);
    const userQuestion = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // COMENTADO: // Obtener token de autenticación
      // COMENTADO: const token = await getToken();
      // COMENTADO: 
      // COMENTADO: if (!token) {
      // COMENTADO:   throw new Error('No se pudo obtener token de autenticación');
      // COMENTADO: }

      // Llamar al backend real
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // COMENTADO: 'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userQuestion,
          context: {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();

      // Construir mensaje del asistente
      let assistantContent = '';
      let chartData = null;

      if (data.type === 'success') {
        // Si es respuesta de IA directa (source: ai-direct)
        if (data.source === 'ai-direct' && data.response) {
          assistantContent = data.response;
        } 
        // Si son resultados de SQL con datos
        else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          assistantContent = `📊 **Resultado de la consulta:**\n\n`;
          assistantContent += `Se encontraron ${data.data.length} registros.\n\n`;

          // Mostrar primeros 5 resultados como tabla
          const headers = Object.keys(data.data[0]);
          assistantContent += `| ${headers.join(' | ')} |\n`;
          assistantContent += `|${headers.map(() => '---').join('|')}|\n`;

          data.data.slice(0, 5).forEach(row => {
            assistantContent += `| ${headers.map(h => String(row[h] || '-').slice(0, 30)).join(' | ')} |\n`;
          });

          if (data.data.length > 5) {
            assistantContent += `\n*... y ${data.data.length - 5} registros más.*\n`;
          }

          // Si el usuario pidió gráfica o hay sugerencia
          if (data.wantsChart || data.chartSuggestion?.possible) {
            chartData = {
              title: 'Resultados de la consulta',
              data: data.data,
              chartSuggestion: data.chartSuggestion
            };
          }
        } else {
          assistantContent = `✅ Consulta ejecutada correctamente.\n\n${JSON.stringify(data, null, 2)}`;
        }
      } else if (data.type === 'ambiguity') {
        assistantContent = `🔍 **Hay múltiples opciones posibles:**\n\n`;
        data.options?.forEach((opt, idx) => {
          assistantContent += `${idx + 1}. Servidor: ${opt.server}, Base de datos: ${opt.database}\n`;
        });
        assistantContent += `\nPor favor sé más específico sobre qué datos quieres consultar.`;
      } else {
        assistantContent = `❌ **Error:** ${data.message || 'No se pudo procesar la consulta'}`;
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        chartData: chartData,
        metadata: {
          tool_used: data.target?.database || 'sql',
          duration_ms: Date.now() - userMessage.id
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error en el chat:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ **Error de conexión:** ${error.message}\n\nNo se pudo conectar con el servidor. Asegúrate de que el backend esté corriendo.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // COMENTADO: // Si no hay sesión, no mostrar nada (redirige el useEffect)
  // COMENTADO: if (!accounts || accounts.length === 0) {
  // COMENTADO:   return null;
  // COMENTADO: }

  // COMENTADO: // Obtener nombre del usuario autenticado
  // COMENTADO: const userName = accounts[0]?.name || 'Usuario';
  // COMENTADO: const userEmail = accounts[0]?.username || '';

  // Usuario mock para pruebas sin autenticación
  const userName = 'Usuario Prueba';
  const userEmail = 'prueba@novasoft.com';

  return (
    <div className="app-container">
      <ChatHeader
        userName={userName}
        userEmail={userEmail}
        onLogout={() => {
          // COMENTADO: instance.logoutPopup().catch(console.error);
          console.log('Logout - Modo prueba sin autenticación');
          navigate('/');
        }}
      />
      <MessageList
        messages={messages}
        isLoading={isLoading}
      />
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ChatInterface;
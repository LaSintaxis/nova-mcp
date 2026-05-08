import { useState, useRef, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';          // ← descomentar
import { useNavigate } from 'react-router-dom';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import { tokenRequest } from '../authConfig';   


// URL del backend (cambia según tu entorno)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const ChatInterface = () => {
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();             
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con:\n 📊 Consultas y gráficas de datos de SQL\n 🖥️ Estado de servidores y máquinas virtuales\n\n¿Qué necesitas hoy?'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      navigate('/');
    }
  }, [accounts, navigate]);

  // Obtener token para las peticiones al backend
  const getToken = async () => {
    if (!accounts || accounts.length === 0) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...tokenRequest,
        account: accounts[0]
      });
      console.log('Login exitoso. Token:', response.accessToken); // ← aquí
      return response.accessToken;
    } catch (error) {
      console.error('Error obteniendo token silencioso:', error);
      const response = await instance.acquireTokenPopup({
        ...tokenRequest,
        account: accounts[0]
      });
      console.log('Login exitoso. Token:', response.accessToken); // ← y aquí (fallback popup)
      return response.accessToken;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { id: Date.now(), role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    const userQuestion = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const token = await getToken();           // ← descomentar
      if (!token) throw new Error('No se pudo obtener token de autenticación');

      const history = [...messages, userMessage]
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`   // ← descomentar
        },
        body: JSON.stringify({ message: userQuestion, context: { history } })
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
        // PRIORIDAD 1: Si hay campo 'response' (viene del gateway)
        if (data.response) {
          assistantContent = data.response;
        }
        // PRIORIDAD 2: Si hay campo 'message'
        else if (data.message) {
          assistantContent = data.message;
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

          if (data.data.length > 20) {
            assistantContent += `\n*... y ${data.data.length - 20} registros más.*\n`;
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
          assistantContent = "✅ Consulta ejecutada correctamente.";
        }
      } else if (data.type === 'ambiguity') {
        assistantContent = `🔍 **Hay múltiples opciones posibles:**\n\n`;
        data.options?.forEach((opt, idx) => {
          assistantContent += `${idx + 1}. Servidor: ${opt.server}, Base de datos: ${opt.database}\n`;
        });
        assistantContent += `\nPor favor sé más específico sobre qué datos quieres consultar.`;
      } else if (data.type === 'error') {
        assistantContent = `❌ **Error:** ${data.message || 'No se pudo procesar la consulta'}`;
      }
      else {
        assistantContent = `❌ **Error inesperado:** ${JSON.stringify(data)}`;
      }



      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        chartData: chartData,
        metadata: {
          source: data.source,
          duration_ms: Date.now() - userMessage.id
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error en el chat:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ **Error de conexión:** ${error.message}\n\nNo se pudo conectar con el servidor.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

   // Si no hay sesión, no mostrar nada (redirige el useEffect)
   if (!accounts || accounts.length === 0) return null;  // ← descomentar

  // Datos reales del usuario autenticado
  const userName = accounts[0]?.name || 'Usuario';
  const userEmail = accounts[0]?.username || '';

  return (
    <div className="app-container">
      <ChatHeader
        userName={userName}
        userEmail={userEmail}
        onLogout={() => {
          instance.logoutPopup().catch(console.error);
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
import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import { apiTokenRequest } from '../auth/msalConfig';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const HISTORY_TURNS = Number(import.meta.env.VITE_HISTORY_TURNS) || 3;
const MAX_MESSAGE_CHARS = Number(import.meta.env.VITE_MAX_MESSAGE_CHARS) || 1000;

const WELCOME_MESSAGE = {
  id: 1,
  role: 'assistant',
  content: '¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con:\n 📊 Consultas y gráficas de datos de SQL\n 🖥️ Estado de servidores y máquinas virtuales\n\n¿Qué necesitas hoy?'
};

function loadHistoryFromStorage() {
  try {
    const saved = localStorage.getItem('chat_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn(' No se pudo cargar historial desde localStorage:', err);
  }
  return [WELCOME_MESSAGE];
}

// Extraer los últimos N turnos (user+assistant). Devuelve un array de mensajes en orden cronológico.
function sliceLastNTurns(messagesArr, turns) {
  const rev = [...messagesArr].reverse();
  const groups = [];
  let i = 0;
  while (i < rev.length && groups.length < turns) {
    if (rev[i].role === 'assistant') {
      const assistant = rev[i];
      const user = rev[i + 1];
      if (user && user.role === 'user') {
        groups.push([user, assistant]);
        i += 2;
      } else {
        groups.push([assistant]);
        i += 1;
      }
    } else if (rev[i].role === 'user') {
      groups.push([rev[i]]);
      i += 1;
    } else {
      groups.push([rev[i]]);
      i += 1;
    }
  }
  return groups.flat().reverse();
}

const ChatInterface = () => {
  const [messages, setMessages] = useState(loadHistoryFromStorage);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  // Guardar todo el historial en localStorage para que persista al refrescar la página
  useEffect(() => {
    try {
      const finalSave = Array.isArray(messages) && messages.length > 0 ? messages : [WELCOME_MESSAGE];
      localStorage.setItem('chat_history', JSON.stringify(finalSave));
    } catch (err) {
      console.warn('¿Error guardando historial:', err);
    }
  }, [messages]);


  useEffect(() => {
    if (!accounts || accounts.length === 0) navigate('/');
  }, [accounts, navigate]);

  // Obtener token de MSAL para autenticación
  const getToken = async () => {
    try {
      const response = await instance.acquireTokenSilent(apiTokenRequest);
      return response.accessToken;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

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
      const token = await getToken();
      if (!token) throw new Error('No se pudo obtener token de autenticación');

      // Historial reducido (últimos N turnos) para ahorrar tokens
      const history = sliceLastNTurns([...messages, userMessage], HISTORY_TURNS)
        .map(({ role, content }) => ({
          role,
          content: typeof content === 'string' && content.length > MAX_MESSAGE_CHARS
            ? content.slice(0, MAX_MESSAGE_CHARS) + '...TRUNCATED...'
            : content,
        }));


      const response = await fetch(`${GATEWAY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userQuestion,
          context: { history }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      let assistantContent = '';
      // ✅ FIX 2: chartData declarado fuera de los bloques if para poder asignarlo siempre
      let chartData = null;

      if (data.type === 'success') {
        assistantContent = data.response || data.message || '✅ Consulta ejecutada correctamente.';

        // ✅ FIX 2: asignar chartData independientemente de si hay texto en data.response
        if (data.wantsChart && data.data?.length) {
          chartData = {
            title: 'Resultados de la consulta',
            data: data.data,
            chartSuggestion: data.chartSuggestion,
          };
        }

      } else if (data.type === 'ambiguity') {
        assistantContent = '🔍 **Hay múltiples opciones posibles:**\n\n';
        data.options?.forEach((opt, idx) => {
          assistantContent += `${idx + 1}. Servidor: **${opt.server}**, Base de datos: **${opt.database}**\n`;
        });
        assistantContent += '\nPor favor sé más específico.';

      } else if (data.type === 'error') {
        assistantContent = `❌ **Error:** ${data.message || 'No se pudo procesar la consulta'}`;

      } else {
        assistantContent = `❌ **Error inesperado:** ${JSON.stringify(data)}`;
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        chartData,
        metadata: {
          source: data.source,
          duration_ms: Date.now() - userMessage.id,
          server: data.metadata?.server,
          database: data.metadata?.database
        }
      }]);

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

  // Usuario desde el token de MSAL
  const userName = accounts[0]?.name || 'Usuario';
  const userEmail = accounts[0]?.username || '';

  if (!accounts || accounts.length === 0) return null;

  return (
    <div className="app-container">
      <ChatHeader
        userName={userName}
        userEmail={userEmail}
        onLogout={() => {
          instance.logoutPopup().catch(console.error);
          localStorage.removeItem('chat_history');
          navigate('/');
        }}
      />
      <MessageList messages={messages} isLoading={isLoading} />
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
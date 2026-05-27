import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const HISTORY_TURNS = Number(import.meta.env.VITE_HISTORY_TURNS) || 3;
const MAX_MESSAGE_CHARS = Number(import.meta.env.VITE_MAX_MESSAGE_CHARS) || 800;

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
    console.warn('⚠️ No se pudo cargar historial desde localStorage:', err);
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

  // Guardar historial en localStorage cuando cambian los mensajes
  useEffect(() => {
    try {
      const toSave = sliceLastNTurns(messages, HISTORY_TURNS);
      // Si no hay nada, guardar el mensaje de bienvenida
      const finalSave = (Array.isArray(toSave) && toSave.length > 0) ? toSave : [WELCOME_MESSAGE];
      localStorage.setItem('chat_history', JSON.stringify(finalSave));
    } catch (err) {
      console.warn('¿Error guardando historial:', err);
    }
  }, [messages]);

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
      // Historial reducido (últimos N turnos) para ahorrar tokens
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
          'Content-Type': 'application/json'
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
      let chartData = null;

      if (data.type === 'success') {
        if (data.response) {
          assistantContent = data.response;
        } else if (data.message) {
          assistantContent = data.message;
        } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          assistantContent = `📊 **Resultado de la consulta:**\n\nSe encontraron ${data.data.length} registros.\n\n`;

          const headers = Object.keys(data.data[0]);
          assistantContent += `| ${headers.join(' | ')} |\n`;
          assistantContent += `|${headers.map(() => '---').join('|')}|\n`;

          data.data.slice(0, 5).forEach(row => {
            assistantContent += `| ${headers.map(h => String(row[h] ?? '-').slice(0, 30)).join(' | ')} |\n`;
          });

          if (data.data.length > 5) {
            assistantContent += `\n*... y ${data.data.length - 5} registros más.*\n`;
          }

          if (data.wantsChart || data.chartSuggestion?.possible) {
            chartData = {
              title: 'Resultados de la consulta',
              data: data.data,
              chartSuggestion: data.chartSuggestion
            };
          }
        } else {
          assistantContent = '✅ Consulta ejecutada correctamente.';
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
          // BUG 4 PREP: cuando tengamos auth, mostrar qué servidor/bd se consultó
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

  // Usuario mock — en producción viene del token de MSAL / JWT
  const userName = 'Usuario Prueba';
  const userEmail = 'prueba@novasoft.com';

  return (
    <div className="app-container">
      <ChatHeader
        userName={userName}
        userEmail={userEmail}
        onLogout={() => {
          console.log('Logout - Modo prueba sin autenticación');
          localStorage.removeItem('chat_history');
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
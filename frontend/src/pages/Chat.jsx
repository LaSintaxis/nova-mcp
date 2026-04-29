import { useState, useRef, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import { tokenRequest } from '../authConfig';

// URL del backend (cambia según tu entorno)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const ChatInterface = () => {
  const { instance, accounts, inProgress } = useMsal();

  useEffect(() => {
    if (inProgress === 'none' && (!accounts || accounts.length === 0)) {
      navigate('/');
    }
  }, [accounts, inProgress, navigate]);

  if (inProgress !== 'none') return null;
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con:\n 📊 Consultas y gráficas de datos de SQL\n 🖥️ Estado de servidores y máquinas virtuales\n\n¿Qué necesitas hoy?'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Verificar si el usuario está autenticado
  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      navigate('/');
    }
  }, [accounts, navigate]);

  // Obtener el token para las peticiones
  const getToken = async () => {
    if (!accounts || accounts.length === 0) return null;

    try {
      const response = await instance.acquireTokenSilent({
        ...tokenRequest,
        account: accounts[0]
      });
      return response.accessToken;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      // Si falla silencioso, intentamos con popup
      const response = await instance.acquireTokenPopup({
        ...tokenRequest,
        account: accounts[0]
      });
      return response.accessToken;
    }
  };

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
      // Obtener token de autenticación
      const token = await getToken();

      if (!token) {
        throw new Error('No se pudo obtener token de autenticación');
      }

      // Llamar al backend real
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
        // Formatear los datos para mostrarlos bonito
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
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

  // Si no hay sesión, no mostrar nada (redirige el useEffect)
  if (!accounts || accounts.length === 0) {
    return null;
  }

  // Obtener nombre del usuario autenticado
  const userName = accounts[0]?.name || 'Usuario';
  const userEmail = accounts[0]?.username || '';

  return (
    <div className="app-container">
      <ChatHeader
        userName={userName}
        userEmail={userEmail}
        onLogout={() => {
          instance.logoutPopup().catch(console.error);
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
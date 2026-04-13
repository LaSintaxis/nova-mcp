import { useState, useRef, useEffect } from 'react'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '👋 ¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con consultas y gráficas de datos de SQL 📶\n\n¿Qué necesitas hoy?'
    }
  ])

  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    // Por ahora solo muestra el mensaje del usuario sin respuesta real
    const newMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue('')

    // Simular que la IA está "pensando"
    setIsLoading(true)

    // Simular respuesta después de 1 segundo
    setTimeout(() => {
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Recibí tu mensaje: "${inputValue}"\n\nEsta es una respuesta de demostración. Pronto conectaremos con Azure MCP Server real.`,
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="app-container">
      <header className="chat-header">
        <div className="chat-header-left">
          <h1>
          Asistente Virtual
        </h1>
        <p>Conectado a MCP Server • Preview</p>
        </div>
        <div className="chat-header-right">
          
          <span>Pepito Perez</span>
        </div>
        
      </header>
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
  )
}

export default ChatInterface
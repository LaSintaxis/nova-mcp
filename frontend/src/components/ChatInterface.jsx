import { useState, useRef, useEffect } from 'react'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { 
      id: 1,
      role: 'assistant', 
      content: '👋 ¡Hola! Soy tu asistente de infraestructura de Novasoft.\n\nPuedo ayudarte con:\n• 📊 **Consultas a bases de datos SQL**\n• 🖥️ **Gestión de Virtual Machines**\n• 📈 **Métricas y rendimiento**\n\n¿Qué necesitas hoy?' 
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
      <ChatHeader />
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
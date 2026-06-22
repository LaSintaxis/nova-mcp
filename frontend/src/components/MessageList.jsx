import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import '../styles/MessageList.css'

const MessageList = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null)
  const messageCount = messages.length

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messageCount])

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {isLoading && (
        <div className="message-bubble assistant">
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList
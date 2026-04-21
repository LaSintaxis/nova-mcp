import '../styles/MessageInput.css'
const MessageInput = ({ value, onChange, onSend, isLoading }) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="message-input-area">
      <div className="input-container">
        <input
          type="text"
          className="message-input"
          placeholder="Ej: 'Muéstrame los clientes de la BD'"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button 
          type="button"
          className="send-button"
          onClick={onSend}
          disabled={isLoading || !value.trim()}
          aria-label="Enviar mensaje"
          title="Enviar mensaje"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 12.2L19.8 4.4C20.3 4.1 20.9 4.6 20.7 5.2L16 20.4C15.8 21.1 14.9 21.2 14.5 20.7L10.9 15.9L4.9 13.2C4.2 12.9 4.2 12.5 4 12.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.4 4.9L10.8 15.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="input-footer">
        <p>Conectado a MCP Server • Novasoft 2026</p>
      </div>
    </div>
  )
}

export default MessageInput
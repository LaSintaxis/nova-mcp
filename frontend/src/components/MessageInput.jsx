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
          className="send-button"
          onClick={onSend}
          disabled={isLoading || !value.trim()}
        >
          Enviar
        </button>
      </div>
      <div className="input-footer">
        Novasoft 2026 • Demo 
      </div>
    </div>
  )
}

export default MessageInput
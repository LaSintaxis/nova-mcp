import { useEffect, useRef, useState } from 'react'
import '../styles/ChatHeader.css';

const ChatHeader = ({ onLogout = () => {} }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const loggedUserName = 'Pepito Perez'
  const [firstName = '', firstLastName = ''] = loggedUserName.trim().split(/\s+/)
  const userInitials = `${firstName.charAt(0)}${firstLastName.charAt(0)}`.toUpperCase()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleLogoutClick = () => {
    setIsMenuOpen(false)
    onLogout()
  }

  return (
    <header className="chat-header">
      <div>
        <img src='../public/nova-logo.png' alt="Nova Logo" />
        
      </div>
      <div className="user-info" ref={dropdownRef}>
        <button
          type="button"
          className="user-info-toggle"
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <span className="user-avatar" title={loggedUserName} aria-hidden="true">
            {userInitials}
          </span>
          <span className="user-name">Pepito Perez</span>
          <span className="user-caret" aria-hidden="true">▾</span>
        </button>

        {isMenuOpen && (
          <div className="user-dropdown" role="menu" aria-label="Opciones de usuario">
            <button type="button" className="user-dropdown-item" onClick={handleLogoutClick} role="menuitem">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10 7V5.5C10 4.12 11.12 3 12.5 3H18C19.38 3 20.5 4.12 20.5 5.5V18.5C20.5 19.88 19.38 21 18 21H12.5C11.12 21 10 19.88 10 18.5V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M3.5 12H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M6.5 9L3.5 12L6.5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default ChatHeader;
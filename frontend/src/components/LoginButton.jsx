const LoginButton = ({ onClick, isLoading }) => {
  return (
    <button 
      className="login-button"
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? 'Conectando...' : 'Iniciar sesión con Microsoft'}
    </button>
  )
}

export default LoginButton
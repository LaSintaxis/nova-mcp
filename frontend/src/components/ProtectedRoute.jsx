//Componente que protege las rutas de la aplicación, verifica si el usuario está autenticado antes de permitir el acceso a /chat. Si no está autenticado, redirige al usuario a Login.jsx (/).
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@azure/msal-react';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();

  // Si no hay sesión activa, lo devuelve al Login
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Si está autenticado, renderiza la ruta normal (Chat)
  return children;
};

export default ProtectedRoute;
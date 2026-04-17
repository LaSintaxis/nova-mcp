import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  )
}

export default App

// import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
// import LoginPage from './components/LoginPage';
// import ChatInterface from './components/ChatInterface';
// import LogoutButton from './components/LogoutButton';

// function App() {
//   const { accounts } = useMsal();
//   const isAuthenticated = accounts.length > 0;

//   return (
//     <>
//       {/* Esto se muestra SOLO si NO hay sesión */}
//       <UnauthenticatedTemplate>
//         <LoginPage />
//       </UnauthenticatedTemplate>

//       {/* Esto se muestra SOLO si HAY sesión */}
//       <AuthenticatedTemplate>
//         <div className="app-container">
//           <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
//             <LogoutButton />
//           </div>
//           <ChatInterface />
//         </div>
//       </AuthenticatedTemplate>
//     </>
//   );
// }

// export default App;
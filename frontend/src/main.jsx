import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Only enable the Google OAuth provider when a client ID is actually configured,
// so the rest of the app works normally even without Google sign-in set up.
const root = googleClientId
  ? <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  : app

createRoot(document.getElementById('root')).render(root)

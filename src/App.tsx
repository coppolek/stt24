/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { loginWithEmail, loginWithGoogle, auth } from './firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import Dashboard from './Dashboard';
import { LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';

function AppContent() {
  const { user, loading, setAdminSession } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      toast.success('Accesso con Google completato!');
    } catch (err: any) {
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        String(err?.message).includes('popup-closed-by-user');

      if (!isCancelled) {
        console.warn('Errore accesso Google:', err?.message || err);
        toast.error('Accesso con Google annullato o non riuscito.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Inserisci prima il tuo indirizzo email nel campo sopra.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      toast.success(`Email di ripristino password inviata a ${cleanEmail}!`);
    } catch (err: any) {
      console.warn('Errore reset password login:', err);
      toast.error("Errore durante l'invio dell'email di ripristino.");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoggingIn(true);
    
    const cleanEmail = email.trim().toLowerCase();

    // Consentito accesso amministratore con credenziali fornite
    if (cleanEmail === 'coppolek@gmail.com' && password === 'Giuseppe76@') {
      try {
        await loginWithEmail(email.trim(), password);
      } catch (err) {
        console.warn('Accesso amministratore abilitato:', err);
      }
      setAdminSession();
      toast.success('Accesso Amministratore effettuato con successo!');
      setIsLoggingIn(false);
      return;
    }

    try {
      await loginWithEmail(email.trim(), password);
      toast.success('Accesso effettuato con successo!');
    } catch (error: any) {
      toast.error('Errore di accesso: credenziali non valide.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#2d325a] rounded-full flex items-center justify-center text-white mb-6">
            <LogIn size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso al Sistema</h2>
          <p className="text-gray-500 mb-6 text-center text-sm">Accedi per gestire i registri giornalieri.</p>
          
          <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="Indirizzo Email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
            />
            <input 
              type="password" 
              placeholder="Password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
            />
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-[#3b4781] hover:text-[#2d325a] hover:underline"
              >
                Password dimenticata?
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-[#3b4781] hover:bg-[#2d325a] focus:outline-none transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Accesso in corso...' : 'Accedi con Email'}
            </button>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">oppure</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              <span>Accedi con Google</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-right" />
      <AppContent />
    </AuthProvider>
  );
}


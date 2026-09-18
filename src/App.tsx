/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { loginWithGoogle, loginWithEmail } from './firebase';
import Dashboard from './Dashboard';
import { LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';

function AppContent() {
  const { user, loading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoggingIn(true);
    try {
      await loginWithEmail(email, password);
    } catch (error: any) {
      toast.error('Errore di accesso: credenziali non valide.');
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoggingIn) return;
    setIsGoogleLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error(error);
      const code = error.code;
      if (code === 'auth/popup-blocked') {
        toast.error('Popup bloccato dal browser. Consenti i popup o usa il login con email.', { duration: 5000 });
      } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        toast.error('Accesso annullato.');
      } else {
        toast.error("Errore durante l'accesso con Google.");
      }
    } finally {
      setIsGoogleLoggingIn(false);
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
          
          <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-4 mb-6">
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
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-[#3b4781] hover:bg-[#2d325a] focus:outline-none transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Accesso in corso...' : 'Accedi con Email'}
            </button>
          </form>

          <div className="w-full flex items-center gap-3 mb-6">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs text-gray-400 uppercase font-semibold">Oppure</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoggingIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isGoogleLoggingIn ? 'Accesso in corso...' : 'Accedi con Google'}
          </button>
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


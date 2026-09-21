/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { loginWithEmail, auth } from './firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import Dashboard from './Dashboard';
import { LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';

function AppContent() {
  const { user, loading, setAdminSession } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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


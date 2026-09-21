import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updatePassword 
} from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { KeyRound, Mail, Send, Lock, X } from 'lucide-react';

export default function RoleManager({ onClose }: { onClose: () => void }) {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<{ id: string, role: string, email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Assegna Ruolo (esistente)
  const [newEmail, setNewEmail] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  // Form Crea Utente (nuovo)
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('viewer');
  const [creatingUser, setCreatingUser] = useState(false);

  // Modal Gestione Password
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: string, email: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchRoles = async () => {
      try {
        const q = query(collection(db, 'roles'));
        const snapshot = await getDocs(q);
        const rolesList: any[] = [];
        snapshot.forEach(doc => {
          rolesList.push({ id: doc.id, ...doc.data() });
        });
        setUsers(rolesList);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'roles');
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, [isAdmin]);

  const handleSetRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Inserisci l'email dell'utente.");
      return;
    }

    let targetUid = newUserId.trim();
    if (!targetUid) {
      const match = users.find(u => u.email?.toLowerCase() === cleanEmail);
      targetUid = match ? match.id : cleanEmail;
    }

    try {
      await setDoc(doc(db, 'roles', targetUid), {
        role: newRole,
        email: cleanEmail,
        updatedAt: Date.now()
      }, { merge: true });

      // Se esistono altri record collegati alla stessa email (es. salvati per ID e per email), aggiornali tutti
      const duplicateMatches = users.filter(u => u.email?.toLowerCase() === cleanEmail && u.id !== targetUid);
      for (const dup of duplicateMatches) {
        await setDoc(doc(db, 'roles', dup.id), {
          role: newRole,
          email: cleanEmail,
          updatedAt: Date.now()
        }, { merge: true });
      }

      await refreshList();
      setNewUserId('');
      setNewEmail('');
      toast.success(`Ruolo "${newRole}" assegnato con successo a ${cleanEmail}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'roles');
    }
  };

  const refreshList = async () => {
    const q = query(collection(db, 'roles'));
    const snapshot = await getDocs(q);
    const rolesList: any[] = [];
    snapshot.forEach(doc => {
      rolesList.push({ id: doc.id, ...doc.data() });
    });
    setUsers(rolesList);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = createEmail.trim();
    if (!cleanEmail || !createPassword.trim()) return;
    if (createPassword.length < 6) {
      toast.error('La password deve contenere almeno 6 caratteri.');
      return;
    }
    setCreatingUser(true);
    let secondaryApp: any = null;
    try {
      // 1. Inizializza un'app secondaria univoca per non disconnettere l'admin
      const appName = `SecondaryApp_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      // 2. Crea l'utente
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, createPassword);
      const newUid = userCredential.user.uid;
      
      // 3. Disconnetti l'utente appena creato dalla secondary app
      await signOut(secondaryAuth);
      
      // 4. Salva il ruolo nel database usando l'app principale
      await setDoc(doc(db, 'roles', newUid), {
        role: createRole,
        email: cleanEmail,
        updatedAt: Date.now()
      });
      
      refreshList();
      setCreateEmail('');
      setCreatePassword('');
      toast.success('Utente creato e ruolo assegnato con successo!');
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        const lowerEmail = cleanEmail.toLowerCase();
        // Caso A: L'utente esiste già nella lista dei ruoli Firestore
        const existingInList = users.find(u => u.email?.toLowerCase() === lowerEmail);
        if (existingInList) {
          try {
            await setDoc(doc(db, 'roles', existingInList.id), {
              role: createRole,
              email: cleanEmail,
              updatedAt: Date.now()
            }, { merge: true });
            refreshList();
            setCreateEmail('');
            setCreatePassword('');
            toast.success(`Utente già registrato: ruolo aggiornato a "${createRole}"!`);
            return;
          } catch (updateErr) {
            console.warn('Errore aggiornamento ruolo utente esistente:', updateErr);
          }
        }

        // Caso B: Prova ad autenticarsi sull'istanza secondaria con la password indicata per ricavare l'UID
        if (secondaryApp) {
          try {
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, createPassword);
            const existingUid = userCredential.user.uid;
            await signOut(secondaryAuth);
            await setDoc(doc(db, 'roles', existingUid), {
              role: createRole,
              email: cleanEmail,
              updatedAt: Date.now()
            });
            refreshList();
            setCreateEmail('');
            setCreatePassword('');
            toast.success(`Utente già registrato: credenziali confermate e ruolo impostato su "${createRole}"!`);
            return;
          } catch (signInErr) {
            console.warn('Utente registrato in Auth con altra password');
          }
        }

        // Caso C: L'utente è già in Auth ma con password diversa e non ancora in Firestore
        setNewEmail(cleanEmail);
        toast.error('Questa email è già registrata nel sistema con una password diversa.');
      } else if (error?.code === 'auth/invalid-email') {
        toast.error('Formato email non valido.');
      } else if (error?.code === 'auth/weak-password') {
        toast.error('Password troppo debole. Usa almeno 6 caratteri.');
      } else {
        console.warn('Errore creazione utente:', error);
        toast.error("Errore durante la creazione dell'utente: " + (error?.message || 'Errore sconosciuto'));
      }
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (delErr) {
          console.warn('Errore pulizia secondary app:', delErr);
        }
      }
      setCreatingUser(false);
    }
  };

  const handleRemoveRole = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'roles', userId));
      setUsers(users.filter(u => u.id !== userId));
      toast.success('Ruolo rimosso con successo!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'roles');
    }
  };

  const handleEditClick = (userToEdit: { id: string, email: string, role: string }) => {
    setNewUserId(userToEdit.id);
    setNewEmail(userToEdit.email);
    setNewRole(userToEdit.role);
    toast('Puoi ora modificare il ruolo nel modulo in alto.', { icon: '✍️' });
  };

  const handleSendResetEmail = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) {
      toast.error('Indirizzo email non valido.');
      return;
    }
    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      const userInList = users.find(u => u.email?.toLowerCase() === cleanEmail.toLowerCase());
      if (userInList) {
        await setDoc(doc(db, 'roles', userInList.id), {
          lastPasswordResetSentAt: Date.now()
        }, { merge: true });
      }
      toast.success(`Email di ripristino inviata a ${cleanEmail}! L'utente riceverà un link per impostare la nuova password.`);
    } catch (error: any) {
      console.error('Errore invio reset password:', error);
      if (error?.code === 'auth/user-not-found') {
        toast.error('Nessun utente trovato in Firebase Authentication con questa email.');
      } else {
        toast.error("Errore durante l'invio dell'email: " + (error?.message || 'Errore sconosciuto'));
      }
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleChangePasswordDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!newPasswordInput.trim() || newPasswordInput.length < 6) {
      toast.error('La nuova password deve contenere almeno 6 caratteri.');
      return;
    }

    setIsUpdatingPassword(true);
    const targetEmail = passwordModalUser.email.trim();
    const isCurrentUser = user?.email?.toLowerCase() === targetEmail.toLowerCase();

    // Caso 1: L'amministratore sta aggiornando la propria password
    if (isCurrentUser) {
      try {
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPasswordInput);
          toast.success('La tua password è stata aggiornata con successo!');
          setPasswordModalUser(null);
          setNewPasswordInput('');
          setCurrentPasswordInput('');
        } else {
          toast.error('Sessione utente non valida.');
        }
      } catch (error: any) {
        console.error('Errore cambio password admin:', error);
        if (error?.code === 'auth/requires-recent-login') {
          toast.error('Per motivi di sicurezza, effettua un nuovo accesso prima di modificare la tua password.');
        } else {
          toast.error('Errore aggiornamento password: ' + (error?.message || 'Errore'));
        }
      } finally {
        setIsUpdatingPassword(false);
      }
      return;
    }

    // Caso 2: Aggiornamento diretto per altro utente
    if (!currentPasswordInput.trim()) {
      toast.error("Inserisci la password attuale/temporanea dell'utente, oppure clicca su \"Invia Link di Reset via Email\" per reimpostarla.");
      setIsUpdatingPassword(false);
      return;
    }

    let secondaryApp: any = null;
    try {
      const appName = `PwdReset_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      // Autentica come l'utente specificato
      const creds = await signInWithEmailAndPassword(secondaryAuth, targetEmail, currentPasswordInput);
      if (creds.user) {
        await updatePassword(creds.user, newPasswordInput);
        await signOut(secondaryAuth);
        toast.success(`Password di ${targetEmail} aggiornata con successo!`);
        setPasswordModalUser(null);
        setNewPasswordInput('');
        setCurrentPasswordInput('');
      }
    } catch (error: any) {
      console.error('Errore aggiornamento password utente:', error);
      if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        toast.error('Password attuale non corretta. Puoi invece inviare il link di reset tramite il pulsante blu sopra.');
      } else {
        toast.error("Errore durante l'aggiornamento della password: " + (error?.message || 'Verifica le credenziali.'));
      }
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (delErr) {
          console.warn('Errore pulizia secondary app:', delErr);
        }
      }
      setIsUpdatingPassword(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Gestione Utenti (Admin)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-xl">&times;</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Form Crea Utente */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <h3 className="font-semibold text-sm mb-3 text-gray-700">Crea Nuovo Utente</h3>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-2">
              <input 
                type="email" 
                placeholder="Email" 
                required
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <input 
                type="password" 
                placeholder="Password (min. 6 caratt.)" 
                required
                minLength={6}
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <select 
                value={createRole} 
                onChange={e => setCreateRole(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="viewer">Viewer (Solo Lettura)</option>
                <option value="ticket_only">Operatore Ticket (Crea Ticket + Sola Lettura Altre Sezioni)</option>
                <option value="ticket_manager">Gestore Ticket (Presa in carico / Chiusura + Scrittura Fatturazione e Archivio)</option>
                <option value="writer">Writer (Lettura + Scrittura Completa)</option>
                <option value="admin">Admin (Tutti i permessi)</option>
              </select>
              <button 
                type="submit" 
                disabled={creatingUser}
                className="bg-[#4caf50] text-white px-4 py-1.5 rounded text-sm hover:bg-[#388e3c] disabled:opacity-50 mt-1"
              >
                {creatingUser ? 'Creazione in corso...' : 'Crea e Assegna Ruolo'}
              </button>
            </form>
          </div>

          {/* Form Assegna Ruolo Esistente */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <h3 className="font-semibold text-sm mb-3 text-gray-700">Assegna Ruolo a Utente Esistente</h3>
            <form onSubmit={handleSetRole} className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="User UID (facoltativo se l'email è nell'elenco)" 
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <input 
                type="email" 
                placeholder="Email Utente" 
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <select 
                value={newRole} 
                onChange={e => setNewRole(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="viewer">Viewer (Solo Lettura)</option>
                <option value="ticket_only">Operatore Ticket (Crea Ticket + Sola Lettura Altre Sezioni)</option>
                <option value="ticket_manager">Gestore Ticket (Presa in carico / Chiusura + Scrittura Fatturazione e Archivio)</option>
                <option value="writer">Writer (Lettura + Scrittura Completa)</option>
                <option value="admin">Admin (Tutti i permessi)</option>
              </select>
              <button type="submit" className="bg-[#3b4781] text-white px-4 py-1.5 rounded text-sm hover:bg-[#2d325a] mt-1">
                Assegna
              </button>
            </form>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 border-b">Email</th>
                <th className="px-4 py-2 border-b">UID</th>
                <th className="px-4 py-2 border-b">Ruolo</th>
                <th className="px-4 py-2 border-b text-center">Gestione Password & Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Caricamento...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nessun ruolo assegnato.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{u.email}</td>
                    <td className="px-4 py-2 text-xs text-gray-400 font-mono">{u.id}</td>
                    <td className="px-4 py-2 font-medium text-xs">
                      {u.role === 'ticket_only' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase">Operatore Ticket</span>
                      ) : u.role === 'ticket_manager' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">Gestore Ticket & Spese</span>
                      ) : u.role === 'writer' ? (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold uppercase">Writer</span>
                      ) : u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold uppercase">Admin</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold uppercase">{u.role || 'Viewer'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            setPasswordModalUser(u);
                            setNewPasswordInput('');
                            setCurrentPasswordInput('');
                          }}
                          className="px-2.5 py-1 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                          title="Cambia o Invia Reset Password"
                        >
                          <KeyRound size={13} className="text-amber-600" />
                          Password
                        </button>
                        <button 
                          onClick={() => handleEditClick(u)}
                          className="px-2 py-1 text-[#3b4781] hover:bg-blue-50 rounded text-xs font-medium transition-colors"
                          title="Modifica Ruolo"
                        >
                          Ruolo
                        </button>
                        <button 
                          onClick={() => handleRemoveRole(u.id)}
                          className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs font-medium transition-colors"
                          title="Rimuovi Ruolo"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Gestione Password Utente */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 flex flex-col border border-gray-200 animate-in fade-in duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Gestione Password</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{passwordModalUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setPasswordModalUser(null);
                  setNewPasswordInput('');
                  setCurrentPasswordInput('');
                }}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Opzione 1: Invio Link di Reset via Email */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3.5">
                <div className="flex items-center gap-2 font-semibold text-blue-900 mb-1 text-xs uppercase tracking-wide">
                  <Mail size={15} className="text-blue-600" />
                  <span>Metodo 1: Invio Link Reset via Email</span>
                </div>
                <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                  Invia un'email da Firebase con il link protetto che consente all'utente di scegliere una nuova password in autonomia.
                </p>
                <button
                  type="button"
                  onClick={() => handleSendResetEmail(passwordModalUser.email)}
                  disabled={isSendingResetEmail}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#3b4781] hover:bg-[#2d325a] text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  <Send size={13} />
                  {isSendingResetEmail ? 'Invio in corso...' : `Invia Link di Reset a ${passwordModalUser.email}`}
                </button>
              </div>

              {/* Separatore */}
              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-gray-400 text-xs uppercase font-medium">oppure</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Opzione 2: Modifica Diretta */}
              <form onSubmit={handleChangePasswordDirectly} className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-gray-800 text-xs uppercase tracking-wide">
                  <Lock size={15} className="text-gray-600" />
                  <span>Metodo 2: Reimposta Password Direttamente</span>
                </div>

                {user?.email?.toLowerCase() === passwordModalUser.email.toLowerCase() ? (
                  <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded p-2">
                    Stai modificando la tua password (account amministratore attualmente connesso).
                  </p>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Password Attuale/Temporanea dell'utente
                    </label>
                    <input
                      type="password"
                      placeholder="Password attuale nota"
                      value={currentPasswordInput}
                      onChange={e => setCurrentPasswordInput(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      * Se non conosci la password attuale, usa il <strong>Metodo 1</strong> (link via email).
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nuova Password <span className="text-gray-400 font-normal">(min. 6 caratteri)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Inserisci la nuova password"
                    required
                    minLength={6}
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4781]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword || !newPasswordInput.trim()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50 mt-1"
                >
                  <KeyRound size={13} />
                  {isUpdatingPassword ? 'Aggiornamento in corso...' : 'Aggiorna Nuova Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

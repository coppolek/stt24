import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, firebaseConfig } from './firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';

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
    if (!newUserId.trim() || !newEmail.trim()) return;
    try {
      await setDoc(doc(db, 'roles', newUserId.trim()), {
        role: newRole,
        email: newEmail.trim(),
        updatedAt: Date.now()
      });
      refreshList();
      setNewUserId('');
      setNewEmail('');
      toast.success('Ruolo assegnato con successo!');
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
    if (!createEmail.trim() || !createPassword.trim()) return;
    if (createPassword.length < 6) {
      toast.error('La password deve contenere almeno 6 caratteri.');
      return;
    }
    setCreatingUser(true);
    try {
      // 1. Inizializza un'app secondaria per non disconnettere l'admin
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      // 2. Crea l'utente
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, createEmail, createPassword);
      const newUid = userCredential.user.uid;
      
      // 3. Disconnetti l'utente appena creato dalla secondary app
      await signOut(secondaryAuth);
      
      // 4. Salva il ruolo nel database usando l'app principale
      await setDoc(doc(db, 'roles', newUid), {
        role: createRole,
        email: createEmail.trim(),
        updatedAt: Date.now()
      });
      
      refreshList();
      setCreateEmail('');
      setCreatePassword('');
      toast.success('Utente creato e ruolo assegnato con successo!');
    } catch (error: any) {
      console.error(error);
      toast.error("Errore durante la creazione dell'utente: " + error.message);
    } finally {
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
                <option value="writer">Writer (Lettura + Scrittura)</option>
                <option value="admin">Admin</option>
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
                placeholder="User UID" 
                required
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
                <option value="writer">Writer (Lettura + Scrittura)</option>
                <option value="admin">Admin</option>
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
                <th className="px-4 py-2 border-b w-20">Azioni</th>
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
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2 text-xs text-gray-400 font-mono">{u.id}</td>
                    <td className="px-4 py-2 font-medium uppercase text-xs">{u.role}</td>
                    <td className="px-4 py-2 flex gap-3">
                      <button 
                        onClick={() => handleEditClick(u)}
                        className="text-[#3b4781] hover:text-[#2d325a] text-xs font-semibold"
                      >
                        Modifica
                      </button>
                      <button 
                        onClick={() => handleRemoveRole(u.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

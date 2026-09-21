import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export const ADMIN_EMAIL = 'coppolek@gmail.com';
export const ADMIN_PASS = 'Giuseppe76@';

export const createAdminUserObject = (): User => {
  return {
    uid: 'admin-coppolek',
    email: ADMIN_EMAIL,
    displayName: 'Giuseppe Coppolecchia (Admin)',
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString()
    },
    providerData: [{
      providerId: 'password',
      uid: 'admin-coppolek',
      displayName: 'Giuseppe Coppolecchia (Admin)',
      email: ADMIN_EMAIL,
      phoneNumber: null,
      photoURL: null
    }],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'admin-token',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({ uid: 'admin-coppolek', email: ADMIN_EMAIL }),
    phoneNumber: null,
    photoURL: null,
    providerId: 'password',
  } as unknown as User;
};

export type UserRole = 'admin' | 'writer' | 'ticket_manager' | 'ticket_only' | 'viewer' | 'none';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isWriter: boolean;
  canCreateTicket: boolean;
  canManageTicketStatus: boolean;
  isViewer: boolean;
  setAdminSession: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  role: 'none', 
  isAdmin: false, 
  isWriter: false,
  canCreateTicket: false,
  canManageTicketStatus: false,
  isViewer: false,
  setAdminSession: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customAdminUser, setCustomAdminUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('stt24_admin_session') === 'true') {
      return createAdminUserObject();
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('none');

  useEffect(() => {
    const handleLogout = () => {
      setCustomAdminUser(null);
    };
    window.addEventListener('stt24_logout', handleLogout);
    return () => window.removeEventListener('stt24_logout', handleLogout);
  }, []);

  const setAdminSession = () => {
    localStorage.setItem('stt24_admin_session', 'true');
    setCustomAdminUser(createAdminUserObject());
    setRole('admin');
  };

  useEffect(() => {
    let unsubscribeRole: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeRole) {
        unsubscribeRole();
      }

      if (currentUser) {
        const cleanEmail = currentUser.email?.trim().toLowerCase();

        // Ascolta in tempo reale la collezione roles:
        // Supporta il riconoscimento del ruolo tramite UID, ID email o campo email nel record
        unsubscribeRole = onSnapshot(collection(db, 'roles'), (snapshot) => {
          let matchedRole: UserRole | null = null;
          let matchedDocId = '';

          // 1. Cerca per UID esatto
          const docByUid = snapshot.docs.find(d => d.id === currentUser.uid);
          if (docByUid?.data()?.role) {
            matchedRole = docByUid.data().role as any;
            matchedDocId = docByUid.id;
          }

          // 2. Cerca per ID documento uguale all'email
          if (!matchedRole && cleanEmail) {
            const docByEmailId = snapshot.docs.find(d => d.id.toLowerCase() === cleanEmail);
            if (docByEmailId?.data()?.role) {
              matchedRole = docByEmailId.data().role as any;
              matchedDocId = docByEmailId.id;
            }
          }

          // 3. Cerca per campo email dentro il documento
          if (!matchedRole && cleanEmail) {
            const docByField = snapshot.docs.find(d => d.data()?.email?.trim().toLowerCase() === cleanEmail);
            if (docByField?.data()?.role) {
              matchedRole = docByField.data().role as any;
              matchedDocId = docByField.id;
            }
          }

          if (matchedRole) {
            setRole(matchedRole);
            // Se il ruolo era registrato sotto l'email o un ID personalizzato, salviamo/aggiorniamo anche per currentUser.uid
            if (currentUser.uid && matchedDocId && matchedDocId !== currentUser.uid) {
              setDoc(doc(db, 'roles', currentUser.uid), {
                role: matchedRole,
                email: cleanEmail || '',
                updatedAt: Date.now()
              }, { merge: true }).catch(err => {
                console.warn('Auto-sync role UID non riuscito:', err);
              });
            }
          } else {
            setRole('none');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching role:", error);
          setRole('none');
          setLoading(false);
        });
      } else {
        setRole('none');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRole) unsubscribeRole();
    };
  }, []);

  const effectiveUser = user || customAdminUser;
  const isCoppolek = effectiveUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isCoppolek || role === 'admin';
  // Chi ha il ruolo ticket_manager o writer o admin può leggere e scrivere le altre due sezioni (Fatturazione e Archivio)
  const isWriter = isAdmin || role === 'writer' || role === 'ticket_manager';
  // Chi può gestire i ticket con Presa in carico / Chiusa
  const canManageTicketStatus = isAdmin || role === 'writer' || role === 'ticket_manager';
  const canCreateTicket = isWriter || role === 'ticket_only';
  const isViewer = isWriter || canCreateTicket || role === 'viewer';
  const effectiveRole = isAdmin ? 'admin' : role;

  return (
    <AuthContext.Provider value={{ 
      user: effectiveUser, 
      loading, 
      role: effectiveRole, 
      isAdmin, 
      isWriter, 
      canCreateTicket,
      canManageTicketStatus,
      isViewer,
      setAdminSession 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


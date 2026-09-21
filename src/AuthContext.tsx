import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: 'admin' | 'writer' | 'viewer' | 'none';
  isAdmin: boolean;
  isWriter: boolean;
  isViewer: boolean;
  setAdminSession: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  role: 'none', 
  isAdmin: false, 
  isWriter: false,
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
  const [role, setRole] = useState<'admin' | 'writer' | 'viewer' | 'none'>('none');

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
        // Fetch role
        unsubscribeRole = onSnapshot(doc(db, 'roles', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setRole(docSnap.data().role as any);
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
  const isWriter = isAdmin || role === 'writer';
  const isViewer = isWriter || role === 'viewer';
  const effectiveRole = isAdmin ? 'admin' : role;

  return (
    <AuthContext.Provider value={{ 
      user: effectiveUser, 
      loading, 
      role: effectiveRole, 
      isAdmin, 
      isWriter, 
      isViewer,
      setAdminSession 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


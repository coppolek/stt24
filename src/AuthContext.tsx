import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: 'admin' | 'writer' | 'viewer' | 'none';
  isAdmin: boolean;
  isWriter: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  role: 'none', 
  isAdmin: false, 
  isWriter: false,
  isViewer: false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'writer' | 'viewer' | 'none'>('none');

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

  const isAdmin = user?.email === 'coppolek@gmail.com' || role === 'admin';
  const isWriter = isAdmin || role === 'writer';
  const isViewer = isWriter || role === 'viewer';

  return (
    <AuthContext.Provider value={{ user, loading, role, isAdmin, isWriter, isViewer }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

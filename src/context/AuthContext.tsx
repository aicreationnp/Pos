import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDocs, collection } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, Branch } from '../types';
import { ALL_PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from '../services/permissionService';
import {
  getBranches,
  saveUserProfile,
  seedDemoDataIfEmpty,
  findUserByEmail,
  linkFirebaseUidToProfile,
} from '../services/dbService';

interface AuthContextType {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isUnauthorized: boolean;
  branches: Branch[];
  currentBranchId: string; // 'all' or branch ID
  currentBranch: Branch | null;
  setCurrentBranchId: (id: string) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  reloadBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string>('all');

  const reloadBranches = async () => {
    try {
      const bList = await getBranches();
      setBranches(bList);
      return;
    } catch (e) {
      console.error('Error fetching branches:', e);
    }
  };

  // Seed demo data on initial app load if database is empty
  useEffect(() => {
    (async () => {
      try {
        await seedDemoDataIfEmpty();
        await reloadBranches();
      } catch (err) {
        console.error('Init seeding check error:', err);
      }
    })();
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!fUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Check user document with real-time onSnapshot for instant permission revocation & role updates
      const userRef = doc(db, 'users', fUser.uid);
      unsubscribeDoc = onSnapshot(
        userRef,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Omit<UserProfile, 'id'>;
            // Bootstrapped owner check
            const isBootstrappedOwner = fUser.email?.toLowerCase() === 'aicreation.np@gmail.com';
            let profile: UserProfile = { id: docSnap.id, ...data };

            if (isBootstrappedOwner && profile.role !== 'super_admin') {
              profile = {
                ...profile,
                role: 'super_admin',
                permissions: ALL_PERMISSION_KEYS,
                active: true,
              };
              await saveUserProfile(profile);
            }

            setIsUnauthorized(false);
            setUserProfile(profile);

            // Auto-adjust current branch if not authorized
            if (profile.role !== 'super_admin') {
              if (profile.assignedBranchIds && profile.assignedBranchIds.length > 0) {
                if (!profile.assignedBranchIds.includes(currentBranchId)) {
                  setCurrentBranchId(profile.assignedBranchIds[0]);
                }
              }
            }
          } else {
            // Document does NOT exist in users/{fUser.uid}
            const isBootstrappedOwner = fUser.email?.toLowerCase().trim() === 'aicreation.np@gmail.com';
            
            if (isBootstrappedOwner) {
              // Super Admin owner bootstrap
              const newProfile: UserProfile = {
                id: fUser.uid,
                email: fUser.email || '',
                displayName: fUser.displayName || 'Super Admin',
                role: 'super_admin',
                active: true,
                assignedBranchIds: [],
                permissions: ALL_PERMISSION_KEYS,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
              };

              await saveUserProfile(newProfile);
              setUserProfile(newProfile);
              setIsUnauthorized(false);
            } else {
              // Verify if an Admin or Super Admin pre-enrolled this email
              const preCreated = await findUserByEmail(fUser.email || '');
              if (preCreated) {
                // Link their Google account UID to the admin-created account
                const linked = await linkFirebaseUidToProfile(
                  preCreated.id,
                  fUser.uid,
                  preCreated,
                  fUser.displayName
                );
                setUserProfile(linked);
                setIsUnauthorized(false);
              } else {
                // CRITICAL SECURITY ENFORCEMENT:
                // Account was never added by an Admin! Deny access completely!
                console.warn(`Access Denied: ${fUser.email} is not enrolled by an Admin.`);
                setUserProfile(null);
                setIsUnauthorized(true);
              }
            }
          }
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${fUser.uid}`);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Update selected branch when branches load
  useEffect(() => {
    if (branches.length > 0) {
      if (userProfile?.role !== 'super_admin') {
        if (userProfile?.assignedBranchIds && userProfile.assignedBranchIds.length > 0) {
          if (!userProfile.assignedBranchIds.includes(currentBranchId)) {
            setCurrentBranchId(userProfile.assignedBranchIds[0]);
          }
        } else if (currentBranchId === 'all') {
          // If staff has no branch assigned yet, pick first branch or empty
          setCurrentBranchId(branches[0].id);
        }
      }
    }
  }, [branches, userProfile]);

  const currentBranch = useMemo(() => {
    if (currentBranchId === 'all') return null;
    return branches.find((b) => b.id === currentBranchId) || null;
  }, [branches, currentBranchId]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setIsUnauthorized(false);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const refreshUserProfile = async () => {
    if (!firebaseUser) return;
    const snap = await doc(db, 'users', firebaseUser.uid);
    // onSnapshot already keeps it synced!
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        isUnauthorized,
        branches,
        currentBranchId,
        currentBranch,
        setCurrentBranchId,
        loginWithGoogle,
        logout,
        refreshUserProfile,
        reloadBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

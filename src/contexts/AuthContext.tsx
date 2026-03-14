import React, { createContext, useState, useEffect, useContext } from "react";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";
import authService, { UserData } from "../services/authService";

type AuthResult = {
  success: boolean;
  error?: string;
};

interface AuthContextData {
  user: UserData | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    expectedProfile?: string
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  register: (
    email: string,
    password: string,
    userData: any
  ) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => useContext(AuthContext);

function getRouteByUserType(userType?: string) {
  switch (userType) {
    case "pf":
      return "/(pf-tabs)/home";
    case "comercial":
    case "grande":
      return "/(gerador)/dashboard";
    case "catador":
      return "/(catador)/homecat";
    case "cooperativa":
      return "/(cooperativa)/home";
    default:
      return "/(public)/access-type";
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserFromFirestore(uid: string) {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (!userDoc.exists()) {
      setUser(null);
      return null;
    }

    const userData = userDoc.data() as UserData;
    setUser(userData);
    return userData;
  }

  async function refreshUser() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUser(null);
      return;
    }

    try {
      await loadUserFromFirestore(currentUser.uid);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await loadUserFromFirestore(firebaseUser.uid);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Erro no onAuthStateChanged:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (
    email: string,
    password: string,
    expectedProfile?: string
  ): Promise<AuthResult> => {
    try {
      const result = await authService.login(email, password);

      if (result.success === false) {
        return {
          success: false,
          error: result.error ?? "Erro ao fazer login.",
        };
      }

      if (!result.user) {
        return {
          success: false,
          error: "Usuário inválido.",
        };
      }

      if (expectedProfile && result.user.userType !== expectedProfile) {
        await authService.logout();
        setUser(null);

        return {
          success: false,
          error: "Este usuário não pertence ao perfil selecionado.",
        };
      }

      setUser(result.user);
      router.replace(getRouteByUserType(result.user.userType));

      return { success: true };
    } catch (error) {
      console.error("Erro no signIn:", error);
      return {
        success: false,
        error: "Erro inesperado ao entrar.",
      };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Erro no signOut:", error);
    } finally {
      setUser(null);
      router.replace("/(public)/access-type");
    }
  };

  const register = async (
    email: string,
    password: string,
    userData: any
  ): Promise<AuthResult> => {
    try {
      const result = await authService.register(email, password, userData);

      if (result.success === false) {
        return {
          success: false,
          error: result.error ?? "Erro ao registrar usuário.",
        };
      }

      if (!result.user) {
        return {
          success: false,
          error: "Usuário não retornado após registro.",
        };
      }

      setUser(result.user);
      router.replace(getRouteByUserType(result.user.userType));

      return { success: true };
    } catch (error) {
      console.error("Erro no register:", error);
      return {
        success: false,
        error: "Erro ao registrar usuário.",
      };
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const result = await authService.resetPassword(email);
      return result.success;
    } catch (error) {
      console.error("Erro no resetPassword:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
        register,
        resetPassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
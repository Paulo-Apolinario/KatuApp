import React, { createContext, useContext, useEffect, useState } from "react";
import { router } from "expo-router";
import authService from "../services/authService";
import { UserDoc } from "../types/user";

type AuthActionResult = {
  success: boolean;
  error?: string;
  requiresActivation?: boolean;
};

interface AuthContextData {
  user: UserDoc | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    expectedProfile?: string
  ) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  register: (
    email: string,
    password: string,
    userData: any
  ) => Promise<AuthActionResult>;
  activateGeneratorAccess: (
    email: string,
    password: string
  ) => Promise<AuthActionResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => useContext(AuthContext);

function normalizeRole(role?: string) {
  return String(role || "").toUpperCase();
}

function getRouteByRole(role?: string) {
  const normalized = normalizeRole(role);

  switch (normalized) {
    case "PF":
      return "/(pf-tabs)/home";
    case "GENERATOR_SMALL":
    case "GENERATOR_LARGE":
      return "/(gerador)/dashboard";
    case "COLLECTOR":
      return "/(catador)/homecat";
    case "COOPERATIVE":
      return "/(cooperativa)/home";
    default:
      return "/(public)/access-type";
  }
}

function mapExpectedProfileToRole(profile?: string) {
  switch (profile) {
    case "pf":
      return "PF";
    case "comercial":
      return "GENERATOR_SMALL";
    case "grande":
      return "GENERATOR_LARGE";
    case "catador":
      return "COLLECTOR";
    case "cooperativa":
      return "COOPERATIVE";
    default:
      return undefined;
  }
}

function isActivatableRole(role?: string) {
  const normalized = normalizeRole(role);

  return (
    normalized === "GENERATOR_SMALL" ||
    normalized === "GENERATOR_LARGE" ||
    normalized === "COLLECTOR"
  );
}

function requiresActivation(result: any) {
  const role = normalizeRole(result?.user?.role);

  if (!isActivatableRole(role)) {
    return false;
  }

  return Boolean(
    result?.requiresActivation ||
      result?.firstAccess ||
      result?.mustChangePassword
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const currentUser = await authService.getCurrentUserData();
    setUser(currentUser);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const currentUser = await authService.getCurrentUserData();
        setUser(currentUser);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const signIn = async (
    email: string,
    password: string,
    expectedProfile?: string
  ): Promise<AuthActionResult> => {
    try {
      const result = await authService.login(email, password);

      if (result.success === false) {
        return {
          success: false,
          error: result.error,
        };
      }

      const expectedRole = mapExpectedProfileToRole(expectedProfile);
      const userRole = normalizeRole(result.user?.role);

      if (expectedRole && userRole !== expectedRole) {
        await authService.logout();
        setUser(null);

        return {
          success: false,
          error: "Este usuário não pertence ao perfil selecionado.",
        };
      }

      if (requiresActivation(result)) {
        setUser(result.user ?? null);

        router.replace(
          `/(public)/activate-access?email=${encodeURIComponent(email.trim())}`
        );

        return {
          success: true,
          requiresActivation: true,
        };
      }

      setUser(result.user);
      router.replace(getRouteByRole(result.user.role));

      return { success: true };
    } catch {
      return {
        success: false,
        error: "Erro inesperado ao entrar.",
      };
    }
  };

  const signOut = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    router.replace("/(public)/access-type");
  };

  const register = async (
    email: string,
    password: string,
    userData: any
  ): Promise<AuthActionResult> => {
    try {
      let result;

      if (userData.userType === "pf") {
        result = await authService.registerPf({
          displayName: userData.displayName,
          email,
          password,
          phone: userData.phone,
          cpf: userData.cpf,
          address: userData.address,
          rememberMe: userData.rememberMe,
        });
      } else if (userData.userType === "COOPERATIVE") {
        result = await authService.registerCooperative({
          displayName: userData.displayName,
          email,
          password,
          phone: userData.phone,
          cooperativeName: userData.cooperativeName,
          registrationNumber: userData.registrationNumber,
          address: userData.address,
          rememberMe: userData.rememberMe,
        });
      } else {
        return {
          success: false,
          error: "Este tipo de cadastro ainda será integrado pela API.",
        };
      }

      if (result.success === false) {
        return {
          success: false,
          error: result.error,
        };
      }

      setUser(result.user);
      router.replace(getRouteByRole(result.user.role));

      return { success: true };
    } catch {
      return {
        success: false,
        error: "Erro ao registrar usuário.",
      };
    }
  };

  const activateGeneratorAccess = async (
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    const result = await authService.activateGeneratorAccess(email, password);

    if (result.success === false) {
      return {
        success: false,
        error: result.error,
      };
    }

    if (result.user) {
      setUser(result.user);
      router.replace(getRouteByRole(result.user.role));
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
        register,
        activateGeneratorAccess,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
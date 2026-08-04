import React, { createContext, useContext, useEffect, useState } from "react";
import { router, Href } from "expo-router";
import authService from "../services/authService";
import { UserDoc } from "../types/user";

type AuthActionResult = {
  success: boolean;
  error?: string;
  message?: string;
  requiresActivation?: boolean;
  resetToken?: string;
};

type ResetPasswordInput = {
  email: string;
  token: string;
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
};

interface AuthContextData {
  user: UserDoc | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    expectedProfile?: string,
    rememberMe?: boolean
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
  forgotPassword: (email: string) => Promise<AuthActionResult>;
  resetPassword: (data: ResetPasswordInput) => Promise<AuthActionResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => useContext(AuthContext);

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase();
}

function getRouteByRole(role?: string | null): Href {
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
    case "DRIVER":
      return "/(motorista)/home";
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
    case "motorista":
      return "DRIVER";
    default:
      return undefined;
  }
}

function isActivatableRole(role?: string | null) {
  const normalized = normalizeRole(role);

  return (
    normalized === "GENERATOR_SMALL" ||
    normalized === "GENERATOR_LARGE" ||
    normalized === "COLLECTOR" ||
    normalized === "DRIVER"
  );
}

function checkRequiresActivation(result: any) {
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
    try {
      const currentUser = await authService.getCurrentUserData();
      setUser(currentUser);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      setUser(null);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const currentUser = await authService.getCurrentUserData();
        setUser(currentUser);
      } catch (error) {
        console.error("Erro ao carregar sessão:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const signIn = async (
    email: string,
    password: string,
    expectedProfile?: string,
    rememberMe?: boolean
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
        await authService.clearSession();
        setUser(null);

        return {
          success: false,
          error: "Este usuário não pertence ao perfil selecionado.",
        };
      }

      if (checkRequiresActivation(result)) {
        setUser(result.user ?? null);

        router.replace({
          pathname: "/(public)/activate-access",
          params: { email: email.trim() },
        });

        return {
          success: true,
          requiresActivation: true,
          message: result.message,
        };
      }

      if (result.user) {
        setUser(result.user);
        router.replace(getRouteByRole(result.user.role));
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error("Erro inesperado ao entrar:", error);

      return {
        success: false,
        error: "Erro inesperado ao entrar.",
      };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      await authService.clearSession();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      setUser(null);
      setLoading(false);
      router.replace("/(public)/access-type");
    }
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
      } else if (
        userData.userType === "COOPERATIVE" ||
        userData.userType === "cooperativa"
      ) {
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

      if (result.user) {
        setUser(result.user);
        router.replace(getRouteByRole(result.user.role));
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);

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
    try {
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

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error("Erro ao ativar acesso:", error);

      return {
        success: false,
        error: "Erro ao ativar acesso.",
      };
    }
  };

  const forgotPassword = async (email: string): Promise<AuthActionResult> => {
    try {
      const result = await authService.forgotPassword(email);

      if (result.success === false) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        message:
          result.message ||
          "Se o e-mail existir em nossa base, enviamos as instruções de recuperação.",
      };
    } catch (error) {
      console.error("Erro ao solicitar recuperação de senha:", error);

      return {
        success: false,
        error: "Erro ao solicitar recuperação de senha.",
      };
    }
  };

  const resetPassword = async (
    data: ResetPasswordInput
  ): Promise<AuthActionResult> => {
    try {
      const result = await authService.resetPassword({
        email: data.email,
        token: data.token,
        temporaryPassword: data.temporaryPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      if (result.success === false) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        message: result.message || "Senha alterada com sucesso.",
      };
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);

      return {
        success: false,
        error: "Erro ao redefinir senha.",
      };
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
        activateGeneratorAccess,
        forgotPassword,
        resetPassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
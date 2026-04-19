import { api } from "./api";
import { UserDoc } from "../types/user";
import { sessionService } from "./sessionService";

export type AuthSuccess = {
  success: true;
  user?: UserDoc;
  token?: string;
  requiresActivation?: boolean;
  firstAccess?: boolean;
  mustChangePassword?: boolean;
  message?: string;
  resetToken?: string;
};

export type AuthError = {
  success: false;
  error: string;
};

export type AuthResult = AuthSuccess | AuthError;

type LoginResponse = {
  token?: string;
  user?: UserDoc;
  requiresActivation?: boolean;
  firstAccess?: boolean;
  mustChangePassword?: boolean;
  message?: string;
};

type MeResponse = {
  user?: UserDoc;
};

type ActivateAccessResponse = {
  message?: string;
  token?: string;
  user?: UserDoc;
};

type ForgotPasswordResponse = {
  message?: string;
  token?: string;
  resetToken?: string;
};

type ResetPasswordResponse = {
  message?: string;
};

type RegisterPfPayload = {
  displayName: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  address?: string;
  rememberMe?: boolean;
};

type RegisterCooperativePayload = {
  displayName: string;
  email: string;
  password: string;
  phone: string;
  cooperativeName: string;
  registrationNumber: string;
  address?: string;
  rememberMe?: boolean;
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

class AuthService {
  async saveSession(token: string, user?: UserDoc): Promise<void> {
    await sessionService.saveSession({
      token,
      user: user ?? null,
      userId: user?.id ?? null,
    });
  }

  async saveToken(token: string): Promise<void> {
    const currentUser = await this.getStoredUser();

    await sessionService.saveSession({
      token,
      user: currentUser ?? null,
      userId: currentUser?.id ?? null,
    });
  }

  async getToken(): Promise<string | null> {
    return sessionService.getToken();
  }

  async removeToken(): Promise<void> {
    const currentUser = await this.getStoredUser();

    if (currentUser) {
      await sessionService.clearSession();
      return;
    }

    await sessionService.clearSession();
  }

  async saveUser(user: UserDoc): Promise<void> {
    const token = await this.getToken();

    if (!token) {
      return;
    }

    await sessionService.saveSession({
      token,
      user,
      userId: user?.id ?? null,
    });
  }

  async getStoredUser(): Promise<UserDoc | null> {
    const user = await sessionService.getUser();
    return (user as UserDoc | null) ?? null;
  }

  async removeUser(): Promise<void> {
    const token = await this.getToken();

    if (!token) {
      await sessionService.clearSession();
      return;
    }

    await sessionService.saveSession({
      token,
      user: null,
      userId: null,
    });
  }

  async clearSession(): Promise<void> {
    await sessionService.clearSession();
  }

  async registerPf(data: RegisterPfPayload): Promise<AuthResult> {
    try {
      const payload = {
        ...data,
        email: normalizeEmail(data.email),
      };

      const response = await api.post<LoginResponse>("/auth/register/pf", payload);

      if (!response.user) {
        return {
          success: false,
          error: "Usuário não retornado no cadastro.",
        };
      }

      if (!response.token) {
        return {
          success: false,
          error: "Token não retornado no cadastro.",
        };
      }

      await this.saveSession(response.token, response.user);

      return {
        success: true,
        user: response.user,
        token: response.token,
        requiresActivation: response.requiresActivation,
        firstAccess: response.firstAccess,
        mustChangePassword: response.mustChangePassword,
        message: response.message,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao registrar pessoa física.",
      };
    }
  }

  async registerCooperative(
    data: RegisterCooperativePayload
  ): Promise<AuthResult> {
    try {
      const payload = {
        ...data,
        email: normalizeEmail(data.email),
      };

      const response = await api.post<LoginResponse>(
        "/auth/register/cooperative",
        payload
      );

      if (!response.user) {
        return {
          success: false,
          error: "Usuário não retornado no cadastro da cooperativa.",
        };
      }

      if (!response.token) {
        return {
          success: false,
          error: "Token não retornado no cadastro da cooperativa.",
        };
      }

      await this.saveSession(response.token, response.user);

      return {
        success: true,
        user: response.user,
        token: response.token,
        requiresActivation: response.requiresActivation,
        firstAccess: response.firstAccess,
        mustChangePassword: response.mustChangePassword,
        message: response.message,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao registrar cooperativa.",
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: normalizeEmail(email),
        password,
      });

      if (!response.user) {
        return {
          success: false,
          error: "Usuário não retornado no login.",
        };
      }

      if (!response.token) {
        return {
          success: false,
          error: "Token não retornado no login.",
        };
      }

      await this.saveSession(response.token, response.user);

      return {
        success: true,
        user: response.user,
        token: response.token,
        requiresActivation: response.requiresActivation,
        firstAccess: response.firstAccess,
        mustChangePassword: response.mustChangePassword,
        message: response.message,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Erro ao fazer login.",
      };
    }
  }

  async activateGeneratorAccess(
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const response = await api.post<ActivateAccessResponse>(
        "/auth/activate-generator-access",
        {
          email: normalizeEmail(email),
          password,
        }
      );

      if (!response.user) {
        return {
          success: false,
          error: "Usuário não retornado na liberação de acesso.",
        };
      }

      if (!response.token) {
        return {
          success: false,
          error: "Token não retornado na liberação de acesso.",
        };
      }

      await this.saveSession(response.token, response.user);

      return {
        success: true,
        user: response.user,
        token: response.token,
        message: response.message,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Erro ao liberar acesso.",
      };
    }
  }

  async forgotPassword(email: string): Promise<AuthResult> {
    try {
      const response = await api.post<ForgotPasswordResponse>(
        "/auth/forgot-password",
        {
          email: normalizeEmail(email),
        }
      );

      return {
        success: true,
        message:
          response.message ||
          "Se o e-mail existir, a recuperação foi iniciada.",
        resetToken: response.resetToken || response.token,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao solicitar recuperação de senha.",
      };
    }
  }

  async resetPassword(data: {
    email: string;
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResult> {
    try {
      const response = await api.post<ResetPasswordResponse>(
        "/auth/reset-password",
        {
          email: normalizeEmail(data.email),
          token: data.token.trim(),
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }
      );

      return {
        success: true,
        message: response.message || "Senha redefinida com sucesso.",
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao redefinir a senha.",
      };
    }
  }

  async getCurrentUserData(): Promise<UserDoc | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const response = await api.get<MeResponse>("/auth/me", true);
      const user = response?.user;

      if (!user) {
        const storedUser = await this.getStoredUser();
        return storedUser;
      }

      await this.saveUser(user);
      return user;
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);

      const storedUser = await this.getStoredUser();
      if (storedUser) {
        return storedUser;
      }

      return null;
    }
  }

  async logout(): Promise<{ success: true }> {
    await this.clearSession();
    return { success: true };
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export default new AuthService();
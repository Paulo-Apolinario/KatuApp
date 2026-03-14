import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export type UserType =
  | "pf"
  | "comercial"
  | "grande"
  | "cooperativa"
  | "catador";

export interface UserData {
  address: string;
  totalKg: number;
  uid: string;
  email: string;
  displayName: string;
  userType: UserType;
  createdAt?: Timestamp | Date | null;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  companyName?: string;
  cooperativeName?: string;
  registrationNumber?: string;
  profileCompleted?: boolean;
  rememberMe?: boolean;
}


interface AuthSuccess {
  success: true;
  user: UserData;
}

interface AuthError {
  success: false;
  error: string;
}

type AuthResult = AuthSuccess | AuthError;

class AuthService {
  async register(
    email: string,
    password: string,
    userData: Omit<UserData, "uid" | "createdAt">
  ): Promise<AuthResult> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const firebaseUser = userCredential.user;

      const fullUserData: UserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? email.trim(),
        displayName: userData.displayName?.trim() || "",
        userType: userData.userType,
        createdAt: null,
        phone: userData.phone?.trim() || "",
        address: userData.address?.trim() || "",
        cpf: userData.cpf || "",
        cnpj: userData.cnpj || "",
        companyName: userData.companyName?.trim() || "",
        cooperativeName: userData.cooperativeName?.trim() || "",
        registrationNumber: userData.registrationNumber || "",
        profileCompleted: true,
        rememberMe: userData.rememberMe ?? false,
        totalKg: 0
      };

      const firestorePayload = {
        ...fullUserData,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), firestorePayload);

      const savedUserDoc = await getDoc(doc(db, "users", firebaseUser.uid));

      if (!savedUserDoc.exists()) {
        return {
          success: false,
          error: "Usuário criado, mas não foi possível confirmar os dados.",
        };
      }

      const savedUser = savedUserDoc.data() as UserData;

      return {
        success: true,
        user: savedUser,
      };
    } catch (error: any) {
      console.error("Erro no registro:", error);

      let errorMessage = "Erro ao registrar usuário";

      if (error?.code === "auth/email-already-in-use") {
        errorMessage = "Este e-mail já está em uso";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "E-mail inválido";
      } else if (error?.code === "auth/weak-password") {
        errorMessage = "Senha muito fraca";
      } else if (error?.code === "auth/network-request-failed") {
        errorMessage = "Falha de rede. Verifique sua conexão";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const firebaseUser = userCredential.user;
      const userRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        return {
          success: false,
          error:
            "Usuário autenticado, mas sem cadastro completo no sistema.",
        };
      }

      const userData = userDoc.data() as UserData;

      if (!userData?.userType) {
        await signOut(auth);
        return {
          success: false,
          error: "Tipo de usuário inválido ou não encontrado.",
        };
      }

      return {
        success: true,
        user: userData,
      };
    } catch (error: any) {
      console.error("Erro no login:", error);

      let errorMessage = "Erro ao fazer login";

      if (error?.code === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado";
      } else if (error?.code === "auth/wrong-password") {
        errorMessage = "Senha incorreta";
      } else if (error?.code === "auth/invalid-credential") {
        errorMessage = "E-mail ou senha inválidos";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "E-mail inválido";
      } else if (error?.code === "auth/too-many-requests") {
        errorMessage = "Muitas tentativas. Tente novamente mais tarde";
      } else if (error?.code === "auth/network-request-failed") {
        errorMessage = "Falha de rede. Verifique sua conexão";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error("Erro no logout:", error);
      return {
        success: false,
        error: "Erro ao fazer logout",
      };
    }
  }

  async resetPassword(
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);

      let errorMessage = "Erro ao enviar e-mail de recuperação";

      if (error?.code === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "E-mail inválido";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getCurrentUserData(): Promise<UserData | null> {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) return null;

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));

      if (!userDoc.exists()) return null;

      return userDoc.data() as UserData;
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
      return null;
    }
  }

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }
}

export default new AuthService();
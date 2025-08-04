import { useState, useEffect, useCallback } from "react";
import {
  isWebAuthnSupported,
  isBiometricAvailable,
  registerCredential,
  authenticateWithCredential,
  registerWebAuthnCredential,
  authenticateWebAuthn,
  getWebAuthnStatus,
} from "../lib/webauthn";

interface WebAuthnStatus {
  isSupported: boolean;
  isBiometricAvailable: boolean;
  hasRegisteredCredential: boolean;
  registeredAt: string | null;
}

interface WebAuthnState {
  status: WebAuthnStatus;
  isLoading: boolean;
  isRegistering: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

export function useWebAuthn() {
  const [state, setState] = useState<WebAuthnState>({
    status: {
      isSupported: false,
      isBiometricAvailable: false,
      hasRegisteredCredential: false,
      registeredAt: null,
    },
    isLoading: true,
    isRegistering: false,
    isAuthenticating: false,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const isSupported = isWebAuthnSupported();
      const biometricAvailable = isSupported ? await isBiometricAvailable() : false;
      const webauthnStatus = isSupported ? await getWebAuthnStatus() : { hasRegisteredCredential: false, registeredAt: null };
      
      setState(prev => ({
        ...prev,
        status: {
          isSupported,
          isBiometricAvailable: biometricAvailable,
          hasRegisteredCredential: webauthnStatus.hasRegisteredCredential,
          registeredAt: webauthnStatus.registeredAt,
        },
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to check WebAuthn status",
        isLoading: false,
      }));
    }
  }, []);

  const register = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isRegistering: true, error: null }));
      
      const credential = await registerCredential();
      await registerWebAuthnCredential(credential);
      
      await checkStatus();
      setState(prev => ({ ...prev, isRegistering: false }));
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Registration failed",
        isRegistering: false,
      }));
      return false;
    }
  }, [checkStatus]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isAuthenticating: true, error: null }));
      
      const webauthnStatus = await getWebAuthnStatus();
      if (!webauthnStatus.hasRegisteredCredential) {
        throw new Error("No registered credential found");
      }
      
      const assertion = await authenticateWithCredential();
      await authenticateWebAuthn(assertion);
      
      setState(prev => ({ ...prev, isAuthenticating: false }));
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Authentication failed",
        isAuthenticating: false,
      }));
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    ...state,
    register,
    authenticate,
    clearError,
    refresh: checkStatus,
  };
}

import * as SecureStore from "expo-secure-store";
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {Api, setBearerToken, type User} from "../api";

const TOKEN_KEY = "raritone_access_token";
type AuthValue = {
  user: User | null; token: string | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>; refreshUser: () => Promise<void>;
  startSession: (result: {token: string; user: User}) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({children}: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const signOut = useCallback(async () => {
    setUser(null); setToken(null); setBearerToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);
  const refreshUser = useCallback(async () => { setUser(await Api.me()); }, []);
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(TOKEN_KEY).then(async saved => {
      if (!saved) return;
      setBearerToken(saved);
      const current = await Api.me();
      if (alive) { setToken(saved); setUser(current); }
    }).catch(async () => { await SecureStore.deleteItemAsync(TOKEN_KEY); setBearerToken(null); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const accept = useCallback(async (result: {token: string; user: User}) => {
    await SecureStore.setItemAsync(TOKEN_KEY, result.token);
    setBearerToken(result.token); setToken(result.token); setUser(result.user);
  }, []);
  const signIn = useCallback(async (email: string, password: string) => accept(await Api.login(email.trim(), password)), [accept]);
  const signUp = useCallback(async (name: string, email: string, password: string) => accept(await Api.signup(name.trim(), email.trim(), password)), [accept]);
  const updateUser = useCallback(async (data: Partial<User>) => setUser(await Api.updateMe(data)), []);
  const value = useMemo(() => ({user, token, loading, signIn, signUp, signOut, refreshUser, startSession: accept, updateUser}), [user, token, loading, signIn, signUp, signOut, refreshUser, accept, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

import { useCallback, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { getSession, setSession, findUserById, findUserByEmail } from "../data/auth";

export function useAuth() {
  const { records } = useData();
  const users = records.corp_users || [];
  const [session, setSessionState] = useState(getSession);

  const currentUser = session ? findUserById(users, session.userId) : null;
  const currentRole = currentUser ? currentUser.role : "consulta";

  const login = useCallback((email, senha) => {
    const u = findUserByEmail(users, email);
    if (!u || String(u.senha) !== String(senha)) {
      return { ok: false, error: "E-mail ou senha inválidos." };
    }
    const s = { userId: u.id, at: new Date().toISOString() };
    setSession(s);
    setSessionState(s);
    return { ok: true };
  }, [users]);

  const logout = useCallback(() => {
    setSession(null);
    setSessionState(null);
  }, []);

  return { currentUser, currentRole, login, logout };
}

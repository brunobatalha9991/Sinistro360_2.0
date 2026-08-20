import { useCallback, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { getSession, setSession, findUserById, findUserByEmail } from "../data/auth";
import { hashNewPassword, verifyPassword } from "../logic/passwordHash";

export function useAuth() {
  const { records, saveRecord } = useData();
  const users = records.corp_users || [];
  const [session, setSessionState] = useState(getSession);

  const currentUser = session ? findUserById(users, session.userId) : null;
  const currentRole = currentUser ? currentUser.role : "consulta";

  const login = useCallback(async (email, senha) => {
    const u = findUserByEmail(users, email);
    if (!u) return { ok: false, error: "E-mail ou senha inválidos." };

    if (u.senhaHash && u.senhaSalt) {
      const ok = await verifyPassword(senha, u.senhaSalt, u.senhaHash);
      if (!ok) return { ok: false, error: "E-mail ou senha inválidos." };
    } else {
      // Usuário ainda com senha antiga em texto puro — confere do jeito
      // legado e, se bater, migra para hash na hora, sem exigir nenhuma
      // ação do usuário.
      if (String(u.senha) !== String(senha)) {
        return { ok: false, error: "E-mail ou senha inválidos." };
      }
      const { senhaSalt, senhaHash } = await hashNewPassword(senha);
      saveRecord("corp_users", (current) => {
        const list = current || [];
        return list.map((x) => {
          if (x.id !== u.id) return x;
          const { senha: _drop, ...rest } = x;
          return { ...rest, senhaSalt, senhaHash };
        });
      });
    }

    const s = { userId: u.id, at: new Date().toISOString() };
    setSession(s);
    setSessionState(s);
    return { ok: true };
  }, [users, saveRecord]);

  const logout = useCallback(() => {
    setSession(null);
    setSessionState(null);
  }, []);

  return { currentUser, currentRole, login, logout };
}

import { useCallback, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { getSession, setSession, findUserById, findUserByEmail, getVipViewOff, setVipViewOff } from "../data/auth";
import { hashNewPassword, verifyPassword } from "../logic/passwordHash";

export function useAuth() {
  const { records, saveRecord } = useData();
  const users = records.corp_users || [];
  const [session, setSessionState] = useState(getSession);
  // Liga/desliga a "visão VIP" (a pedido do usuário) — só existe pra quem
  // realmente tem VIP concedido (rawUser.vip); é uma escolha pessoal de
  // como EU quero ver o sistema agora, não muda o que o admin concedeu.
  // Guardado por usuário em sessionStorage (ver getVipViewOff/setVipViewOff
  // em data/auth.js) pra sobreviver a um F5 dentro da mesma aba/sessão.
  const [vipOff, setVipOff] = useState(() => {
    const s = getSession();
    return s ? getVipViewOff(s.userId) : false;
  });

  const rawUser = session ? findUserById(users, session.userId) : null;
  const isRealVip = !!(rawUser && rawUser.vip);
  // Com a visão VIP desativada, o usuário passa a ser tratado em TODO o
  // app como se `vip` fosse false — isAdmin()/canEdit()/userModulos() etc.
  // (data/auth.js) leem esse mesmo objeto, então a troca se propaga sozinha
  // pra tudo, sem precisar mexer em nenhum outro lugar.
  const currentUser = isRealVip && vipOff ? { ...rawUser, vip: false } : rawUser;
  const currentRole = currentUser ? currentUser.role : "consulta";
  const vipViewActive = isRealVip && !vipOff;

  function toggleVipView() {
    if (!isRealVip) return;
    const next = !vipOff;
    setVipOff(next);
    setVipViewOff(rawUser.id, next);
  }

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
    setVipOff(getVipViewOff(u.id));
    return { ok: true };
  }, [users, saveRecord]);

  const logout = useCallback(() => {
    setSession(null);
    setSessionState(null);
  }, []);

  return { currentUser, currentRole, login, logout, isRealVip, vipViewActive, toggleVipView };
}

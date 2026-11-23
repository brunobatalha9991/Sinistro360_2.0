import { useCallback, useRef, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { getSession, setSession, findUserById, findUserByEmail, getVipViewOff, setVipViewOff } from "../data/auth";
import { hashNewPassword, verifyPassword } from "../logic/passwordHash";

const TIMEOUT = Symbol("timeout");
const ESPERA_MAX_MS = 20000;
const PASSO_MS = 200;
// Depois que a coleção de usuários chegou do servidor, ainda há um atraso
// curto até ela aparecer em `records` (o adaptador agrupa as mudanças antes
// de avisar a tela) — só conclui "e-mail não existe" depois dessa folga.
const FOLGA_APOS_CARREGAR_MS = 1000;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function useAuth() {
  const { records, saveRecord, recordCarregado } = useData();
  const users = records.corp_users || [];
  // Sempre a lista mais recente — o login espera dentro de um callback
  // assíncrono e precisa enxergar os usuários que chegarem depois do clique.
  const usersRef = useRef(users);
  usersRef.current = users;
  const carregadoRef = useRef(recordCarregado);
  carregadoRef.current = recordCarregado;
  const usuariosProntos = recordCarregado("corp_users") && users.length > 0;

  // Usuário pelo e-mail, esperando a lista chegar do servidor. Devolve o
  // usuário, null (lista carregada e o e-mail não existe) ou TIMEOUT.
  async function aguardarUsuario(email) {
    const inicio = Date.now();
    let carregadoDesde = null;
    for (;;) {
      const u = findUserByEmail(usersRef.current, email);
      if (u) return u;
      if (carregadoRef.current("corp_users")) {
        if (carregadoDesde == null) carregadoDesde = Date.now();
        if (usersRef.current.length && Date.now() - carregadoDesde >= FOLGA_APOS_CARREGAR_MS) return null;
      }
      if (Date.now() - inicio >= ESPERA_MAX_MS) return TIMEOUT;
      await espera(PASSO_MS);
    }
  }
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
    // Bug relatado 2026-11-23: logo ao abrir o sistema, a lista de usuários
    // ainda não chegou do Firebase (o 1º retrato pode levar alguns segundos,
    // mais se a credencial anônima precisar ser renovada) — o login procurava
    // o e-mail numa lista vazia e dizia "E-mail ou senha inválidos", e só
    // entrava depois de alguns cliques. Agora espera a lista chegar.
    const u = await aguardarUsuario(email);
    if (u === TIMEOUT) return { ok: false, error: "Não foi possível conectar ao servidor. Verifique a internet e tente de novo." };
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
  }, [saveRecord]);

  const logout = useCallback(() => {
    setSession(null);
    setSessionState(null);
  }, []);

  return { currentUser, currentRole, login, logout, isRealVip, vipViewActive, toggleVipView, usuariosProntos };
}

import { useEffect, useRef, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { isAdmin } from "../data/auth";
import { ehOperacional } from "../logic/conduta";
import { semInteracaoCfg } from "../logic/ciAutomacao";
import { dataLocalISO, addDias } from "../logic/agenda";
import {
  indicesOperadores, montarFoto, registrarFoto, resumoRitmo, textoFechamento, idRitmo, idFechamento,
  dentroDoExpediente, passouDoFim, INTERVALO_FOTO_MIN, DIAS_GUARDADOS_RITMO,
} from "../logic/desempenhoRitmo";
import { useTasksActions } from "./useTasksActions";

// Monitor do Desempenho (ver logic/desempenhoRitmo.js). Sem servidor: roda
// no navegador de quem está logado — o operador fotografa o próprio índice
// e Admin/VIP fotografam a equipe toda (assim há foto mesmo com o operador
// fora). A gravação é idempotente (intervalo mínimo checado dentro do
// updater), então várias abas/pessoas juntas não duplicam foto nem aviso.
// Mudança relevante → notificação azul-escuro aos Admin/VIP; depois do fim
// do expediente, um Admin/VIP manda o fechamento do dia da equipe.
const CHECK_MS = 60 * 1000;

export function useDesempenhoMonitor(currentUser) {
  const { records, config, saveRecord, recordCarregado } = useData();
  const { pushNotif } = useTasksActions();
  const [tick, setTick] = useState(0);
  const ref = useRef({ records, config });
  ref.current = { records, config };

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const prontos = ["corp_desempenho_ritmo", "corp_tasks", "corp_users", "corp_claims", "corp_overrides", "corp_agenda", "corp_agenda_feedback"].every((k) => recordCarregado(k));
  const userId = currentUser && currentUser.id;
  const gestor = isAdmin(currentUser);
  const operador = ehOperacional(currentUser);

  useEffect(() => {
    if (!userId || !prontos || (!gestor && !operador)) return;
    const { records: rec, config: cfg } = ref.current;
    const agora = new Date();
    const cfgCI = semInteracaoCfg(cfg);
    const hoje = dataLocalISO(agora);
    const ritmo = rec.corp_desempenho_ritmo || {};
    const users = rec.corp_users || [];
    const gestores = users.filter(isAdmin).map((u) => u.id);

    // Fotos: só no expediente e só de quem está sem foto recente.
    if (dentroDoExpediente(agora, cfgCI)) {
      const alvos = (gestor ? users.filter(ehOperacional) : [currentUser]).filter((u) => {
        const r = ritmo[idRitmo(u.id, hoje)];
        const ult = r && r.ultimo;
        return !ult || agora.getTime() - new Date(ult.at).getTime() >= INTERVALO_FOTO_MIN * 60000;
      });
      if (alvos.length) {
        const indices = indicesOperadores({ records: rec, config: cfg, operadores: alvos, agora });
        const avisos = [];
        saveRecord("corp_desempenho_ritmo", (cur) => {
          const base = cur || {};
          let mudou = false;
          const next = { ...base };
          avisos.length = 0;
          alvos.forEach((u) => {
            const x = indices[u.id];
            if (!x) return;
            const id = idRitmo(u.id, hoje);
            const r = registrarFoto(base[id], { userId: u.id, data: hoje, foto: montarFoto(x.indice, x.impacto, agora, x.ganhos) });
            if (!r) return;
            next[id] = r.registro;
            mudou = true;
            if (r.comparacao.relevante) avisos.push({ u, mudancas: r.comparacao.mudancas });
          });
          return mudou ? next : base;
        });
        avisos.forEach(({ u, mudancas }) => {
          pushNotif("__desempenho__", gestores.filter((g) => g !== u.id), `📊 ${u.nome}: ${mudancas.join(" • ")}`,
            undefined, false, false, false, { tipo: "desempenho_mudanca", alvoId: u.id });
        });
      }
    }

    // Fechamento do dia (só Admin/VIP enviam): hoje depois do fim do
    // expediente, ou dias anteriores (até 3) que ficaram sem fechamento.
    if (!gestor) return;
    const operadores = users.filter(ehOperacional);
    const dias = [1, 2, 3].map((n) => addDias(hoje, -n));
    if (passouDoFim(agora, cfgCI)) dias.unshift(hoje);
    const pendente = dias.find((d) => !ritmo[idFechamento(d)] && operadores.some((u) => ritmo[idRitmo(u.id, d)]));
    if (!pendente) return;
    // Hoje, ainda na meia hora pós-expediente: espera a foto pós-fim de
    // todos (pega a virada "pendente → atraso" no fechamento).
    if (pendente === hoje && dentroDoExpediente(agora, cfgCI)) {
      const semFotoFinal = operadores.some((u) => {
        const r = ritmo[idRitmo(u.id, hoje)];
        return r && r.ultimo && !passouDoFim(new Date(r.ultimo.at), cfgCI);
      });
      if (semFotoFinal) return;
    }
    const linhas = operadores.map((u) => ({ u, resumo: resumoRitmo(ritmo[idRitmo(u.id, pendente)]) }));
    const texto = textoFechamento(pendente, linhas);
    let enviar = false;
    const limite = addDias(hoje, -DIAS_GUARDADOS_RITMO);
    saveRecord("corp_desempenho_ritmo", (cur) => {
      const base = cur || {};
      if (base[idFechamento(pendente)]) return base;
      enviar = true;
      const next = {};
      Object.keys(base).forEach((k) => { if (!base[k] || String(base[k].data || "") >= limite) next[k] = base[k]; });
      next[idFechamento(pendente)] = {
        id: idFechamento(pendente), data: pendente, enviadoEm: agora.toISOString(), por: userId, texto: texto || "",
        linhas: linhas.filter((l) => l.resumo).map((l) => ({ userId: l.u.id, ...l.resumo })),
      };
      return next;
    });
    if (enviar && texto) {
      pushNotif("__desempenho__", gestores, `📋 ${texto}`, undefined, false, false, false, { tipo: "desempenho_fechamento", data: pendente });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, userId, prontos, gestor, operador]);
}

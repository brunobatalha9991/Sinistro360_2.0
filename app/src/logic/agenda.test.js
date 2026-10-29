import { describe, it, expect } from "vitest";
import {
  blocoAplicaNaData, ocorrenciasDoDia, alarmesAgenda, statusOcorrencia, indexarFeedbacks,
  metricasAgenda, aplicarModelo, dataLocalISO, addDias, PRESETS_DEFAULT, MODELOS_DEFAULT, modeloDoDia,
} from "./agenda";

// 2026-10-26 é uma segunda-feira.
const SEG = "2026-10-26";
const SAB = "2026-10-31";
function em(dataISO, hhmm) {
  const [y, m, d] = dataISO.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0);
}
function bloco(extra) {
  return { id: "b1", userId: "u1", titulo: "Checar e-mails", inicio: "09:00", fim: "09:30", data: SEG, tipo: "acao", lembreteMin: 5, recorrencia: { tipo: "nenhuma" }, excecoes: {}, ...extra };
}
function fb(tipo, data, hhmm, extra) {
  return { id: tipo + hhmm, userId: "u1", blocoId: "b1", data, tipo, texto: "ok ok", at: em(data, hhmm).toISOString(), ...extra };
}

describe("datas locais", () => {
  it("dataLocalISO usa o relógio local, não UTC", () => {
    expect(dataLocalISO(new Date(2026, 9, 26, 23, 30))).toBe("2026-10-26");
  });
  it("addDias atravessa o mês", () => {
    expect(addDias("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("recorrência", () => {
  it("não repete: só no dia do bloco", () => {
    expect(blocoAplicaNaData(bloco(), SEG)).toBe(true);
    expect(blocoAplicaNaData(bloco(), addDias(SEG, 1))).toBe(false);
  });
  it("dias úteis pula sábado e respeita a data final", () => {
    const b = bloco({ recorrencia: { tipo: "dias_uteis", ate: "2026-10-29" } });
    expect(blocoAplicaNaData(b, "2026-10-28")).toBe(true);
    expect(blocoAplicaNaData(b, "2026-10-30")).toBe(false);
    expect(blocoAplicaNaData(bloco({ recorrencia: { tipo: "dias_uteis" } }), SAB)).toBe(false);
  });
  it("semanal só nos dias escolhidos; nunca antes do início", () => {
    const b = bloco({ recorrencia: { tipo: "semanal", dias: [3] } });
    expect(blocoAplicaNaData(b, "2026-10-28")).toBe(true);
    expect(blocoAplicaNaData(b, "2026-10-29")).toBe(false);
    expect(blocoAplicaNaData(b, "2026-10-21")).toBe(false);
  });
  it("exceção move ou remove só aquele dia", () => {
    const b = bloco({ recorrencia: { tipo: "diaria" }, excecoes: { "2026-10-27": { inicio: "10:00", fim: "10:30" }, "2026-10-28": { removida: true } } });
    expect(ocorrenciasDoDia([b], "u1", "2026-10-27")[0].inicio).toBe("10:00");
    expect(ocorrenciasDoDia([b], "u1", "2026-10-28")).toHaveLength(0);
    expect(ocorrenciasDoDia([b], "u1", SEG)[0].inicio).toBe("09:00");
  });
  it("só traz os blocos do próprio usuário", () => {
    expect(ocorrenciasDoDia([bloco({ userId: "u2" })], "u1", SEG)).toHaveLength(0);
  });
});

describe("alarmes", () => {
  const b = [bloco()];
  it("lembrete antes do início, depois iniciar, depois perdida", () => {
    expect(alarmesAgenda(b, [], "u1", em(SEG, "08:50"))).toHaveLength(0);
    expect(alarmesAgenda(b, [], "u1", em(SEG, "08:56"))[0].fase).toBe("lembrete");
    expect(alarmesAgenda(b, [], "u1", em(SEG, "09:01"))[0].fase).toBe("iniciar");
    expect(alarmesAgenda(b, [], "u1", em(SEG, "09:40"))[0].fase).toBe("perdida");
  });
  it("lembrete respondido não volta", () => {
    expect(alarmesAgenda(b, [fb("lembrete", SEG, "08:56")], "u1", em(SEG, "08:58"))).toHaveLength(0);
  });
  it("iniciada: só alarma de novo no fim", () => {
    const f = [fb("inicio", SEG, "09:01")];
    expect(alarmesAgenda(b, f, "u1", em(SEG, "09:10"))).toHaveLength(0);
    expect(alarmesAgenda(b, f, "u1", em(SEG, "09:30"))[0].fase).toBe("finalizar");
  });
  it("concluída ou não realizada não alarma mais", () => {
    expect(alarmesAgenda(b, [fb("inicio", SEG, "09:01"), fb("fim", SEG, "09:31")], "u1", em(SEG, "09:40"))).toHaveLength(0);
    expect(alarmesAgenda(b, [fb("nao_realizada", SEG, "09:41")], "u1", em(SEG, "09:45"))).toHaveLength(0);
  });
  it("soneca segura o alarme da mesma fase por 3 minutos", () => {
    const f = [fb("soneca", SEG, "09:01", { fase: "iniciar" })];
    expect(alarmesAgenda(b, f, "u1", em(SEG, "09:03"))).toHaveLength(0);
    expect(alarmesAgenda(b, f, "u1", em(SEG, "09:04"))[0].fase).toBe("iniciar");
  });
  it("marco alarma uma vez só, pra marcar como feito", () => {
    const m = [bloco({ tipo: "marco", inicio: "18:00", fim: "18:00", lembreteMin: 0 })];
    expect(alarmesAgenda(m, [], "u1", em(SEG, "17:59"))).toHaveLength(0);
    expect(alarmesAgenda(m, [], "u1", em(SEG, "18:00"))[0].fase).toBe("finalizar");
  });
  it("só alarma o dia de hoje", () => {
    expect(alarmesAgenda(b, [], "u1", em(addDias(SEG, 1), "10:00"))).toHaveLength(0);
  });
});

describe("status", () => {
  it("dia passado sem registro = perdida; hoje depois do início = atrasada", () => {
    const [oc] = ocorrenciasDoDia([bloco()], "u1", SEG);
    expect(statusOcorrencia(oc, {}, em(addDias(SEG, 1), "08:00"))).toBe("perdida");
    expect(statusOcorrencia(oc, {}, em(SEG, "09:05"))).toBe("atrasada");
    expect(statusOcorrencia(oc, indexarFeedbacks([fb("inicio", SEG, "09:02")]), em(SEG, "09:05"))).toBe("em_andamento");
  });
});

describe("indicadores", () => {
  it("cumprimento, pontualidade e tempo executado", () => {
    const blocos = [bloco({ recorrencia: { tipo: "dias_uteis" } })];
    const f = [
      fb("inicio", SEG, "09:02"), fb("fim", SEG, "09:32"),
      fb("inicio", "2026-10-27", "09:20"), fb("fim", "2026-10-27", "09:40"),
      fb("nao_realizada", "2026-10-28", "10:00"),
      fb("soneca", SEG, "09:00", { fase: "iniciar" }),
    ];
    const m = metricasAgenda({ blocos, feedbacks: f, userId: "u1", deISO: SEG, ateISO: "2026-10-29", agora: em("2026-10-29", "12:00") });
    expect(m.previstas).toBe(4);
    expect(m.vencidas).toBe(4);
    expect(m.concluidas).toBe(2);
    expect(m.naoRealizadas).toBe(1);
    expect(m.semRegistro).toBe(1);
    expect(m.taxaCumprimento).toBe(0.5);
    expect(m.pontualidade).toBe(0.5);
    expect(m.minExecutados).toBe(50);
    expect(m.sonecas).toBe(1);
  });
  it("não conta dias futuros", () => {
    const m = metricasAgenda({ blocos: [bloco({ recorrencia: { tipo: "diaria" } })], feedbacks: [], userId: "u1", deISO: SEG, ateISO: "2026-12-31", agora: em(SEG, "08:00") });
    expect(m.previstas).toBe(1);
    expect(m.vencidas).toBe(0);
    expect(m.taxaCumprimento).toBeNull();
  });
});

describe("modelos", () => {
  let n = 0;
  const base = { modelo: MODELOS_DEFAULT[0], presets: PRESETS_DEFAULT, userId: "u1", dataInicio: "2026-11-02", autorId: "adm", novoId: () => "n" + (n++), agoraISO: "x" };
  it("cria um bloco por item do modelo", () => {
    const out = aplicarModelo({ ...base, blocosAtuais: [] });
    expect(out).toHaveLength(MODELOS_DEFAULT[0].itens.length);
    expect(out.find((b) => b.presetId === "ap_fim").tipo).toBe("marco");
  });
  it("substituir encerra a recorrência anterior e remove avulsas futuras", () => {
    const atuais = [
      bloco({ id: "rec", recorrencia: { tipo: "dias_uteis" } }),
      bloco({ id: "avulsa", data: "2026-11-03" }),
      bloco({ id: "outro", userId: "u2", recorrencia: { tipo: "diaria" } }),
    ];
    const out = aplicarModelo({ ...base, blocosAtuais: atuais, substituir: true });
    expect(out.find((b) => b.id === "rec").recorrencia.ate).toBe("2026-11-01");
    expect(out.find((b) => b.id === "avulsa")).toBeUndefined();
    expect(out.find((b) => b.id === "outro").recorrencia.ate).toBeUndefined();
  });
});

describe("modeloDoDia", () => {
  it("guarda a ação inteira e aplicarModelo recria igual, inclusive personalizada", () => {
    const blocos = [
      { id: "b1", userId: "u1", data: "2026-10-29", recorrencia: { tipo: "dias_uteis" }, inicio: "08:30", fim: "09:00", titulo: "Checar e-mails", icone: "✉️", cor: "#0891b2", presetId: "ap_emails", tipo: "acao", lembreteMin: 5, excecoes: { "2026-10-29": { inicio: "08:45", fim: "09:15" } } },
      { id: "b2", userId: "u1", data: "2026-10-29", recorrencia: { tipo: "nenhuma" }, inicio: "10:00", fim: "10:30", titulo: "Reunião X", icone: "🤝", cor: "#123456", presetId: null, tipo: "acao", pausa: false, lembreteMin: 10, descricao: "pauta" },
    ];
    const ocs = ocorrenciasDoDia(blocos, "u1", "2026-10-29");
    const modelo = modeloDoDia(ocs, { id: "m1", nome: "Dia X" });
    expect(modelo.itens).toHaveLength(2);
    let n = 0;
    const novos = aplicarModelo({ blocosAtuais: [], modelo, presets: [], userId: "u2", dataInicio: "2026-10-30", recorrencia: { tipo: "dias_uteis" }, substituir: false, autorId: "g", novoId: () => "n" + (n++), agoraISO: "x" });
    expect(novos[0]).toMatchObject({ titulo: "Checar e-mails", inicio: "08:45", fim: "09:15", icone: "✉️", cor: "#0891b2", presetId: "ap_emails" });
    expect(novos[1]).toMatchObject({ titulo: "Reunião X", icone: "🤝", cor: "#123456", lembreteMin: 10, descricao: "pauta", presetId: null });
  });
});

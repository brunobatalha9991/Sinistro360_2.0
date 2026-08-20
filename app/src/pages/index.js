// Registro de telas portadas — cada rota some daqui só quando ganha sua
// própria tela real (as demais continuam no placeholder da Etapa 2).
//
// Cada tela é carregada sob demanda (code-splitting): o pacote inicial só
// traz a casca do app (login, menu, tema) + a tela que o usuário está
// vendo; as outras 11 telas só baixam quando ele navega até elas.
import { lazy } from "react";

export const PAGES = {
  dashboard: lazy(() => import("./Dashboard.jsx").then((m) => ({ default: m.Dashboard }))),
  sinistros: lazy(() => import("./Sinistros.jsx").then((m) => ({ default: m.Sinistros }))),
  sinistro: lazy(() => import("./Sinistro.jsx").then((m) => ({ default: m.Sinistro }))),
  abertura: lazy(() => import("./Abertura.jsx").then((m) => ({ default: m.Abertura }))),
  demandas: lazy(() => import("./Demandas.jsx").then((m) => ({ default: m.Demandas }))),
  tarefas: lazy(() => import("./Tarefas.jsx").then((m) => ({ default: m.Tarefas }))),
  clientes: lazy(() => import("./Clientes.jsx").then((m) => ({ default: m.Clientes }))),
  seguradoras: lazy(() => import("./AggPage.jsx").then((m) => ({ default: m.Seguradoras }))),
  oficinas: lazy(() => import("./AggPage.jsx").then((m) => ({ default: m.Oficinas }))),
  relatorios: lazy(() => import("./Relatorios.jsx").then((m) => ({ default: m.Relatorios }))),
  integracao: lazy(() => import("./Integracao.jsx").then((m) => ({ default: m.Integracao }))),
  config: lazy(() => import("./Configuracoes.jsx").then((m) => ({ default: m.Configuracoes }))),
};

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
  cliente: lazy(() => import("./Cliente.jsx").then((m) => ({ default: m.Cliente }))),
  seguradoras: lazy(() => import("./Seguradoras.jsx").then((m) => ({ default: m.Seguradoras }))),
  seguradora: lazy(() => import("./Seguradora.jsx").then((m) => ({ default: m.Seguradora }))),
  oficinas: lazy(() => import("./Oficinas.jsx").then((m) => ({ default: m.Oficinas }))),
  oficina: lazy(() => import("./Oficina.jsx").then((m) => ({ default: m.Oficina }))),
  relatorios: lazy(() => import("./Relatorios.jsx").then((m) => ({ default: m.Relatorios }))),
  assistente: lazy(() => import("./Assistente.jsx").then((m) => ({ default: m.Assistente }))),
  desempenho: lazy(() => import("./Desempenho.jsx").then((m) => ({ default: m.Desempenho }))),
  emails: lazy(() => import("./Emails.jsx").then((m) => ({ default: m.Emails }))),
  integracao: lazy(() => import("./Integracao.jsx").then((m) => ({ default: m.Integracao }))),
  config: lazy(() => import("./Configuracoes.jsx").then((m) => ({ default: m.Configuracoes }))),
};

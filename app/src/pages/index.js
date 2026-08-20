// Registro de telas portadas — cada rota some daqui só quando ganha sua
// própria tela real (as demais continuam no placeholder da Etapa 2).
import { Clientes } from "./Clientes.jsx";
import { Seguradoras, Oficinas } from "./AggPage.jsx";
import { Relatorios } from "./Relatorios.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { Sinistros } from "./Sinistros.jsx";

export const PAGES = {
  dashboard: Dashboard,
  sinistros: Sinistros,
  clientes: Clientes,
  seguradoras: Seguradoras,
  oficinas: Oficinas,
  relatorios: Relatorios,
};

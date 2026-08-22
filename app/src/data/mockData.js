// Dados fictícios usados SÓ no modo offline (nunca tocam o Firebase real).
// Formato idêntico ao que o app original guarda em localStorage/Firestore,
// pra servir de base realista ao portar as telas nas próximas etapas.

export const MOCK_USERS = [
  { id: "usr_admin", nome: "Administrador", email: "adm@batalha.com", senha: "1234", role: "admin" },
  { id: "usr_marina", nome: "Marina Costa", email: "marina@batalha.com", senha: "1234", role: "analista" },
  { id: "usr_joao", nome: "João Pereira", email: "joao@batalha.com", senha: "1234", role: "atendente" },
  { id: "usr_consulta", nome: "Consulta", email: "consulta@batalha.com", senha: "1234", role: "consulta" },
];

export const MOCK_CLAIMS = [
  {
    id: "clm_001_S_9001", codfil: "001", nosnum: "9001", numsin: "2026.001.9001", tipo: "S", codigo: "1",
    segurado: "Carlos Andrade", cia: "Porto Seguro", ramo: "Automóvel", numapo: "AP-4451", numend: "0",
    placa: "ABC1D23", situacao: "Em andamento", franquia: 1800, valavi: 12500, valind: 0, valdes: 0,
    datoco: "2026-07-02", datavi: "2026-07-05", datenc: null, oficina: "Oficina Central",
    partyType: "Segurado", descricao: "Colisão traseira em cruzamento.",
  },
  {
    id: "clm_001_S_9002", codfil: "001", nosnum: "9002", numsin: "2026.001.9002", tipo: "S", codigo: "1",
    segurado: "Fernanda Lima", cia: "Azul Seguros", ramo: "Automóvel", numapo: "AP-2290", numend: "0",
    placa: "DEF4G56", situacao: "Indenizado", franquia: 950, valavi: 8300, valind: 7350, valdes: 0,
    datoco: "2026-06-10", datavi: "2026-06-14", datenc: "2026-07-01", oficina: "Auto Center Sul",
    partyType: "Segurado", descricao: "Colisão lateral em via urbana.",
  },
  {
    id: "clm_002_T_9010", codfil: "002", nosnum: "9010", numsin: "2026.002.9010", tipo: "T", codigo: "2",
    segurado: "Ricardo Souza", cia: "Bradesco Seguros", ramo: "Automóvel", numapo: "AP-7783", numend: "0",
    placa: "GHI7J89", situacao: "Pendente", franquia: 0, valavi: 4200, valind: 0, valdes: 0,
    datoco: "2026-08-01", datavi: null, datenc: null, oficina: "",
    partyType: "Terceiro", descricao: "Danos materiais em terceiro.",
  },
  {
    id: "clm_001_S_9015", codfil: "001", nosnum: "9015", numsin: "2026.001.9015", tipo: "S", codigo: "1",
    segurado: "Patrícia Gomes", cia: "Porto Seguro", ramo: "Automóvel", numapo: "AP-1120", numend: "0",
    placa: "KLM3N45", situacao: "Negado", franquia: 1200, valavi: 0, valind: 0, valdes: 0,
    datoco: "2026-05-20", datavi: "2026-05-28", datenc: "2026-06-10", oficina: "Oficina Norte",
    partyType: "Segurado", descricao: "Sinistro negado por divergência de dados.",
  },
  {
    id: "clm_003_A_9020", codfil: "003", nosnum: "9020", numsin: "2026.003.9020", tipo: "A", codigo: "3",
    segurado: "Marcos Vieira", cia: "Azul Seguros", ramo: "Assistência 24h", numapo: "AP-9931", numend: "0",
    placa: "OPQ8R90", situacao: "Em andamento", franquia: 0, valavi: 0, valind: 0, valdes: 0,
    datoco: "2026-08-15", datavi: null, datenc: null, oficina: "",
    partyType: "Aviso", tipo_atendimento: "Reboque", descricao: "Pane elétrica na rodovia.",
  },
];

export const MOCK_OVERRIDES = {
  clm_001_S_9001: {
    sitAtend: "Aguard. Oficina",
    temperatura: "Moderado",
    responsavelUser: { id: "usr_marina", nome: "Marina Costa" },
    nextAction: { title: "Cobrar orçamento da oficina", date: "2026-08-22" },
  },
  clm_002_T_9010: {
    sitAtend: "Aguard. Seguradora",
    temperatura: "Em atenção",
    responsavelUser: { id: "usr_joao", nome: "João Pereira" },
    nextAction: { title: "Cobrar retorno da seguradora", date: "2026-08-10" },
  },
  clm_003_A_9020: {
    sitAtend: "Aguard. Cliente",
    temperatura: "Tranquilo",
  },
};

export const MOCK_TASKS = [
  {
    id: "tsk_001", tipo: "Comunicação", status: "Pendente", urgencia: "Moderado",
    origem: "usr_admin", destinatarios: ["usr_marina"],
    titulo: "Verificar sinistro 2026.001.9001",
    descricao: "Cliente ligou cobrando retorno sobre a oficina.",
    createdAt: "2026-08-19T13:00:00.000Z", updatedAt: "2026-08-19T13:00:00.000Z",
    ciente: {}, log: [], comments: [],
  },
];

export const MOCK_NOTIFS = [];
export const MOCK_DEMANDAS = [];
export const MOCK_RESPONSABILIDADE_HISTORICO = [];

export const MOCK_CONFIG = {
  corp_cfg: {},
  corp_task_types: ["Comunicação", "Lembrete", "Tarefa"],
  corp_form_endpoints: {},
  corp_journey_templates: {},
  corp_sit_options: ["Aguard. Cliente", "Aguard. Seguradora", "Aguard. Corretora", "Aguard. Oficina"],
  corp_temp_options: ["Tranquilo", "Moderado", "Grave", "Em atenção"],
  corp_atendimento_template: null,
};

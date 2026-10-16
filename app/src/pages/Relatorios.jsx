import { useHashRoute } from "../hooks/useHashRoute";
import { RelatorioAcompanhamento } from "../components/relatorios/RelatorioAcompanhamento.jsx";
import { RelatorioComunicacaoInterna } from "../components/relatorios/RelatorioComunicacaoInterna.jsx";
import { RelatorioResumo } from "../components/relatorios/RelatorioResumo.jsx";

// Catálogo de relatórios (a pedido do usuário): a página abre numa lista de
// opções e cada relatório tem a sua própria tela em #/relatorios/<id>.
// Relatório novo = um item aqui + o componente em components/relatorios/.
const RELATORIOS = [
  {
    id: "acompanhamento", icone: "📋", titulo: "Acompanhamento de processos", grupo: "Processos",
    descricao: "Tipo, responsável, cliente, último histórico e próxima ação de cada processo.",
    formatos: "Excel • PDF", Componente: RelatorioAcompanhamento,
  },
  {
    id: "comunicacao-interna", icone: "💬", titulo: "Comunicação interna", grupo: "Comunicação",
    descricao: "Origem, destinatários, confirmação de leitura, indicadores, vínculos e datas de cada comunicação.",
    formatos: "Excel • PDF", Componente: RelatorioComunicacaoInterna,
  },
  {
    id: "resumo", icone: "📊", titulo: "Resumo por situação e seguradora", grupo: "Processos",
    descricao: "Quantidade de processos por situação e por seguradora.",
    formatos: "Tela", Componente: RelatorioResumo,
  },
];

export function Relatorios() {
  const { param, navigate } = useHashRoute();
  const atual = RELATORIOS.find((r) => r.id === param);
  if (atual) {
    const { Componente } = atual;
    return <Componente onVoltar={() => navigate("relatorios")} />;
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted" style={{ margin: 0 }}>Escolha o relatório que deseja emitir.</p>
        </div>
      </div>
      <div className="rel-catalogo">
        {RELATORIOS.map((r) => (
          <button key={r.id} type="button" className="card rel-cat-item" onClick={() => navigate("relatorios", r.id)}>
            <div className="rel-cat-icone">{r.icone}</div>
            <div style={{ minWidth: 0 }}>
              <div className="rel-cat-grupo">{r.grupo}</div>
              <div className="rel-cat-titulo">{r.titulo}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{r.descricao}</div>
              <div className="rel-cat-formatos">{r.formatos}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

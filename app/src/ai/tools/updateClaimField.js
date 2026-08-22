import { campoEfetivo } from "../../logic/claims";
import { txt } from "../../logic/format";

// Whitelist fixa de campos editáveis pela IA — evita que o modelo tente
// mexer em campos estruturais (id, situação bruta da API CORP, valores
// financeiros etc.). Mesmo caminho de gravação de useOverrideActions().setOverrideCampo.
const CAMPOS_EDITAVEIS = {
  responsavel: "Responsável",
  observacoes: "Observações",
  descricao: "Descrição",
  oficina: "Oficina",
};

export const updateClaimFieldTool = {
  name: "update_claim_field",
  description: `Propõe a edição de um campo de um sinistro existente. Campos permitidos: ${Object.keys(CAMPOS_EDITAVEIS).join(", ")}. Use search_claims antes para obter o claimId correto. NÃO grava nada sozinho — o sistema pede confirmação do usuário antes de salvar.`,
  parameters: {
    type: "OBJECT",
    properties: {
      claimId: { type: "STRING", description: "id interno do sinistro (obtido via search_claims)." },
      campo: { type: "STRING", description: "Nome do campo a editar.", enum: Object.keys(CAMPOS_EDITAVEIS) },
      valor: { type: "STRING", description: "Novo valor para o campo." },
    },
    required: ["claimId", "campo", "valor"],
  },
  requiresConfirmation: true,
  run(args, ctx) {
    const { records } = ctx;
    const overrides = records.corp_overrides || {};
    const claim = (records.corp_claims || []).find((c) => c.id === args.claimId);
    if (!claim) return { error: "Sinistro não encontrado. Use search_claims para achar o claimId correto." };

    const campo = CAMPOS_EDITAVEIS[args.campo] ? args.campo : null;
    if (!campo) return { error: `Campo "${args.campo}" não é editável pelo assistente. Campos permitidos: ${Object.keys(CAMPOS_EDITAVEIS).join(", ")}.` };

    const valorAtual = txt(campoEfetivo(overrides, claim, campo));
    const valorNovo = String(args.valor || "").trim();

    const summary = `Sinistro ${claim.numsin || "#" + claim.nosnum} — ${CAMPOS_EDITAVEIS[campo]}: "${valorAtual}" → "${valorNovo}".`;

    return {
      summary,
      after: { claimId: claim.id, campo, valorAtual, valorNovo },
      apply() {
        ctx.saveRecord("corp_overrides", (current) => {
          const cur = current || {};
          const existing = cur[claim.id] || {};
          const campos = { ...(existing.campos || {}) };
          if (valorNovo === "") delete campos[campo]; else campos[campo] = valorNovo;
          return { ...cur, [claim.id]: { ...existing, campos } };
        });
      },
    };
  },
};

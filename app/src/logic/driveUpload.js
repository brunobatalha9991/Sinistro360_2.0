// Upload de anexos para o Google Drive — a pedido do usuário, SEM exigir
// login/autenticação Google de quem envia (inclusive usuários "consulta").
//
// Como funciona: um Google Apps Script publicado como Web App ("Executar
// como: Eu", "Quem tem acesso: Qualquer pessoa") roda com a permissão do
// Drive de quem publicou o script — o navegador do usuário só faz um POST
// comum pra essa URL, sem OAuth nenhum. Mesmo padrão de integração já usado
// pelo sistema para os formulários de Demandas (config.corp_form_endpoints,
// ver logic/demandaSync.js) — não é uma peça de infraestrutura nova, é o
// mesmo tipo de coisa que este projeto já faz. Código do Apps Script e
// passo a passo de publicação em docs/mesa-atendimento.md.
//
// Um único Apps Script/URL atende DUAS pastas-raiz separadas no Drive (a
// pedido do usuário: "não quero confundir as pastas") — qual delas usar é
// escolhido pelo campo `contexto`, nunca pelo usuário final.
export const CONTEXTO_MESA_ATENDIMENTO = "mesa_atendimento";
export const CONTEXTO_ANEXOS_PROCESSO = "processo";
// Foto de perfil no módulo Desempenho (a pedido do usuário) — reaproveita
// o mesmo endpoint/Apps Script, só numa pasta-contexto própria.
export const CONTEXTO_PERFIL_USUARIO = "perfil_usuario";

export function isDriveUploadConfigured(config) {
  return !!String((config && config.corp_drive_upload_endpoint) || "").trim();
}

export function sanitizarNomePasta(texto) {
  const limpo = String(texto || "").trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
  return limpo || "Sem nome";
}

function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = String(reader.result || "");
      const virgula = resultado.indexOf(",");
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

// Envia 1 arquivo pro Drive. `pasta` (opcional) agrupa os anexos numa
// subpasta dentro da pasta raiz correspondente a `contexto`. Devolve
// { nome, url, id } — `url` é o link de visualização do Drive (acesso
// "qualquer pessoa com o link", sem exigir login).
export async function uploadArquivoDrive({ endpoint, file, pasta, contexto }) {
  if (!endpoint) throw new Error("Upload de anexos não está configurado (ver Configurações).");
  const conteudoBase64 = await arquivoParaBase64(file);

  let resp;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS no Apps Script
      body: JSON.stringify({
        nomeArquivo: file.name, tipoArquivo: file.type || "application/octet-stream",
        conteudoBase64, pasta: pasta || "", contexto: contexto || CONTEXTO_MESA_ATENDIMENTO,
      }),
    });
  } catch {
    throw new Error("Falha de rede ao enviar o anexo. Verifique sua conexão.");
  }

  const texto = await resp.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new Error("Resposta inesperada do endpoint de upload — confira a URL configurada em Configurações."); }
  if (!resp.ok || dados.erro) throw new Error(dados.erro || `Falha no upload (HTTP ${resp.status}).`);
  return { nome: dados.nome || file.name, url: dados.url, id: dados.id };
}

// `url` (arquivo.getUrl() no Apps Script) é a página de visualização do
// Drive ("https://drive.google.com/file/d/ID/view") — funciona bem como
// link clicável (anexos), mas um <img src> não consegue carregar uma PÁGINA
// html como imagem (a pedido do usuário: a foto de perfil no Desempenho
// "não aparecia visivelmente" — era exatamente isso). Deriva o id do
// arquivo dessa URL e monta o link de thumbnail do Drive, que essa mesma
// serve como imagem de verdade. Sem casar o padrão, devolve a URL original
// (não faz pior do que já estava).
export function driveImagemEmbutivel(url) {
  const m = /\/file\/d\/([^/]+)/.exec(String(url || ""));
  if (!m) return url;
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w512`;
}

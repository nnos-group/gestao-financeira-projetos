import ccBase from "./centros-de-custo.json";

export interface LiderInfo {
  nome: string;
  email: string;
  areaPadrao?: string;
}

export const LIDERES_METADATA: Record<string, { email: string; areaPadrao: string }> = {
  "BEATRIZ PICORELLI": { email: "beatriz.picorelli@nnos.com.br", areaPadrao: "HRD - Human Resource Development" },
  "CAROLINE AMIEVA": { email: "caroline.amieva@nnos.com.br", areaPadrao: "Business Solutions" },
  "JEFFERSON SOUZA": { email: "jefferson.souza@nnos.com.br", areaPadrao: "Dealer Development" },
  "VINICIUS SOUZA": { email: "vinicius.souza@nnos.com.br", areaPadrao: "Business Solutions" },
  "FÁBIO CANASSA": { email: "fabio.canassa@nnos.com.br", areaPadrao: "Outsourcing Porsche" },
  "FABIO CANASSA": { email: "fabio.canassa@nnos.com.br", areaPadrao: "Outsourcing Porsche" },
  "JOICE LAGE": { email: "joice.lage@nnos.com.br", areaPadrao: "Educação" },
  "LEONARDO CAMPOS": { email: "leonardo.campos@nnos.com.br", areaPadrao: "Diretoria & Adm" },
  "IGOR PICORELLI": { email: "igor.picorelli@nnos.com.br", areaPadrao: "Adm e Controle" },
};

export function normalizarTextoLider(str?: string | null): string {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type StatusCoberturaLider = "INATIVA" | "VIGENTE" | "AGENDADA" | "EXPIRADA";

export function verificarStatusCoberturaLider(
  item?: {
    liderSubstituto?: string | null;
    coberturaInicio?: string | null;
    coberturaFim?: string | null;
  } | null,
  dataRefISO?: string
): StatusCoberturaLider {
  const substituto = String(item?.liderSubstituto || "").trim();
  if (!substituto || substituto === "-" || substituto === "—") {
    return "INATIVA";
  }

  const agora = new Date();
  const hojeISO =
    dataRefISO ||
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
      agora.getDate()
    ).padStart(2, "0")}`;

  const ini = String(item?.coberturaInicio || "").trim().slice(0, 10);
  const fim = String(item?.coberturaFim || "").trim().slice(0, 10);

  if (ini && /^\d{4}-\d{2}-\d{2}$/.test(ini) && hojeISO < ini) {
    return "AGENDADA";
  }
  if (fim && /^\d{4}-\d{2}-\d{2}$/.test(fim) && hojeISO > fim) {
    return "EXPIRADA";
  }
  return "VIGENTE";
}

function resolverLiderEfetivoCentroCusto(cc: any): string {
  if (!cc) return "";
  if (verificarStatusCoberturaLider(cc) === "VIGENTE" && cc.liderSubstituto) {
    return String(cc.liderSubstituto).trim();
  }
  return String(cc.liderProjeto || "").trim();
}

/**
 * Resolve com máxima precisão o Líder de Projeto responsável pela atividade/demanda.
 * NUNCA retorna gestao.projetos@nnos.com.br pois o endereço não existe.
 */
export function obterDadosLiderViagem(sol?: {
  projeto?: string;
  liderEmail?: string;
  liderNome?: string;
  aprovadoPor?: string;
  auditoria?: Array<{ perfilUsuario?: string; usuarioNome?: string }>;
}): LiderInfo {
  if (!sol) {
    return { nome: "Leonardo Campos", email: "leonardo.campos@nnos.com.br", areaPadrao: "Diretoria & Adm" };
  }

  // 1. Se a solicitação já possui liderEmail válido
  if (sol.liderEmail && sol.liderEmail.includes("@") && !sol.liderEmail.includes("gestao.projetos")) {
    return {
      nome: sol.liderNome || sol.aprovadoPor || "Líder de Projeto",
      email: sol.liderEmail,
    };
  }

  // 2. Tenta obter pelo histórico de auditoria (quem solicitou ou aprovou como LIDER)
  if (Array.isArray(sol.auditoria)) {
    const audLider = [...sol.auditoria].reverse().find(
      (a) =>
        (a.perfilUsuario === "LIDER" || a.perfilUsuario === "ADMIN") &&
        a.usuarioNome &&
        !a.usuarioNome.toLowerCase().includes("sistema") &&
        !a.usuarioNome.toLowerCase().includes("agência") &&
        !a.usuarioNome.toLowerCase().includes("agencia")
    );
    if (audLider?.usuarioNome) {
      const nomeNorm = normalizarTextoLider(audLider.usuarioNome);
      for (const [chaveLider, meta] of Object.entries(LIDERES_METADATA)) {
        if (nomeNorm.includes(normalizarTextoLider(chaveLider))) {
          return { nome: chaveLider, email: meta.email, areaPadrao: meta.areaPadrao };
        }
      }
    }
  }

  // 3. Tenta obter pelo campo aprovadoPor
  if (sol.aprovadoPor) {
    const nomeNorm = normalizarTextoLider(sol.aprovadoPor);
    for (const [chaveLider, meta] of Object.entries(LIDERES_METADATA)) {
      if (nomeNorm.includes(normalizarTextoLider(chaveLider))) {
        return { nome: chaveLider, email: meta.email, areaPadrao: meta.areaPadrao };
      }
    }
  }

  // 4. Mapeamento a partir do Projeto nos Centros de Custo
  const projetoBusca = normalizarTextoLider(sol.projeto);
  const centros: any[] = (ccBase as any)?.centrosDeCusto || [];

  if (projetoBusca) {
    // Busca exata pelo nome do projeto (considerando líder substituto caso esteja em cobertura vigente)
    const matchExato = centros.find((c) => normalizarTextoLider(c.projeto) === projetoBusca);
    const liderExato = resolverLiderEfetivoCentroCusto(matchExato);
    if (liderExato) {
      const nomeNorm = normalizarTextoLider(liderExato);
      const meta = LIDERES_METADATA[nomeNorm] || Object.entries(LIDERES_METADATA).find(([k]) => normalizarTextoLider(k) === nomeNorm)?.[1];
      if (meta?.email) {
        return { nome: liderExato, email: meta.email, areaPadrao: meta.areaPadrao };
      }
    }

    // Busca aproximada/parcial pelo projeto
    const matchParcial = centros.find((c) => {
      const pNorm = normalizarTextoLider(c.projeto);
      return pNorm && (projetoBusca.includes(pNorm) || pNorm.includes(projetoBusca));
    });
    const liderParcial = resolverLiderEfetivoCentroCusto(matchParcial);
    if (liderParcial) {
      const nomeNorm = normalizarTextoLider(liderParcial);
      const meta = LIDERES_METADATA[nomeNorm] || Object.entries(LIDERES_METADATA).find(([k]) => normalizarTextoLider(k) === nomeNorm)?.[1];
      if (meta?.email) {
        return { nome: liderParcial, email: meta.email, areaPadrao: meta.areaPadrao };
      }
    }
  }

  // 5. Fallback seguro e real: Leonardo Campos (Diretoria & Adm / Gestor Geral)
  return {
    nome: "Leonardo Campos",
    email: "leonardo.campos@nnos.com.br",
    areaPadrao: "Diretoria & Adm",
  };
}


import { supabaseAdmin } from "@/lib/supabase-server";
import ThemeToggle from "@/components/ThemeToggle";
import FloatingCardsList, { LancamentoItem } from "@/components/FloatingCardsList";
import NovaAtividadeBotao from "@/components/NovaAtividadeBotao";
import AnoSelector from "@/components/AnoSelector";
import { carregarSolicitacoesArquivo } from "@/lib/viagens-service";

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const brl = (val: number | null | undefined) =>
  val != null
    ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();

  // Buscar apenas os anos que possuem lançamentos de atividades
  const { data: compGeral } = await db
    .from("lancamentos")
    .select("competencia")
    .limit(3000);

  const anosDisponiveis = Array.from(
    new Set(
      (compGeral || [])
        .map((l) => (l.competencia ? Number(l.competencia.split("-")[0]) : null))
        .filter((a): a is number => typeof a === "number" && !isNaN(a) && a >= 2020)
    )
  ).sort((a, b) => a - b);

  if (anosDisponiveis.length === 0) {
    anosDisponiveis.push(2026);
  }

  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = dataAtual.getFullYear();

  const anoSelecionado = anosDisponiveis.includes(Number(sp.ano))
    ? Number(sp.ano)
    : anosDisponiveis.includes(anoAtual)
    ? anoAtual
    : anosDisponiveis.includes(2026)
    ? 2026
    : anosDisponiveis[0];

  const isTodosMeses = sp.mes === "todos";
  const mes = isTodosMeses ? 0 : Math.min(12, Math.max(1, Number(sp.mes) || mesAtual));

  const competencia = `${anoSelecionado}-${String(mes || 1).padStart(2, "0")}-01`;

  let lancamentosData: any[] = [];
  let error: any = null;
  if (isTodosMeses) {
    for (let from = 0; ; from += 1000) {
      const { data: chunk, error: chunkErr } = await db
        .from("lancamentos")
        .select(
          "id, competencia, atividade, modalidade, local, regiao, data_inicial, data_final, perfil, horas, faturar, repasse, custo_consultor, status, precisa_logistica, " +
            "projetos(id, nome, centros_custo(codigo, contrato, areas(nome), lideres(nome))), " +
            "consultores(id, nome, tipo), " +
            "viagens(id, agencia, custo_1, custo_2, custo_3, custo_4, custo_5, total, observacao_agencia), " +
            "notas_debito(id, destino, numero, valor)"
        )
        .gte("competencia", `${anoSelecionado}-01-01`)
        .lte("competencia", `${anoSelecionado}-12-31`)
        .range(from, from + 999);
      if (chunkErr) {
        error = chunkErr;
        break;
      }
      if (chunk && chunk.length > 0) lancamentosData.push(...chunk);
      if (!chunk || chunk.length < 1000) break;
    }
  } else {
    const { data: chunk, error: chunkErr } = await db
      .from("lancamentos")
      .select(
        "id, competencia, atividade, modalidade, local, regiao, data_inicial, data_final, perfil, horas, faturar, repasse, custo_consultor, status, precisa_logistica, " +
          "projetos(id, nome, centros_custo(codigo, contrato, areas(nome), lideres(nome))), " +
          "consultores(id, nome, tipo), " +
          "viagens(id, agencia, custo_1, custo_2, custo_3, custo_4, custo_5, total, observacao_agencia), " +
          "notas_debito(id, destino, numero, valor)"
      )
      .eq("competencia", competencia)
      .limit(2000);
    if (chunkErr) error = chunkErr;
    if (chunk) lancamentosData = chunk;
  }

  const [projetosRes, consultoresRes] = await Promise.all([
    db.from("projetos").select("id, nome, centros_custo(codigo, contrato)").order("nome"),
    db.from("consultores").select("id, nome, tipo").order("nome"),
  ]);

  const data = lancamentosData;

  const todosProjetos = (projetosRes.data ?? []).map((p: any) => ({
    id: p.id as string,
    nome: p.nome as string,
    centro_custo_codigo: (Array.isArray(p.centros_custo)
      ? p.centros_custo[0]?.codigo
      : p.centros_custo?.codigo) as string | null | undefined,
    centro_custo_contrato: (Array.isArray(p.centros_custo)
      ? p.centros_custo[0]?.contrato
      : p.centros_custo?.contrato) as string | null | undefined,
  }));
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const consultoresBase = require("@/lib/consultores-base.json") as {
    id: string;
    nome: string;
    nome_completo?: string;
    cpf?: string;
    rg?: string;
    perfil?: string;
    cidade_base?: string;
    aeroporto_preferencial?: string;
  }[];
  const baseMapId = new Map(consultoresBase.map((c) => [c.id, c]));
  const baseMapNome = new Map<string, typeof consultoresBase[0]>();
  consultoresBase.forEach((c) => {
    if (c.nome) baseMapNome.set(c.nome.trim().toUpperCase(), c);
    if (c.nome_completo) baseMapNome.set(c.nome_completo.trim().toUpperCase(), c);
  });

  const todosConsultores = (
    (consultoresRes.data ?? []) as { id: string; nome: string; tipo: string }[]
  ).map((c) => {
    const nomeNorm = (c.nome || "").trim().toUpperCase();
    const extra = baseMapId.get(c.id) || baseMapNome.get(nomeNorm);
    const doc = extra?.cpf || extra?.rg || "";
    const origemPref = extra?.aeroporto_preferencial || extra?.cidade_base || "";
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      nome_completo: extra?.nome_completo || c.nome,
      documento: doc,
      cpf: extra?.cpf || "",
      rg: extra?.rg || "",
      perfil: extra?.perfil || "SÊNIOR",
      cidade_base: extra?.cidade_base || "",
      aeroporto_preferencial: extra?.aeroporto_preferencial || "",
      origem: origemPref,
    };
  });

  // Faturas de Logística (Notas de Débito) da base oficial de Faturamento
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const faturamentoBase = require("@/lib/faturamento-base.json") as any[];
  const faturasLogistica = (faturamentoBase || [])
    .filter((f) => {
      const p = (f.perfil || "").toUpperCase();
      return p.includes("LOGÍSTICA") || p.includes("LOGISTICA");
    })
    .map((f) => ({
      numeroNota: String(f.numeroNota || "").trim(),
      projeto: String(f.projeto || "").trim().toUpperCase(),
      valor: Number(f.valor) || 0,
      realizado: f.realizado,
      status: f.status,
    }));


  const itens = ((data ?? []) as unknown as LancamentoItem[]).filter(
    (l) =>
      Boolean(l.atividade) ||
      Boolean(l.status) ||
      (l.faturar ?? 0) !== 0 ||
      (l.repasse ?? 0) !== 0 ||
      (l.custo_consultor ?? 0) !== 0 ||
      (Array.isArray(l.viagens) ? l.viagens[0]?.total : l.viagens?.total ?? 0) > 0
  );

  // Organizar painel por Projeto em ordem alfabética (A-Z), com ADM E CONTROLE sempre por último
  itens.sort((a, b) => {
    const nomeA = (a.projetos?.nome || "").trim().toUpperCase();
    const nomeB = (b.projetos?.nome || "").trim().toUpperCase();

    const isAdmA = nomeA.includes("ADM") || nomeA.includes("ADMINISTRA");
    const isAdmB = nomeB.includes("ADM") || nomeB.includes("ADMINISTRA");

    if (isAdmA && !isAdmB) return 1;
    if (!isAdmA && isAdmB) return -1;

    const comp = nomeA.localeCompare(nomeB, "pt-BR");
    if (comp !== 0) return comp;

    const dataA = a.data_inicial || "";
    const dataB = b.data_inicial || "";
    if (dataA !== dataB) return dataA.localeCompare(dataB);

    return (a.atividade || "").localeCompare(b.atividade || "", "pt-BR");
  });

  // Cálculos dos 5 Indicadores Oficiais
  const cancelados = itens.filter((it) =>
    (it.status || "").toUpperCase().includes("CANCEL")
  );
  const totalCanceladosQtd = cancelados.length;
  const totalCanceladoValor = cancelados.reduce(
    (s, it) => s + (it.faturar ?? 0),
    0
  );

  // Regra de Contrato NNÓS: atividades canceladas fora do prazo contratual têm faturamento cobrado e compõem o Total Faturar.
  // Quando o cancelamento é dentro do prazo, o campo faturamento é deixado em branco (zero).
  const totalFaturar = itens.reduce((s, it) => s + (it.faturar ?? 0), 0);
  const totalConsultores = itens.reduce(
    (s, it) => s + (it.custo_consultor ?? 0),
    0
  );
  const totalRepassar = itens.reduce((s, it) => s + (it.repasse ?? 0), 0);
  const totalLogistica = itens.reduce((s, it) => {
    const v = Array.isArray(it.viagens) ? it.viagens[0] : it.viagens;
    return s + (v?.total ?? 0);
  }, 0);

  return (
    <div className="app-layout">
      {/* Sidebar Corporativa à Esquerda */}
      <aside className="sidebar">
        <div className="flex flex-col">
          <div className="sidebar-brand">
            <img
              src="/logo-coruja.png"
              alt="Logo Coruja NNÓS"
              className="sidebar-brand-img"
            />
            <div className="sidebar-brand-text">
              <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
                GESTÃO<br />FINANCEIRA & PROJETOS
              </h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <a href="/projetos" className="nav-item active">
              <span className="material-symbols-outlined">assignment</span>
              <span>Projetos & Atividades</span>
            </a>
            <a href="/medicao" className="nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              <span>BM - Boletim de Medição</span>
            </a>
            <a href="/viagens" className="nav-item">
              <span className="material-symbols-outlined">flight</span>
              <span>Viagens & Logística</span>
            </a>
            <a href="/centro-de-custo" className="nav-item">
              <span className="material-symbols-outlined">account_tree</span>
              <span>Centro de Custo</span>
            </a>
            <a href="/tabela-precos" className="nav-item">
              <span className="material-symbols-outlined">request_quote</span>
              <span>Tabela de Preços</span>
            </a>
            <a href="/pessoas" className="nav-item">
              <span className="material-symbols-outlined">group</span>
              <span>Pessoas</span>
            </a>
            <a href="/faturamento" className="nav-item">
              <span className="material-symbols-outlined">receipt</span>
              <span>Faturamento</span>
            </a>
            <a href="/pagamentos" className="nav-item">
              <span className="material-symbols-outlined">payments</span>
              <span>Pagamentos</span>
            </a>
            <a href="/relatorios" className="nav-item">
              <span className="material-symbols-outlined">monitoring</span>
              <span>Relatórios</span>
            </a>
            <a href="/consultor" className="nav-item"><span className="material-symbols-outlined">support_agent</span><span>Consultor</span></a>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-info" style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>
              Sistema Operacional NNÓS
            </span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
              Módulo de Projetos & Atividades
            </span>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="main-wrapper">
        {/* Top Header Fixo */}
        <header className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="font-label-sm"
              style={{
                color: "var(--on-surface-variant)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Portal Corporativo · NNÓS
            </span>
            <span style={{ color: "var(--outline-variant)" }}>/</span>
            <span
              className="font-label-sm"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              Projetos & Atividades
            </span>
          </div>

          <div className="header-actions">
            <ThemeToggle />

            <button
              type="button"
              className="btn-header-menu"
              title="Menu do Sistema"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                grid_view
              </span>
              <span>Menu</span>
            </button>

            <button
              type="button"
              className="btn-header-logout"
              title="Encerrar sessão"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                logout
              </span>
              <span>Sair</span>
            </button>

            <div className="header-user">
              <div className="user-details">
                <strong>Coordenação Central</strong>
                <span>Planejamento & Finanças</span>
              </div>
              <div className="user-avatar">
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  person
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da Página */}
        <main className="content-container">
          {process.env.NODE_ENV !== "production" && process.env.AUTH_DISABLED === "true" && (
            <div className="dev-banner">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                info
              </span>
              <span>
                Modo de desenvolvimento ativado (AUTH_DISABLED=true) — credenciais e RLS pré-configurados.
              </span>
            </div>
          )}

          {error && (
            <div style={{ padding: "16px", borderRadius: "10px", background: "#fee2e2", color: "#991b1b" }}>
              Erro ao carregar dados do Supabase: {error.message}
            </div>
          )}

          {/* Contexto Operacional & Ações */}
          <div className="page-title-strip">
            <div>
              <h1 className="page-title">
                <span>Gestão de Projetos</span>
                <span className="badge-cycle">
                  Ciclo {anoSelecionado} · {isTodosMeses ? "Ano Todo (Consolidado)" : MESES_NOMES[mes - 1]}
                </span>
              </h1>
            </div>

            <div className="action-buttons">
              <button type="button" className="btn-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  download
                </span>
                <span>Exportar XLS</span>
              </button>

              <NovaAtividadeBotao />
            </div>
          </div>

          {/* Pilha de Linhas Flutuando (Floating Cards com Painel Congelado Sticky) */}
          {(() => {
            const solicitacoesViagem = carregarSolicitacoesArquivo();
            return (
              <FloatingCardsList
                itens={itens}
                competencia={competencia}
                todosProjetos={todosProjetos}
                todosConsultores={todosConsultores}
                faturasLogistica={faturasLogistica}
                solicitacoesViagem={solicitacoesViagem}
                headerTopContent={
              <>
                {/* 5 KPI Metric Floating Cards */}
                <section className="kpis-grid" aria-label="Indicadores Operacionais">
                  {/* 1. TOTAL FATURAR */}
                  <div className="kpi-card">
                    <div className="kpi-content">
                      <span className="kpi-label">TOTAL FATURAR</span>
                      <div className="kpi-value-row">
                        <span className="kpi-value medium">{brl(totalFaturar)}</span>
                      </div>
                    </div>
                    <div className="kpi-icon-box success-bg">
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        payments
                      </span>
                    </div>
                  </div>

                  {/* 2. TOTAL CONSULTORES */}
                  <div className="kpi-card">
                    <div className="kpi-content">
                      <span className="kpi-label">TOTAL CONSULTORES</span>
                      <div className="kpi-value-row">
                        <span className="kpi-value medium">{brl(totalConsultores)}</span>
                      </div>
                    </div>
                    <div className="kpi-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        badge
                      </span>
                    </div>
                  </div>

                  {/* 3. TOTAL LOGÍSTICA */}
                  <div className="kpi-card">
                    <div className="kpi-content">
                      <span className="kpi-label">TOTAL LOGÍSTICA</span>
                      <div className="kpi-value-row">
                        <span className="kpi-value medium">{brl(totalLogistica)}</span>
                      </div>
                    </div>
                    <div className="kpi-icon-box secondary-bg">
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        flight_takeoff
                      </span>
                    </div>
                  </div>

                  {/* 4. TOTAL REPASSAR */}
                  <div className="kpi-card">
                    <div className="kpi-content">
                      <span className="kpi-label">TOTAL REPASSAR</span>
                      <div className="kpi-value-row">
                        <span className="kpi-value medium">{brl(totalRepassar)}</span>
                      </div>
                    </div>
                    <div className="kpi-icon-box tertiary-bg">
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        currency_exchange
                      </span>
                    </div>
                  </div>

                  {/* 5. TOTAL CANCELADO */}
                  <div className="kpi-card">
                    <div className="kpi-content">
                      <span className="kpi-label">TOTAL CANCELADO</span>
                      <div className="kpi-value-row">
                        <span className="kpi-value medium" style={{ color: "var(--error, #b91c1c)" }}>
                          {totalCanceladoValor > 0 ? brl(totalCanceladoValor) : `${totalCanceladosQtd} turmas`}
                        </span>
                        {totalCanceladoValor > 0 && (
                          <span className="kpi-subtext" style={{ color: "#b91c1c" }}>
                            {totalCanceladosQtd} turmas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="kpi-icon-box cancel-bg">
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        event_busy
                      </span>
                    </div>
                  </div>
                </section>

                {/* Faixa de Navegação por Competência Mensal */}
                <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>
                      calendar_month
                    </span>
                    <span className="month-label" style={{ fontWeight: 700, margin: 0 }}>
                      Competência:
                    </span>
                    <AnoSelector
                      anosDisponiveis={anosDisponiveis}
                      anoAtual={anoSelecionado}
                      mesAtual={mes}
                    />
                  </div>
                  <div style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    <a
                      href={`/projetos?ano=${anoSelecionado}&mes=todos`}
                      className={`month-chip ${isTodosMeses ? "active" : ""}`}
                    >
                      Todos
                    </a>
                    {MESES.map((nome, idx) => {
                      const numMes = idx + 1;
                      const ativo = !isTodosMeses && numMes === mes;
                      return (
                        <a
                          key={nome}
                          href={ativo ? `/projetos?ano=${anoSelecionado}&mes=todos` : `/projetos?ano=${anoSelecionado}&mes=${numMes}`}
                          className={`month-chip ${ativo ? "active" : ""}`}
                        >
                          {nome}
                        </a>
                      );
                    })}
                  </div>
                </nav>
              </>
            }
          />
        );
      })()}
    </main>
      </div>
    </div>
  );
}

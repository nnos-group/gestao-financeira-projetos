import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import centrosData from "@/lib/centros-de-custo.json";
import faturamentoBase from "@/lib/faturamento-base.json";
import pagamentosBase from "@/lib/pagamentos-base.json";
import { sincronizarSolicitacoesIniciais } from "@/lib/viagens-service";

function normalizar(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const LIDERES_OFICIAIS = [
  { id: "BEATRIZ PICORELLI", nome: "Beatriz Picorelli", email: "beatriz.picorelli@nnos.com.br", areaPrincipal: "HRD - Human Resource Development" },
  { id: "CAROLINE AMIEVA", nome: "Caroline Amieva", email: "caroline.amieva@nnos.com.br", areaPrincipal: "Business Solutions & Outsourcing" },
  { id: "JEFFERSON SOUZA", nome: "Jefferson Souza", email: "jefferson.souza@nnos.com.br", areaPrincipal: "Dealer Development" },
  { id: "LEONARDO CAMPOS", nome: "Leonardo Campos", email: "leonardo.campos@nnos.com.br", areaPrincipal: "Diretoria, Adm & Controle" },
  { id: "VINICIUS SOUZA", nome: "Vinicius Souza", email: "vinicius.souza@nnos.com.br", areaPrincipal: "Business Solutions" },
  { id: "FABIO CANASSA", nome: "Fábio Canassa", email: "fabio.canassa@nnos.com.br", areaPrincipal: "Outsourcing Porsche" },
  { id: "JOICE LAGE", nome: "Joice Lage", email: "joice.lage@nnos.com.br", areaPrincipal: "Educação Corporativa" },
  { id: "IGOR PICORELLI", nome: "Igor Picorelli", email: "igor.picorelli@nnos.com.br", areaPrincipal: "Operações & Controle" },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const liderParam = normalizar(searchParams.get("lider") || "BEATRIZ PICORELLI");
    const mesParam = searchParams.get("mes") || "TODOS"; // ex: "OUTUBRO", "SETEMBRO", "TODOS"

    const todosCentros = (centrosData as any).centrosDeCusto || [];

    // Mapa projeto -> centro de custo e líder
    const mapaPorProjeto = new Map<string, any>();
    const mapaPorCodigo = new Map<string, any>();

    for (const cc of todosCentros) {
      const projNorm = normalizar(cc.projeto);
      const codNorm = String(cc.centroDeCusto || "").trim();
      const liderNorm = normalizar(cc.liderProjeto);
      const item = {
        ...cc,
        liderNorm,
      };
      if (projNorm) mapaPorProjeto.set(projNorm, item);
      if (codNorm) mapaPorCodigo.set(codNorm, item);
    }

    const pertenceAoLider = (projetoNome?: string, centroCodigo?: string, liderDireto?: string) => {
      if (liderParam === "TODOS") return true;
      if (liderDireto && normalizar(liderDireto).includes(liderParam)) return true;

      const cod = String(centroCodigo || "").trim();
      if (cod && mapaPorCodigo.has(cod)) {
        if (mapaPorCodigo.get(cod).liderNorm === liderParam) return true;
      }

      const pNorm = normalizar(projetoNome || "");
      if (pNorm && mapaPorProjeto.has(pNorm)) {
        if (mapaPorProjeto.get(pNorm).liderNorm === liderParam) return true;
      }
      return false;
    };

    // 1. Centros de Custo / Projetos da Carteira do Líder
    const centrosLider = todosCentros.filter((cc: any) =>
      liderParam === "TODOS" ? true : normalizar(cc.liderProjeto) === liderParam
    );

    // 2. Carregar Solicitações de Viagem (2026)
    let todasViagens: any[] = [];
    try {
      todasViagens = await sincronizarSolicitacoesIniciais("2026");
    } catch {
      const vPath = path.join(process.cwd(), "src/lib/viagens-solicitacoes-base.json");
      if (fs.existsSync(vPath)) {
        todasViagens = JSON.parse(fs.readFileSync(vPath, "utf-8"));
      }
    }

    const MESES_NUM_MAP: Record<string, string> = {
      JANEIRO: "01",
      FEVEREIRO: "02",
      MARCO: "03",
      "MARÇO": "03",
      ABRIL: "04",
      MAIO: "05",
      JUNHO: "06",
      JULHO: "07",
      AGOSTO: "08",
      SETEMBRO: "09",
      OUTUBRO: "10",
      NOVEMBRO: "11",
      DEZEMBRO: "12",
    };

    const mesNumFiltro = mesParam !== "TODOS" ? MESES_NUM_MAP[normalizar(mesParam)] : null;

    const viagensCarteira = todasViagens
      .filter((v: any) => {
        if (!pertenceAoLider(v.projeto, v.centroCusto)) return false;
        if (mesNumFiltro && v.dataInicial) {
          return String(v.dataInicial).startsWith(`2026-${mesNumFiltro}`);
        }
        return true;
      })
      .sort((a: any, b: any) => {
        // Priorizar COTACAO_ENVIADA no topo para ação imediata do Líder
        const peso = (st: string) => {
          if (st === "COTACAO_ENVIADA") return 0;
          if (st === "AGUARDANDO_COTACAO") return 1;
          if (st === "APROVADO_LIDER") return 2;
          if (st === "VOUCHERS_ENVIADOS") return 3;
          return 4;
        };
        return peso(a.status) - peso(b.status);
      });

    // 3. Carregar BMs (bms-2026.json)
    let todosBms: any[] = [];
    const bmsPath = path.join(process.cwd(), "src/lib/bms-2026.json");
    if (fs.existsSync(bmsPath)) {
      try {
        const rawBms = JSON.parse(fs.readFileSync(bmsPath, "utf-8"));
        const vistos = new Set<string>();
        todosBms = rawBms.filter((b: any) => {
          const cod = String(b.codigo);
          if (vistos.has(cod)) return false;
          vistos.add(cod);
          return true;
        });
      } catch {}
    }

    const bmsCarteira = todosBms
      .filter((bm: any) => {
        if (mesParam !== "TODOS") {
          const mesBmNorm = normalizar(bm.mesReferencia || "");
          if (!mesBmNorm.includes(normalizar(mesParam))) return false;
        }
        if (liderParam === "TODOS") return true;
        const temAtivDoLider = (bm.atividades || []).some((a: any) =>
          pertenceAoLider(a.projeto, a.centroCusto, a.liderProjeto)
        );
        return temAtivDoLider || pertenceAoLider(undefined, undefined, bm.liderProjetoNome);
      })
      .map((bm: any) => {
        const atividadesDoLider =
          liderParam === "TODOS"
            ? bm.atividades || []
            : (bm.atividades || []).filter((a: any) =>
                pertenceAoLider(a.projeto, a.centroCusto, a.liderProjeto)
              );
        const listaAtiv = atividadesDoLider.length > 0 ? atividadesDoLider : bm.atividades || [];
        const valorCarteira = listaAtiv.reduce((acc: number, a: any) => acc + Number(a.valorTotal || 0), 0);
        const horasCarteira = listaAtiv.reduce((acc: number, a: any) => acc + Number(a.horas || 0), 0);
        return {
          ...bm,
          atividadesCarteira: listaAtiv,
          valorCarteira: valorCarteira || bm.valorTotal || 0,
          horasCarteira: horasCarteira || bm.totalHoras || 0,
        };
      });

    // 4. Faturamento & Pagamentos da Carteira
    const faturamentoFiltrado = (faturamentoBase as any[]).filter((f) => {
      if (!pertenceAoLider(f.projeto, f.centroCusto)) return false;
      if (mesParam !== "TODOS") {
        return normalizar(f.realizado || f.faturado || "").includes(normalizar(mesParam));
      }
      return true;
    });

    const pagamentosFiltrados = (pagamentosBase as any[]).filter((p) => {
      if (!pertenceAoLider(p.projeto, p.centroCusto)) return false;
      if (mesParam !== "TODOS") {
        return normalizar(p.realizado || "").includes(normalizar(mesParam));
      }
      return true;
    });

    // 5. Enriquecer Projetos da Carteira
    const projetosCarteira = centrosLider.map((cc: any) => {
      const pNorm = normalizar(cc.projeto);
      const cod = String(cc.centroDeCusto || "").trim();

      const viagensProj = viagensCarteira.filter(
        (v: any) => normalizar(v.projeto) === pNorm || String(v.centroCusto || "").trim() === cod
      );
      const bmsProj = bmsCarteira.filter((b: any) =>
        (b.atividadesCarteira || []).some(
          (a: any) => normalizar(a.projeto) === pNorm || String(a.centroCusto || "").trim() === cod
        )
      );
      const fatTotal = faturamentoFiltrado
        .filter((f) => normalizar(f.projeto) === pNorm || String(f.centroCusto || "").trim() === cod)
        .reduce((acc, f) => acc + Number(f.valor || 0), 0);
      const pagTotal = pagamentosFiltrados
        .filter((p) => normalizar(p.projeto) === pNorm || String(p.centroCusto || "").trim() === cod)
        .reduce((acc, p) => acc + Number(p.valor || 0), 0);

      return {
        centroDeCusto: cc.centroDeCusto,
        projeto: cc.projeto,
        contrato: cc.contrato,
        area: cc.area,
        liderProjeto: cc.liderProjeto,
        qtdViagens: viagensProj.length,
        viagensPendentes: viagensProj.filter((v: any) => v.status === "COTACAO_ENVIADA").length,
        qtdBms: bmsProj.length,
        faturamento: fatTotal,
        custosDiretos: pagTotal,
        resultado: fatTotal - pagTotal,
      };
    });

    const faturamentoTotal = faturamentoFiltrado.reduce((acc, f) => acc + Number(f.valor || 0), 0);
    const pagamentosTotal = pagamentosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const viagensPendentesAprovacao = viagensCarteira.filter((v: any) => v.status === "COTACAO_ENVIADA").length;
    const custoViagensAprovado = viagensCarteira.reduce(
      (acc: number, v: any) => acc + Number(v.totalContratado || v.totalAprovado || v.totalCotado || 0),
      0
    );
    const valorBmsCarteira = bmsCarteira.reduce((acc: number, b: any) => acc + Number(b.valorCarteira || 0), 0);
    const horasBmsCarteira = bmsCarteira.reduce((acc: number, b: any) => acc + Number(b.horasCarteira || 0), 0);

    const liderInfo =
      liderParam === "TODOS"
        ? { id: "TODOS", nome: "Todos os Líderes (Visão Consolidada)", email: "projetos@nnos.com.br", areaPrincipal: "Todas as Unidades de Negócio" }
        : LIDERES_OFICIAIS.find((l) => normalizar(l.id) === liderParam) || {
            id: liderParam,
            nome: liderParam,
            email: "projetos@nnos.com.br",
            areaPrincipal: "Gestão de Projetos",
          };

    return NextResponse.json({
      liderAtivo: liderInfo,
      lideresDisponiveis: [
        { id: "TODOS", nome: "Todos os Líderes (Visão Consolidada)", email: "projetos@nnos.com.br", areaPrincipal: "Todas as Unidades" },
        ...LIDERES_OFICIAIS,
      ],
      kpis: {
        totalProjetos: projetosCarteira.length,
        totalViagens: viagensCarteira.length,
        viagensPendentesAprovacao,
        custoViagensAprovado,
        totalBms: bmsCarteira.length,
        valorBmsCarteira,
        horasBmsCarteira,
        faturamentoCarteira: faturamentoTotal,
        pagamentosCarteira: pagamentosTotal,
        resultadoCarteira: faturamentoTotal - pagamentosTotal,
      },
      projetosCarteira,
      viagens: viagensCarteira,
      bms: bmsCarteira,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


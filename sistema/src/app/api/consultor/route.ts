import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { PESSOAS_INICIAIS, PessoaItem } from "@/lib/pessoas-data";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const consultorId = searchParams.get("id");
    const consultorNome = searchParams.get("nome");

    const db = supabaseAdmin();

    // 1. Obter lista completa de pessoas para o seletor
    let pessoas: PessoaItem[] = PESSOAS_INICIAIS;
    try {
      const { data: dbConsultores } = await db.from("consultores").select("*").order("nome");
      if (dbConsultores && dbConsultores.length > 0) {
        // Enriquecer com a base local
        const baseMap = new Map(pessoas.map((p) => [p.nome.toUpperCase().trim(), p]));
        pessoas = dbConsultores.map((c) => {
          const extra = baseMap.get((c.nome || "").toUpperCase().trim());
          return {
            id: c.id,
            nome: c.nome,
            nome_completo: extra?.nome_completo || c.nome,
            tipo: (extra?.tipo || c.tipo || "parceiro") as any,
            perfil: extra?.perfil || "SÊNIOR",
            email: extra?.email || `${c.nome.toLowerCase().replace(/\s+/g, ".")}@nnos.com.br`,
            telefone: extra?.telefone || "",
            cpf: extra?.cpf || "",
            rg: extra?.rg || "",
            cidade_base: extra?.cidade_base || "Belo Horizonte / MG",
            aeroporto_preferencial: extra?.aeroporto_preferencial || "CNF (Confins / BH)",
            razao_social: extra?.razao_social || "",
            cnpj: extra?.cnpj || "",
            banco: extra?.banco || "",
            agencia: extra?.agencia || "",
            conta: extra?.conta || "",
            pix: extra?.pix || "",
            contrato_ativo: extra?.contrato_ativo || "SÓCIO / PARCEIRO",
            valor_hora_padrao: extra?.valor_hora_padrao || 0,
          };
        });
      }
    } catch (e) {
      console.warn("Aviso ao buscar consultores no banco:", e);
    }

    // Se não passou nenhum consultor, seleciona o primeiro por padrão (ex: Marcelo Lara ou Leonardo Campos)
    let consultorAtivo = pessoas.find(
      (p) =>
        (consultorId && p.id === consultorId) ||
        (consultorNome && p.nome.toUpperCase().trim() === consultorNome.toUpperCase().trim())
    );

    if (!consultorAtivo && pessoas.length > 0) {
      // Priorizar MARCELO LARA DA SILVA ou LEONARDO CAMPOS para testes imediatos
      consultorAtivo =
        pessoas.find((p) => p.nome.toUpperCase().includes("MARCELO LARA")) ||
        pessoas.find((p) => p.nome.toUpperCase().includes("LEONARDO CAMPOS")) ||
        pessoas[0];
    }

    if (!consultorAtivo) {
      return NextResponse.json({ error: "Nenhum consultor encontrado" }, { status: 404 });
    }

    const nomeBusca = consultorAtivo.nome.toUpperCase().trim();
    const idBusca = consultorAtivo.id;

    // 2. Buscar Lançamentos / Atividades do Consultor
    // Segurança: filtro aplicado no banco (consultor_id) e campos FATURAR/REPASSE NÃO são selecionados,
    // garantindo que o consultor nunca receba valores de faturamento ao cliente.
    let lancamentos: any[] = [];
    try {
      const selectCampos =
        "id, competencia, atividade, modalidade, local, regiao, data_inicial, data_final, perfil, horas, custo_consultor, status, precisa_logistica, " +
        "projetos(id, nome, centros_custo(codigo, contrato, areas(nome), lideres(nome))), " +
        "consultores(id, nome, tipo), " +
        "viagens(id, custo_1, custo_2, custo_3, custo_4, custo_5, total, observacao_agencia, status)";

      for (let from = 0; ; from += 1000) {
        const { data: chunk, error } = await db
          .from("lancamentos")
          .select(selectCampos)
          .eq("consultor_id", idBusca)
          .order("data_inicial", { ascending: true })
          .range(from, from + 999);
        if (error) {
          console.warn("Aviso ao buscar lancamentos:", error.message);
          break;
        }
        if (chunk?.length) lancamentos.push(...(chunk as any[]));
        if (!chunk || chunk.length < 1000) break;
      }
    } catch (e) {
      console.warn("Aviso ao buscar lancamentos:", e);
    }

    const nomeConfere = (outro: string) => {
      const n = (outro || "").toUpperCase().trim();
      return !!n && (n === nomeBusca || n.includes(nomeBusca) || nomeBusca.includes(n));
    };

    // 3. Buscar Viagens do Consultor
    let viagens: any[] = [];
    try {
      const vPath = path.resolve(process.cwd(), "src/lib/viagens-solicitacoes-base.json");
      if (fs.existsSync(vPath)) {
        const vList = JSON.parse(fs.readFileSync(vPath, "utf-8"));
        viagens = vList.filter((v: any) => nomeConfere(v.consultor));
      }
    } catch (e) {
      console.warn("Aviso ao buscar viagens:", e);
    }

    // 4. Buscar BMs do Consultor
    let bms: any[] = [];
    try {
      // Tentar pegar do Supabase primeiro
      const { data: listaCloud } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "bms_lista_completa")
        .maybeSingle();

      let bmsBase: any[] = [];
      if (listaCloud?.descricao) {
        try {
          bmsBase = JSON.parse(listaCloud.descricao);
        } catch {}
      }

      if (bmsBase.length === 0) {
        const bmsPath = path.resolve(process.cwd(), "src/lib/bms-2026.json");
        if (fs.existsSync(bmsPath)) {
          bmsBase = JSON.parse(fs.readFileSync(bmsPath, "utf-8"));
        }
      }

      // Mesclar status de bms_assinaturas_status
      const { data: statusCloud } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "bms_assinaturas_status")
        .maybeSingle();

      let mapaStatus: Record<string, any> = {};
      if (statusCloud?.descricao) {
        try {
          mapaStatus = JSON.parse(statusCloud.descricao);
        } catch {}
      }

      bms = bmsBase
        .map((bm: any) => {
          const cod = String(bm.codigo);
          if (mapaStatus[cod]) {
            return {
              ...bm,
              status: mapaStatus[cod].status || bm.status,
              zohoRequestId: mapaStatus[cod].zohoRequestId || bm.zohoRequestId,
              zohoDocumentId: mapaStatus[cod].zohoDocumentId || bm.zohoDocumentId,
              logs: mapaStatus[cod].logs || bm.logs,
            };
          }
          return bm;
        })
        .filter((bm: any) => nomeConfere(bm.consultorNome));
    } catch (e) {
      console.warn("Aviso ao buscar BMs:", e);
    }

    // 5. Projetos Únicos em que atua
    const projetosMap = new Map<string, any>();
    lancamentos.forEach((l) => {
      if (l.projetos?.id) {
        if (!projetosMap.has(l.projetos.id)) {
          projetosMap.set(l.projetos.id, {
            id: l.projetos.id,
            nome: l.projetos.nome,
            centroCusto: l.projetos.centros_custo?.codigo || "N/A",
            contrato: l.projetos.centros_custo?.contrato || "Geral",
            area: l.projetos.centros_custo?.areas?.nome || "Operações",
            lider: l.projetos.centros_custo?.lideres?.nome || "Coordenação Geral",
            totalHoras: 0,
            atividadesQtd: 0,
          });
        }
        const p = projetosMap.get(l.projetos.id);
        p.totalHoras += Number(l.horas || 0);
        p.atividadesQtd += 1;
      }
    });

    const projetos = Array.from(projetosMap.values());

    // 6. Indicadores do Consultor
    const totalHoras = lancamentos.reduce((acc, l) => acc + Number(l.horas || 0), 0);
    const totalRepasse = lancamentos
      .filter((l) => !(l.status || "").toUpperCase().includes("CANCEL"))
      .reduce((acc, l) => acc + Number(l.custo_consultor || 0), 0);
    const bmsPendentes = bms.filter((b) => !String(b.status || "").includes("Aprovado")).length;
    const viagensConfirmadas = viagens.filter((v) => !v.status?.toLowerCase().includes("cancel")).length;

    return NextResponse.json({
      consultorAtivo,
      todasPessoas: pessoas.map((p) => ({
        id: p.id,
        nome: p.nome,
        nome_completo: p.nome_completo,
        perfil: p.perfil,
        tipo: p.tipo,
        email: p.email,
      })),
      kpis: {
        totalHoras,
        totalRepasse,
        totalProjetos: projetos.length,
        totalViagens: viagensConfirmadas,
        totalBms: bms.length,
        bmsPendentes,
      },
      lancamentos,
      projetos,
      viagens,
      bms,
    });
  } catch (err: any) {
    console.error("Erro na API /api/consultor:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

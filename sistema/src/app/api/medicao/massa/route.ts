import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "src/lib/bms-2026.json");
const CHAVE_CLOUD_BMS = "bms_lista_completa";
const CHAVE_CLOUD_PESSOAS = "pessoas_base_completa";

const LIDERES_EMAILS_PADRAO: Record<string, string> = {
  "BEATRIZ PICORELLI": "beatriz.picorelli@nnos.com.br",
  "CAROLINE AMIEVA": "caroline.amieva@nnos.com.br",
  "FABIO CANASSA": "fabio.canassa@nnos.com.br",
  "JEFFERSON SOUZA": "jefferson.souza@nnos.com.br",
  "JOICE LAGE": "joice.lage@nnos.com.br",
  "LEONARDO CAMPOS": "leonardo.campos@nnos.com.br",
  "VINICIUS SOUZA": "vinicius.souza@nnos.com.br",
  "IGOR PICORELLI": "igor.picorelli@nnos.com.br",
};

function resolverEmailLider(nome: string): string {
  const n = (nome || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const [chave, email] of Object.entries(LIDERES_EMAILS_PADRAO)) {
    const k = chave.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (n.includes(k) || k.includes(n)) return email;
  }
  return "beatriz.picorelli@nnos.com.br";
}

function lerBms(): any[] {
  try {
    if (fs.existsSync(FILE_PATH)) {
      return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get("ano") || "2026";
    const mesNum = Number(searchParams.get("mes")) || 9;
    const tipoMedicao = searchParams.get("tipoMedicao") || "1ª Quinzena";
    const dataCorteStr = searchParams.get("dataCorte") || `20/${String(mesNum).padStart(2, "0")}/${ano}`;

    const db = supabaseAdmin();

    // 1. Carregar lista de BMs para calcular próximo código e verificar BMs já gerados
    let bmsLista = lerBms();
    try {
      const { data: cloudBms } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", CHAVE_CLOUD_BMS)
        .maybeSingle();
      if (cloudBms?.descricao) {
        const parsed = JSON.parse(cloudBms.descricao);
        if (Array.isArray(parsed) && parsed.length > 0) bmsLista = parsed;
      }
    } catch {}

    const codigosNum = bmsLista.map((b: any) => parseInt(b.codigo, 10)).filter((n: number) => !isNaN(n));
    const proximoCodigoNum = codigosNum.length > 0 ? Math.max(...codigosNum, 907) + 1 : 908;

    // 2. Carregar lista de Pessoas da base cadastral
    let pessoasLista: any[] = [];
    try {
      const { data: cloudPessoas } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", CHAVE_CLOUD_PESSOAS)
        .maybeSingle();
      if (cloudPessoas?.descricao) {
        const parsed = JSON.parse(cloudPessoas.descricao);
        if (Array.isArray(parsed) && parsed.length > 0) pessoasLista = parsed;
      }
    } catch {}

    if (pessoasLista.length === 0) {
      try {
        const arqPessoas = path.join(process.cwd(), "src/lib/consultores-base.json");
        if (fs.existsSync(arqPessoas)) {
          pessoasLista = JSON.parse(fs.readFileSync(arqPessoas, "utf-8"));
        }
      } catch {}
    }

    // 3. Buscar todas as atividades da competência no Supabase
    const compAlvo = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
    const { data: lancsCompetencia, error: errLancs } = await db
      .from("lancamentos")
      .select("id, competencia, atividade, horas, custo_consultor, data_inicial, data_final, status, consultores(id, nome), projetos(nome, centros_custo(codigo, lideres(id, nome)))")
      .eq("competencia", compAlvo);

    if (errLancs) {
      console.error("[/api/medicao/massa] Erro ao buscar lançamentos:", errLancs);
      return NextResponse.json({ ok: false, error: errLancs.message }, { status: 500 });
    }

    // Normalizador de texto para matching
    const norm = (str: string) =>
      (str || "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    // Extrair dia da data
    const extrairDia = (dStr: string | null | undefined): number => {
      if (!dStr) return NaN;
      if (dStr.includes("-")) {
        const parts = dStr.split("-");
        return parseInt(parts[2], 10);
      }
      if (dStr.includes("/")) {
        const parts = dStr.split("/");
        return parseInt(parts[0], 10);
      }
      return NaN;
    };

    let diaCorte = 20;
    if (dataCorteStr) {
      const p = dataCorteStr.split(/[-/]/);
      diaCorte = parseInt(p[0], 10) || 20;
    }

    const ultimoDiaMes = new Date(Number(ano), mesNum, 0).getDate();

    const ehMesIntegral = (a: any) => {
      const dIni = extrairDia(a.data_inicial);
      const dFim = extrairDia(a.data_final);
      if (isNaN(dIni) || isNaN(dFim)) return true;
      return dIni <= 5 && dFim >= ultimoDiaMes - 2;
    };

    // Agrupar atividades válidas por consultor
    const lancsValidos = (lancsCompetencia || []).filter((l: any) => {
      const status = (l.status || "").toUpperCase();
      if (status.includes("CANCEL")) return false;
      const valor = Number(l.custo_consultor) || 0;
      return valor > 0;
    });

    // Mapa de atividades por consultor normalizado
    const mapaAtividadesPorConsultor = new Map<string, any[]>();
    lancsValidos.forEach((l: any) => {
      const cNome = l.consultores?.nome || "INDEFINIDO";
      const chave = norm(cNome);
      if (!mapaAtividadesPorConsultor.has(chave)) {
        mapaAtividadesPorConsultor.set(chave, []);
      }
      mapaAtividadesPorConsultor.get(chave)!.push(l);
    });

    const mm = String(mesNum).padStart(2, "0");
    const MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesNome = MESES_NOMES[mesNum - 1] || "Mês";
    const mesReferenciaFormatado = `${mesNome} / ${ano}`;

    // Construir lista de candidatos conforme as regras de negócio
    const candidatos: any[] = [];
    let codigoContador = proximoCodigoNum;

    // Iterar pelas pessoas da base
    pessoasLista.forEach((p: any) => {
      // Funcionários CLT não participam da emissão de Boletins de Medição (BM)
      if (p.tipo === "funcionario") return;

      const chavePessoa = norm(p.nome);
      // Atividades correspondentes
      let atividadesPessoa = mapaAtividadesPorConsultor.get(chavePessoa) || [];

      // Se não encontrou exato, tenta por inclusão parcial
      if (atividadesPessoa.length === 0) {
        for (const [chaveLanc, lista] of mapaAtividadesPorConsultor.entries()) {
          if (chaveLanc.includes(chavePessoa) || chavePessoa.includes(chaveLanc)) {
            atividadesPessoa = lista;
            break;
          }
        }
      }

      if (atividadesPessoa.length === 0) return;

      const tagMedicao = (p.tipo_medicao || "INTEGRAL").toUpperCase();
      let atividadesFiltradas: any[] = [];
      let periodoRotulo = "";

      if (tipoMedicao === "1ª Quinzena") {
        // REGRA 1ª QUINZENA:
        // Apenas consultores com tag QUINZENAL (ou que não tenham tag INTEGRAL)
        // e que tenham atividades cujo término seja antes do corte (dFim < diaCorte)
        if (tagMedicao === "INTEGRAL") return;

        atividadesFiltradas = atividadesPessoa.filter((a: any) => {
          if (ehMesIntegral(a)) return false;
          const dFim = extrairDia(a.data_final || a.data_inicial);
          if (isNaN(dFim)) return false;
          return dFim <= diaCorte;
        });

        periodoRotulo = `1ª Quinzena (Corte ${dataCorteStr})`;
      } else {
        // REGRA INTEGRAL:
        // Caso A: Consultores com tag INTEGRAL -> todas as atividades do mês
        // Caso B: Consultores com tag QUINZENAL -> atividades da 2ª Quinzena (iniciando no corte em diante), pois 1ª quinzena já foi enviada
        if (tagMedicao === "INTEGRAL") {
          atividadesFiltradas = [...atividadesPessoa];
          periodoRotulo = "Integral (Mês Cheio)";
        } else {
          atividadesFiltradas = atividadesPessoa.filter((a: any) => {
            if (ehMesIntegral(a)) return false;
            const dIni = extrairDia(a.data_inicial);
            if (isNaN(dIni)) return false;
            return dIni >= diaCorte;
          });
          periodoRotulo = `2ª Quinzena (Início ${dataCorteStr})`;
        }
      }

      if (atividadesFiltradas.length === 0) return;

      // Formatar atividades
      const somaTotal = atividadesFiltradas.reduce((acc, a) => acc + (Number(a.custo_consultor) || 0), 0);
      const totalHoras = atividadesFiltradas.reduce((acc, a) => acc + (Number(a.horas) || 0), 0);

      const atividadesFormatadas = atividadesFiltradas.map((a: any) => {
        const val = Number(a.custo_consultor) || 0;
        const dIniStr = a.data_inicial ? a.data_inicial.split("-").reverse().join("/") : "";
        const dFimStr = a.data_final ? a.data_final.split("-").reverse().join("/") : "";
        const perStr = dIniStr && dFimStr ? `${dIniStr} a ${dFimStr}` : `01/${mm}/${ano} a ${ultimoDiaMes}/${mm}/${ano}`;

        return {
          centroCusto: a.projetos?.centros_custo?.codigo || "01.07.010.039",
          projeto: a.projetos?.nome || "PROJETO NNÓS",
          atividade: a.atividade || "Atividades Técnicas Especializadas",
          periodo: perStr,
          dataInicial: a.data_inicial,
          dataFinal: a.data_final,
          horas: Number(a.horas) || 0,
          valorHora: totalHoras > 0 ? Math.round((val / (Number(a.horas) || 1)) * 100) / 100 : 0,
          valorTotal: val,
          rateioInterno: somaTotal > 0 ? `${((val / somaTotal) * 100).toFixed(2).replace(".", ",")}%` : "0,00%",
          liderProjeto: a.projetos?.centros_custo?.lideres?.nome || "Beatriz Picorelli",
          liderEmail: resolverEmailLider(a.projetos?.centros_custo?.lideres?.nome),
        };
      });

      // Detectar líder sugerido
      const liderObj = atividadesFormatadas[0]?.liderProjeto || "Beatriz Picorelli";
      const liderEmailObj = atividadesFormatadas[0]?.liderEmail || "beatriz.picorelli@nnos.com.br";

      // Verificar se já existe BM gerado anteriormente para este consultor e período
      const bmExistente = bmsLista.find((b: any) => {
        const mCons = norm(b.consultorNome) === chavePessoa;
        const mMes = (b.mesReferencia || "").toLowerCase().includes(mesNome.toLowerCase());
        const mPer = (b.periodoTipo || "").toLowerCase().includes(tipoMedicao.toLowerCase().slice(0, 3));
        return mCons && mMes && mPer;
      });

      const codigoBm = String(codigoContador).padStart(4, "0");
      codigoContador++;

      candidatos.push({
        id: `cand-${p.id || p.nome}-${Date.now()}`,
        consultorId: p.id,
        consultorNome: p.nome,
        consultorNomeCompleto: p.nome_completo || p.nome,
        consultorRazaoSocial: p.razao_social || p.nome,
        consultorCnpj: p.cnpj || "",
        consultorEmail: p.email || "",
        consultorEndereco: p.endereco_empresa || p.cidade_base || "",
        contrato: p.contrato_ativo || "2023.0005",
        tagMedicao,
        periodoRotulo,
        periodoTipo: tipoMedicao,
        mesReferenciaFormatado,
        totalHoras,
        valorTotal: somaTotal,
        mediaHora: totalHoras > 0 ? Math.round((somaTotal / totalHoras) * 100) / 100 : 0,
        codigoSugerido: bmExistente ? bmExistente.codigo : codigoBm,
        bmExistente: Boolean(bmExistente),
        bmExistenteCodigo: bmExistente?.codigo,
        bmExistenteStatus: bmExistente?.status,
        atividades: atividadesFormatadas,
        liderNome: liderObj,
        liderEmail: liderEmailObj,
        aptoEnvio: Boolean(p.email && p.email.includes("@")),
      });
    });

    return NextResponse.json({
      ok: true,
      ano,
      mesNum,
      tipoMedicao,
      dataCorteStr,
      totalCandidatos: candidatos.length,
      proximoCodigoSugerido: String(proximoCodigoNum).padStart(4, "0"),
      candidatos,
    });
  } catch (err: any) {
    console.error("Erro na rota /api/medicao/massa:", err);
    return NextResponse.json({ error: err.message || "Erro ao consultar candidatos para BM em massa" }, { status: 500 });
  }
}

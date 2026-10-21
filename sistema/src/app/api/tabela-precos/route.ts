import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "src/lib/tabela-precos.json");

function lerDados() {
  if (!fs.existsSync(FILE_PATH)) {
    return { contratos: [] };
  }
  return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
}

function salvarDados(data: any) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

import { supabaseAdmin } from "@/lib/supabase-server";

const FAT_PATH = path.join(process.cwd(), "src/lib/faturamento-base.json");

let cacheLancamentos: { timestamp: number; data: any[] } | null = null;

async function obterLancamentos2026(): Promise<any[]> {
  const agora = Date.now();
  if (cacheLancamentos && agora - cacheLancamentos.timestamp < 60000) {
    return cacheLancamentos.data;
  }
  try {
    const db = supabaseAdmin();
    const todos: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("lancamentos")
        .select("horas, faturar, custo_consultor, repasse, projetos(centros_custo(codigo))")
        .gte("competencia", "2026-01-01")
        .lte("competencia", "2026-12-31")
        .range(from, from + 999);
      if (error) break;
      todos.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    cacheLancamentos = { timestamp: agora, data: todos };
    return todos;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const dados = lerDados();
    
    // Carregar faturamentos e lançamentos para métricas de acompanhamento
    let faturas: any[] = [];
    try {
      if (fs.existsSync(FAT_PATH)) {
        faturas = JSON.parse(fs.readFileSync(FAT_PATH, "utf8")) || [];
      }
    } catch {}

    const lancs = await obterLancamentos2026();

    // Calcular métricas reais de acompanhamento para cada contrato
    const contratosComMetricas = dados.contratos.map((c: any) => {
      const ccs = new Set<string>(c.centrosDeCusto || []);
      const isAvulso = c.codigo === "AVULSO";

      let faturadoTotal = 0;
      let recebidoTotal = 0;
      let qtdFaturas = 0;

      faturas.forEach((f: any) => {
        const pertence = isAvulso ? !ccs.has(f.centroCusto) : ccs.has(f.centroCusto);
        if (pertence) {
          qtdFaturas++;
          const val = Number(f.valor) || 0;
          faturadoTotal += val;
          if ((f.status || "").toLowerCase().includes("pago")) {
            recebidoTotal += val;
          }
        }
      });

      let horasExecutadas = 0;
      let receitaPrevista = 0;
      let custoConsultores = 0;
      let qtdLancamentos = 0;

      lancs.forEach((l: any) => {
        const cod = l.projetos?.centros_custo?.codigo;
        const pertence = isAvulso ? (cod && !ccs.has(cod)) : ccs.has(cod);
        if (pertence) {
          qtdLancamentos++;
          horasExecutadas += Number(l.horas) || 0;
          receitaPrevista += Number(l.faturar) || 0;
          custoConsultores += Number(l.custo_consultor) || 0;
        }
      });

      const taxaAdimplencia = faturadoTotal > 0 ? (recebidoTotal / faturadoTotal) * 100 : 0;
      const margemEstimada = receitaPrevista > 0 ? ((receitaPrevista - custoConsultores) / receitaPrevista) * 100 : 0;

      return {
        ...c,
        metricas: {
          faturadoTotal,
          recebidoTotal,
          taxaAdimplencia: Math.round(taxaAdimplencia * 10) / 10,
          qtdFaturas,
          horasExecutadas: Math.round(horasExecutadas),
          diasExecutados: Math.round(horasExecutadas / 8),
          receitaPrevista,
          custoConsultores,
          margemEstimada: Math.round(margemEstimada * 10) / 10,
          qtdLancamentos,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...dados,
        contratos: contratosComMetricas,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dados = lerDados();

    // Ação 1: Aplicar Reajuste Contratual
    if (body.action === "aplicar-reajuste") {
      const { contratoId, ano, indice, aliquota, dataVigencia, observacoes } = body;
      const contrato = dados.contratos.find((c: any) => c.id === contratoId);
      if (!contrato) {
        return NextResponse.json({ success: false, error: "Contrato não encontrado" }, { status: 404 });
      }

      const fator = 1 + (Number(aliquota) || 0) / 100;
      const anoAnterior = String(Number(ano) - 1);

      // Reajustar Tabela de Preço do Cliente
      contrato.tabelaPrecoCliente.forEach((item: any) => {
        if (!item.anos) item.anos = {};
        const precoAnt = item.anos[anoAnterior] || item.anos["2025"] || item.anos["2026"];
        if (precoAnt) {
          if (item.tipoCobranca === "mensal") {
            const vMensal = Math.round(Number(precoAnt.valorMensal) * fator * 100) / 100;
            const vHora = Math.round((vMensal / 176) * 100) / 100;
            const vDia = Math.round(vHora * 8 * 100) / 100;
            item.anos[String(ano)] = { valorMensal: vMensal, valorHora: vHora, valorDia: vDia };
          } else {
            const vHora = Math.round(Number(precoAnt.valorHora) * fator * 100) / 100;
            const vDia = Math.round(vHora * 8 * 100) / 100;
            item.anos[String(ano)] = { valorHora: vHora, valorDia: vDia };
          }
        }
      });

      // Registrar histórico do reajuste
      if (!contrato.reajustes) contrato.reajustes = [];
      const idxReaj = contrato.reajustes.findIndex((r: any) => String(r.ano) === String(ano));
      const novoReaj = {
        ano: Number(ano),
        indice: String(indice || "Acordo Coletivo"),
        aliquota: Number(aliquota),
        dataVigencia: String(dataVigencia || `01/05/${ano}`),
        observacoes: String(observacoes || `Reajuste de ${aliquota}% aplicado em ${dataVigencia}`),
      };

      if (idxReaj >= 0) {
        contrato.reajustes[idxReaj] = novoReaj;
      } else {
        contrato.reajustes.unshift(novoReaj);
      }

      salvarDados(dados);
      return NextResponse.json({ success: true, data: dados, message: "Reajuste aplicado com sucesso!" });
    }

    // Ação 2: Criar Novo Contrato
    if (body.action === "criar-contrato") {
      const { codigo, nome, cliente, descricao, centrosDeCusto, tabelaPrecoCliente, tabelaConsultores, regraSocio } = body;
      if (!codigo || !nome) {
        return NextResponse.json({ success: false, error: "Código e Nome do contrato são obrigatórios." }, { status: 400 });
      }

      const id = `contrato-${codigo.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const novoContrato = {
        id,
        codigo: codigo.trim().toUpperCase(),
        alias: [codigo.trim().toUpperCase()],
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : `Contrato ${nome.trim()} - ${(cliente || "").trim()}`,
        cliente: (cliente || codigo).trim().toUpperCase(),
        ativo: true,
        centrosDeCusto: Array.isArray(centrosDeCusto) ? centrosDeCusto : [],
        reajustes: [],
        tabelaPrecoCliente: tabelaPrecoCliente || [
          {
            atividade: "Docência/Projetação",
            perfil: "JÚNIOR",
            anos: { "2026": { valorHora: 199.88, valorDia: 1599.00 } }
          },
          {
            atividade: "Docência/Projetação",
            perfil: "PLENO",
            anos: { "2026": { valorHora: 214.38, valorDia: 1715.00 } }
          },
          {
            atividade: "Docência/Projetação",
            perfil: "SÊNIOR",
            anos: { "2026": { valorHora: 228.62, valorDia: 1828.92 } }
          },
          {
            atividade: "Treinamentos Gerenciais",
            perfil: "SÊNIOR",
            anos: { "2026": { valorHora: 228.62, valorDia: 1828.92 } }
          }
        ],
        tabelaConsultores: tabelaConsultores || [
          {
            perfil: "JÚNIOR",
            clienteBrasil: { valorHora: 199.88, valorDia: 1599.00 },
            clienteLatam: { valorHora: 199.88, valorDia: 1599.00 },
            socioBrasil: 105.00,
            socioLatam: 140.00,
            parceiroBrasil: 97.00,
            parceiroLatam: 110.00
          },
          {
            perfil: "PLENO",
            clienteBrasil: { valorHora: 214.38, valorDia: 1715.00 },
            clienteLatam: { valorHora: 214.38, valorDia: 1715.00 },
            socioBrasil: 110.00,
            socioLatam: 140.00,
            parceiroBrasil: 100.00,
            parceiroLatam: 110.00
          },
          {
            perfil: "SÊNIOR",
            clienteBrasil: { valorHora: 228.62, valorDia: 1828.96 },
            clienteLatam: { valorHora: 228.62, valorDia: 1828.96 },
            socioBrasil: 115.00,
            socioLatam: 140.00,
            parceiroBrasil: 105.00,
            parceiroLatam: 110.00
          }
        ],
        regraSocio: regraSocio || {
          percentualAcrescimoNF: 6.0,
          excecaoPalavra: "COMISSÃO",
          descricao: "Acréscimo de 6% para consultor sócio (exceto atividades com COMISSÃO)."
        }
      };

      const idx = dados.contratos.findIndex((c: any) => c.codigo === novoContrato.codigo || c.id === novoContrato.id);
      if (idx >= 0) {
        dados.contratos[idx] = { ...dados.contratos[idx], ...novoContrato };
      } else {
        const avulsoIdx = dados.contratos.findIndex((c: any) => c.codigo === "AVULSO");
        if (avulsoIdx >= 0) {
          dados.contratos.splice(avulsoIdx, 0, novoContrato);
        } else {
          dados.contratos.push(novoContrato);
        }
      }

      salvarDados(dados);
      return NextResponse.json({ success: true, data: dados, message: "Novo contrato cadastrado com sucesso!" });
    }

    // Ação 3: Salvar ou Atualizar Contrato / Preços
    if (body.action === "salvar-contrato") {
      const { contrato } = body;
      const idx = dados.contratos.findIndex((c: any) => c.id === contrato.id);
      if (idx >= 0) {
        dados.contratos[idx] = { ...dados.contratos[idx], ...contrato };
      } else {
        dados.contratos.push(contrato);
      }
      salvarDados(dados);
      return NextResponse.json({ success: true, data: dados, message: "Contrato salvo com sucesso!" });
    }

    // Ação 3: Atualizar Classificação de Consultores (Sócios vs Parceiros)
    if (body.action === "atualizar-consultores") {
      dados.consultoresClassificacao = body.consultoresClassificacao;
      salvarDados(dados);
      return NextResponse.json({ success: true, data: dados });
    }

    return NextResponse.json({ success: false, error: "Ação não suportada" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

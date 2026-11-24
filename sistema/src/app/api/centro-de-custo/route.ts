import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ccBase from "@/lib/centros-de-custo.json";
import { supabaseAdmin } from "@/lib/supabase-server";

const ccFilePath = path.join(process.cwd(), "src/lib/centros-de-custo.json");
const CHAVE_CLOUD_CC = "centros_custo_matriz_v1";

async function carregarDadosCentroCusto(): Promise<any> {
  let baseLocal: any = ccBase;
  if (fs.existsSync(ccFilePath)) {
    try {
      baseLocal = JSON.parse(fs.readFileSync(ccFilePath, "utf8"));
    } catch {}
  }

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", CHAVE_CLOUD_CC)
      .maybeSingle();

    if (!error && data?.descricao) {
      const parsed = JSON.parse(data.descricao);
      if (parsed && Array.isArray(parsed.centrosDeCusto) && parsed.centrosDeCusto.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Aviso ao consultar centros_custo_matriz_v1 no Supabase:", err);
  }

  return baseLocal;
}

async function salvarDadosCentroCusto(dados: any): Promise<void> {
  try {
    fs.writeFileSync(ccFilePath, JSON.stringify(dados, null, 2), "utf8");
  } catch {
    // Em ambiente serverless (Vercel), o sistema de arquivos local é somente leitura
  }

  try {
    const db = supabaseAdmin();
    await db.from("configuracoes").upsert(
      {
        chave: CHAVE_CLOUD_CC,
        valor: Array.isArray(dados?.centrosDeCusto) ? dados.centrosDeCusto.length : 1,
        descricao: JSON.stringify(dados),
      },
      { onConflict: "chave" }
    );
  } catch (err) {
    console.warn("Aviso ao persistir centros_custo_matriz_v1 no Supabase:", err);
  }
}

export async function GET() {
  try {
    const data = await carregarDadosCentroCusto();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Erro ao ler centros de custo:", err);
    return NextResponse.json(ccBase);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const currentData = await carregarDadosCentroCusto();

    // 1. Criar novo Centro de Custo
    if (payload.action === "criar-centro-custo" && payload.centro) {
      const novoCC = payload.centro;
      const index = currentData.centrosDeCusto.findIndex(
        (c: any) => c.centroDeCusto === novoCC.centroDeCusto
      );
      if (index >= 0) {
        currentData.centrosDeCusto[index] = novoCC;
      } else {
        currentData.centrosDeCusto.unshift(novoCC);
      }
    }

    // 2. Editar Centro de Custo existente (incluindo líder substituto / cobertura)
    if (payload.action === "editar-centro-custo" && payload.centro) {
      const ccEditado = payload.centro;
      const index = currentData.centrosDeCusto.findIndex(
        (c: any) => c.centroDeCusto === ccEditado.centroDeCusto
      );
      if (index >= 0) {
        currentData.centrosDeCusto[index] = {
          ...currentData.centrosDeCusto[index],
          ...ccEditado,
        };
      }
    }

    // 2b. Programar ou encerrar Cobertura de Férias / Ausência em Lote
    if (payload.action === "programar-cobertura-lote" && Array.isArray(payload.codigosCC)) {
      const codigosSet = new Set(payload.codigosCC.map((c: string) => String(c).trim()));
      const liderSubstituto = String(payload.liderSubstituto || "").trim().toUpperCase();
      const coberturaInicio = liderSubstituto ? String(payload.coberturaInicio || "").trim() : "";
      const coberturaFim = liderSubstituto ? String(payload.coberturaFim || "").trim() : "";
      const coberturaMotivo = liderSubstituto ? String(payload.coberturaMotivo || "Férias").trim() : "";

      currentData.centrosDeCusto = currentData.centrosDeCusto.map((c: any) => {
        if (!codigosSet.has(String(c.centroDeCusto).trim())) return c;
        return {
          ...c,
          liderSubstituto,
          coberturaInicio,
          coberturaFim,
          coberturaMotivo,
        };
      });
    }

    // 3. Excluir Centro de Custo
    if (payload.action === "excluir-centro-custo" && payload.centroDeCusto) {
      currentData.centrosDeCusto = currentData.centrosDeCusto.filter(
        (c: any) => c.centroDeCusto !== payload.centroDeCusto
      );
    }

    // 4. Salvar Empresa (criar ou editar)
    if (payload.action === "salvar-empresa" && payload.empresa) {
      const { codigo, nome } = payload.empresa;
      const idx = currentData.empresas.findIndex((e: any) => e.codigo === codigo);
      if (idx >= 0) {
        currentData.empresas[idx].nome = nome;
      } else {
        currentData.empresas.push({ codigo, nome });
      }
    }

    // 5. Excluir Empresa
    if (payload.action === "excluir-empresa" && payload.codigo) {
      currentData.empresas = currentData.empresas.filter(
        (e: any) => e.codigo !== payload.codigo
      );
    }

    // 6. Salvar Unidade de Negócio
    if (payload.action === "salvar-unidade" && payload.unidade) {
      const { codigo, nome } = payload.unidade;
      const idx = currentData.unidadesNegocio.findIndex((u: any) => u.codigo === codigo);
      if (idx >= 0) {
        currentData.unidadesNegocio[idx].nome = nome;
      } else {
        currentData.unidadesNegocio.push({ codigo, nome });
      }
    }

    // 7. Excluir Unidade
    if (payload.action === "excluir-unidade" && payload.codigo) {
      currentData.unidadesNegocio = currentData.unidadesNegocio.filter(
        (u: any) => u.codigo !== payload.codigo
      );
    }

    // 8. Salvar Cliente
    if (payload.action === "salvar-cliente" && payload.cliente) {
      const { codigo, nome, cnpj } = payload.cliente;
      const idx = currentData.clientes.findIndex((c: any) => c.codigo === codigo);
      if (idx >= 0) {
        currentData.clientes[idx].nome = nome;
        currentData.clientes[idx].cnpj = cnpj;
      } else {
        currentData.clientes.push({ codigo, nome, cnpj: cnpj || "Não se aplica" });
      }
    }

    // 9. Excluir Cliente
    if (payload.action === "excluir-cliente" && payload.codigo) {
      currentData.clientes = currentData.clientes.filter(
        (c: any) => c.codigo !== payload.codigo
      );
    }

    await salvarDadosCentroCusto(currentData);

    return NextResponse.json({ success: true, data: currentData });
  } catch (error: any) {
    console.error("Erro na API de centro de custo:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ccBase from "@/lib/centros-de-custo.json";

const ccFilePath = path.join(process.cwd(), "src/lib/centros-de-custo.json");

export async function GET() {
  try {
    if (fs.existsSync(ccFilePath)) {
      const data = JSON.parse(fs.readFileSync(ccFilePath, "utf8"));
      return NextResponse.json(data);
    }
  } catch (err) {
    console.error("Erro ao ler centros-de-custo.json:", err);
  }
  return NextResponse.json(ccBase);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    let currentData = ccBase;
    if (fs.existsSync(ccFilePath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(ccFilePath, "utf8"));
      } catch (e) {}
    }

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

    // 2. Editar Centro de Custo existente
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

    // Persistir no arquivo JSON
    fs.writeFileSync(ccFilePath, JSON.stringify(currentData, null, 2), "utf8");

    return NextResponse.json({ success: true, data: currentData });
  } catch (error: any) {
    console.error("Erro na API de centro de custo:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

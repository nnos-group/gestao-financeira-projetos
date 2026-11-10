import { NextRequest, NextResponse } from "next/server";
import {
  carregarContratos,
  salvarContratos,
  calcularMetricasDashboard,
  processarSituacaoEAlertas,
} from "@/lib/contratos-service";
import { ContratoCompleto } from "@/lib/contratos-types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cliente = searchParams.get("cliente");
    const situacao = searchParams.get("situacao");
    const busca = searchParams.get("busca");

    let contratos = carregarContratos();

    if (cliente && cliente !== "TODOS") {
      contratos = contratos.filter(
        (c) => String(c.cliente.valor).toLowerCase() === cliente.toLowerCase()
      );
    }

    if (situacao && situacao !== "TODAS") {
      contratos = contratos.filter((c) => c.situacao === situacao);
    }

    if (busca && busca.trim()) {
      const b = busca.toLowerCase();
      contratos = contratos.filter(
        (c) =>
          String(c.numeroContrato.valor).toLowerCase().includes(b) ||
          String(c.cliente.valor).toLowerCase().includes(b) ||
          String(c.projeto.valor).toLowerCase().includes(b) ||
          String(c.objeto.valor).toLowerCase().includes(b) ||
          c.codigo.toLowerCase().includes(b)
      );
    }

    const metricas = calcularMetricasDashboard(contratos);

    return NextResponse.json({
      sucesso: true,
      contratos,
      metricas,
      total: contratos.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ContratoCompleto = await req.json();

    if (!body || !body.id) {
      return NextResponse.json(
        { sucesso: false, erro: "Dados do contrato inválidos." },
        { status: 400 }
      );
    }

    const contratosAtuais = carregarContratos();
    const indiceExistente = contratosAtuais.findIndex((c) => c.id === body.id);

    let novaLista: ContratoCompleto[];
    if (indiceExistente >= 0) {
      novaLista = [...contratosAtuais];
      novaLista[indiceExistente] = {
        ...body,
        atualizadoEm: new Date().toISOString(),
      };
    } else {
      novaLista = [
        {
          ...body,
          situacao: body.situacao === "EM_APROVACAO" ? "VIGENTE" : body.situacao,
          criadoEm: body.criadoEm || new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        },
        ...contratosAtuais,
      ];
    }

    const processada = processarSituacaoEAlertas(novaLista);
    salvarContratos(processada);

    return NextResponse.json({
      sucesso: true,
      contrato: body,
      mensagem: "Contrato salvo e integrado ao dashboard com sucesso!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}


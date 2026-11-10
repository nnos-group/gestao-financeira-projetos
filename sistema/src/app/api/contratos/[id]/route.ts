import { NextRequest, NextResponse } from "next/server";
import {
  carregarContratos,
  salvarContratos,
  processarSituacaoEAlertas,
} from "@/lib/contratos-service";
import { ContratoCompleto, AditivoContratual } from "@/lib/contratos-types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contratos = carregarContratos();
    const contrato = contratos.find((c) => c.id === id || c.codigo === id);

    if (!contrato) {
      return NextResponse.json(
        { sucesso: false, erro: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ sucesso: true, contrato });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const contratos = carregarContratos();
    const index = contratos.findIndex((c) => c.id === id || c.codigo === id);

    if (index === -1) {
      return NextResponse.json(
        { sucesso: false, erro: "Contrato não encontrado para atualização." },
        { status: 404 }
      );
    }

    const contratoAtual = contratos[index];

    // Se estiver adicionando um aditivo
    if (body.novoAditivo) {
      const aditivo: AditivoContratual = body.novoAditivo;
      const aditivosAtualizados = [...(contratoAtual.aditivos || []), aditivo];

      // Atualiza vigência ou valores se especificado no aditivo
      const contratoComAditivo: ContratoCompleto = {
        ...contratoAtual,
        aditivos: aditivosAtualizados,
        atualizadoEm: new Date().toISOString(),
      };

      if (aditivo.novaDataEncerramento) {
        contratoComAditivo.dataEncerramentoOficial = aditivo.novaDataEncerramento;
      }
      if (aditivo.novoValorGlobal) {
        contratoComAditivo.valorGlobal = {
          ...contratoComAditivo.valorGlobal,
          valor: aditivo.novoValorGlobal,
          clausulaOrigem: `Termo Aditivo nº ${aditivo.numeroAditivo}`,
        };
      }
      if (aditivo.novoValorMensal) {
        contratoComAditivo.valorMensalFixo = {
          ...contratoComAditivo.valorMensalFixo,
          valor: aditivo.novoValorMensal,
          clausulaOrigem: `Termo Aditivo nº ${aditivo.numeroAditivo}`,
        };
      }

      contratos[index] = contratoComAditivo;
    } else {
      // Atualização direta de campos
      contratos[index] = {
        ...contratoAtual,
        ...body,
        atualizadoEm: new Date().toISOString(),
      };
    }

    const processados = processarSituacaoEAlertas(contratos);
    salvarContratos(processados);

    return NextResponse.json({
      sucesso: true,
      contrato: processados[index],
      mensagem: "Contrato atualizado com sucesso!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contratos = carregarContratos();
    const filtrados = contratos.filter((c) => c.id !== id && c.codigo !== id);

    if (filtrados.length === contratos.length) {
      return NextResponse.json(
        { sucesso: false, erro: "Contrato não encontrado para exclusão." },
        { status: 404 }
      );
    }

    const processados = processarSituacaoEAlertas(filtrados);
    salvarContratos(processados);

    return NextResponse.json({
      sucesso: true,
      mensagem: "Contrato removido com sucesso.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}


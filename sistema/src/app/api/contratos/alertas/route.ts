import { NextRequest, NextResponse } from "next/server";
import {
  carregarContratos,
  salvarContratos,
  processarSituacaoEAlertas,
} from "@/lib/contratos-service";
import { formatarDataHoraBR } from "@/lib/date-utils";

export async function GET() {
  try {
    const contratos = carregarContratos();
    const todosAlertas = contratos.flatMap((c) => c.alertas || []);

    // Ordenar alertas pelos mais urgentes (menor diasRestantes)
    todosAlertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return NextResponse.json({
      sucesso: true,
      alertas: todosAlertas,
      total: todosAlertas.length,
      pendentes: todosAlertas.filter((a) => a.status === "PENDENTE").length,
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
    const body = await req.json();
    const { alertaId, contratoId, novoStatus, observacao, responsavel, usuario } = body;

    if (!alertaId || !contratoId) {
      return NextResponse.json(
        { sucesso: false, erro: "Identificação do alerta e contrato são obrigatórias." },
        { status: 400 }
      );
    }

    const contratos = carregarContratos();
    const indexContrato = contratos.findIndex((c) => c.id === contratoId);

    if (indexContrato === -1) {
      return NextResponse.json(
        { sucesso: false, erro: "Contrato vinculado não encontrado." },
        { status: 404 }
      );
    }

    const contrato = contratos[indexContrato];
    const indexAlerta = (contrato.alertas || []).findIndex((a) => a.id === alertaId);

    if (indexAlerta === -1) {
      return NextResponse.json(
        { sucesso: false, erro: "Alerta não encontrado neste contrato." },
        { status: 404 }
      );
    }

    const alertaAtual = contrato.alertas[indexAlerta];
    const agoraStr = formatarDataHoraBR(new Date().toISOString());

    const historicoAtualizado = [
      ...(alertaAtual.historicoAcoes || []),
      {
        data: agoraStr,
        usuario: usuario || "Gestor NNÓS",
        acao: `Status alterado para ${novoStatus || alertaAtual.status}`,
        nota: observacao,
      },
    ];

    contrato.alertas[indexAlerta] = {
      ...alertaAtual,
      status: novoStatus || alertaAtual.status,
      observacoes: observacao !== undefined ? observacao : alertaAtual.observacoes,
      responsavel: responsavel || alertaAtual.responsavel,
      dataResolucao: novoStatus === "CONCLUIDO" ? agoraStr : alertaAtual.dataResolucao,
      historicoAcoes: historicoAtualizado,
    };

    salvarContratos(contratos);

    return NextResponse.json({
      sucesso: true,
      alerta: contrato.alertas[indexAlerta],
      mensagem: "Alerta atualizado com sucesso!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}


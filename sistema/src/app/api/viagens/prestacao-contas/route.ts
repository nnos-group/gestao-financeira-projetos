import { NextResponse } from "next/server";
import { registrarAlimentacaoFinanceiro } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, valorAlimentacao, custoAlimentacaoDiaria, observacoes, concluirPrestacao, usuarioNome } = body;
    const valorFinal = valorAlimentacao != null ? valorAlimentacao : custoAlimentacaoDiaria;

    if (!solicitacaoId || valorFinal == null) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros solicitacaoId e valorAlimentacao/custoAlimentacaoDiaria são obrigatórios" },
        { status: 400 }
      );
    }

    const sol = await registrarAlimentacaoFinanceiro(
      solicitacaoId,
      Number(valorFinal),
      observacoes || "",
      Boolean(concluirPrestacao),
      usuarioNome || "Financeiro NNÓS"
    );

    return NextResponse.json({ ok: true, solicitacao: sol });
  } catch (err: any) {
    console.error("Erro ao registrar prestação de contas pelo financeiro:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao registrar prestação de contas" },
      { status: 500 }
    );
  }
}

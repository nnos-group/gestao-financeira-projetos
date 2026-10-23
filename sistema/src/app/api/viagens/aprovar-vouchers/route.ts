import { NextResponse } from "next/server";
import { aprovarRecebimentoVouchersConsultor } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, usuarioNome } = body;

    if (!solicitacaoId) {
      return NextResponse.json(
        { ok: false, error: "Parâmetro solicitacaoId é obrigatório" },
        { status: 400 }
      );
    }

    const sol = await aprovarRecebimentoVouchersConsultor(
      solicitacaoId,
      usuarioNome || "Consultor"
    );

    return NextResponse.json({
      ok: true,
      solicitacao: sol,
      mensagem: "Recebimento dos vouchers aprovado com sucesso pelo consultor!",
    });
  } catch (err: any) {
    console.error("Erro ao aprovar recebimento dos vouchers:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao aprovar vouchers" },
      { status: 500 }
    );
  }
}

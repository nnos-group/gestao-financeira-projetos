import { NextResponse } from "next/server";
import { aprovarLogisticaLider } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, escolhas, justificativas, aprovadorNome } = body;

    if (!solicitacaoId || !escolhas) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros solicitacaoId e escolhas são obrigatórios" },
        { status: 400 }
      );
    }

    const sol = await aprovarLogisticaLider(
      solicitacaoId,
      escolhas,
      aprovadorNome || "Líder de Projeto",
      justificativas
    );

    return NextResponse.json({ ok: true, solicitacao: sol });
  } catch (err: any) {
    console.error("Erro ao aprovar logística pelo líder:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao aprovar logística" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { aprovarLogisticaLider, devolverCotacaoParaAgencia } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      acao,
      solicitacaoId,
      escolhas,
      justificativas,
      aprovadorNome,
      motivoDevolutiva,
    } = body;

    if (acao === "DEVOLVER_COTACAO") {
      if (!solicitacaoId || !String(motivoDevolutiva || "").trim()) {
        return NextResponse.json(
          { ok: false, error: "Informe a justificativa de devolução para a agência." },
          { status: 400 }
        );
      }

      const sol = await devolverCotacaoParaAgencia(
        solicitacaoId,
        String(motivoDevolutiva).trim(),
        aprovadorNome || "Líder de Projeto",
        justificativas
      );

      return NextResponse.json({ ok: true, solicitacao: sol });
    }

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
    console.error("Erro ao processar aprovação/devolutiva pelo líder:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao processar ação do líder" },
      { status: 500 }
    );
  }
}

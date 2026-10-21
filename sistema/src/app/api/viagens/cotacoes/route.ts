import { NextResponse } from "next/server";
import { salvarCotacoesAgencia } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, categorias, observacoesAgencia, enviarParaAprovacao, usuarioNome } = body;

    if (!solicitacaoId || !categorias) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros solicitacaoId e categorias são obrigatórios" },
        { status: 400 }
      );
    }

    const sol = await salvarCotacoesAgencia(
      solicitacaoId,
      categorias,
      observacoesAgencia || "",
      Boolean(enviarParaAprovacao),
      usuarioNome || "Agência de Viagens"
    );

    return NextResponse.json({ ok: true, solicitacao: sol });
  } catch (err: any) {
    console.error("Erro ao salvar cotações da agência:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao salvar cotações" },
      { status: 500 }
    );
  }
}

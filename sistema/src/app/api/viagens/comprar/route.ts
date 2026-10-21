import { NextResponse } from "next/server";
import { registrarCompraAgencia } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, compras, usuarioNome } = body;

    if (!solicitacaoId || !compras || !Array.isArray(compras)) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros solicitacaoId e lista de compras são obrigatórios" },
        { status: 400 }
      );
    }

    const sol = await registrarCompraAgencia(solicitacaoId, {
      compras,
      usuarioNome: usuarioNome || "Agência de Viagens",
    });

    return NextResponse.json({
      ok: true,
      requerReaprovacao: sol.requerReaprovacao,
      motivoReaprovacao: sol.motivoReaprovacao,
      solicitacao: sol,
    });
  } catch (err: any) {
    console.error("Erro ao registrar compras da agência:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao registrar compras" },
      { status: 500 }
    );
  }
}

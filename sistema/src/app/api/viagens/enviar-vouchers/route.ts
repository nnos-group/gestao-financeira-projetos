import { NextResponse } from "next/server";
import { enviarVouchersViajante } from "@/lib/viagens-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { solicitacaoId, emailDestinatario, usuarioNome } = body;

    if (!solicitacaoId) {
      return NextResponse.json(
        { ok: false, error: "Parâmetro solicitacaoId é obrigatório" },
        { status: 400 }
      );
    }

    const res = await enviarVouchersViajante(
      solicitacaoId,
      emailDestinatario,
      usuarioNome || "Agência de Viagens"
    );

    return NextResponse.json(res);
  } catch (err: any) {
    console.error("Erro ao enviar vouchers ao viajante:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro ao enviar vouchers" },
      { status: 500 }
    );
  }
}

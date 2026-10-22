import { NextRequest, NextResponse } from "next/server";
import { enviarBmParaZohoSign } from "@/lib/zoho-sign";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      codigoBm,
      consultorNome,
      consultorEmail,
      liderNome,
      liderEmail,
      responsavelNome,
      responsavelEmail,
      emailsCopia,
      periodoStr,
      valorTotal,
    } = body;

    if (!codigoBm || !consultorNome || !consultorEmail || !liderEmail || !responsavelEmail) {
      return NextResponse.json(
        { error: "Dados incompletos para envio da assinatura no Zoho Sign." },
        { status: 400 }
      );
    }

    console.log(`🚀 [Zoho Sign API] Iniciando envio do BM ${codigoBm} para assinatura...`);

    const resultado = await enviarBmParaZohoSign({
      codigoBm,
      consultorNome,
      consultorEmail,
      liderNome,
      liderEmail,
      responsavelNome,
      responsavelEmail,
      emailsCopia,
      periodoStr: periodoStr || "Mês de Referência",
      valorTotal: Number(valorTotal) || 0,
    });

    console.log(`✅ [Zoho Sign API] BM ${codigoBm} enviado com sucesso! Request ID: ${resultado.requestId}`);

    return NextResponse.json(resultado, { status: 200 });
  } catch (err: any) {
    console.error("❌ [Zoho Sign API] Erro ao enviar BM:", err.message);
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar envio no Zoho Sign." },
      { status: 500 }
    );
  }
}

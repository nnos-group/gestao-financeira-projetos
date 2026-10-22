import { NextRequest, NextResponse } from "next/server";
import { enviarBmParaZohoSign } from "@/lib/zoho-sign";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      codigoBm,
      consultorNome,
      consultorRazaoSocial,
      consultorCnpj,
      consultorEndereco,
      consultorEmail,
      contrato,
      liderNome,
      liderEmail,
      responsavelNome,
      responsavelEmail,
      emailsCopia,
      mesReferencia,
      periodoStr,
      totalHoras,
      mediaHora,
      valorTotal,
      atividades,
    } = body;

    if (!codigoBm || !consultorNome || !consultorEmail || !liderEmail || !responsavelEmail) {
      return NextResponse.json(
        { error: "Dados incompletos para envio da assinatura no Zoho Sign." },
        { status: 400 }
      );
    }

    console.log(`🚀 [Zoho Sign API] Iniciando envio do BM ${codigoBm} para assinatura com layout oficial...`);

    const resultado = await enviarBmParaZohoSign({
      codigoBm,
      consultorNome,
      consultorRazaoSocial,
      consultorCnpj,
      consultorEndereco,
      consultorEmail,
      contrato,
      liderNome,
      liderEmail,
      responsavelNome,
      responsavelEmail,
      emailsCopia,
      mesReferencia,
      periodoStr: periodoStr || "Mês de Referência",
      totalHoras: Number(totalHoras) || 0,
      mediaHora: Number(mediaHora) || 0,
      valorTotal: Number(valorTotal) || 0,
      atividades: Array.isArray(atividades) ? atividades : [],
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

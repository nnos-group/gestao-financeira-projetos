import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { gerarPdfOficialBm } from "@/lib/bm-pdf-generator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await context.params;
    const bmsPath = path.resolve(process.cwd(), "src/lib/bms-2026.json");

    let bm: any = null;
    if (fs.existsSync(bmsPath)) {
      const bms = JSON.parse(fs.readFileSync(bmsPath, "utf-8"));
      bm = bms.find((b: any) => String(b.codigo) === String(codigo));
    }

    if (!bm) {
      return new NextResponse("Boletim de Medição não encontrado.", { status: 404 });
    }

    const pdfBytes = await gerarPdfOficialBm({
      codigoBm: bm.codigo,
      consultorNome: bm.consultorNome,
      consultorRazaoSocial: bm.consultorRazaoSocial,
      consultorCnpj: bm.consultorCnpj,
      consultorEndereco: bm.consultorEndereco,
      consultorEmail: bm.consultorEmail,
      contrato: bm.contrato,
      mesReferencia: bm.mesReferencia,
      periodoStr: `${bm.mesReferencia} (${bm.periodoTipo})`,
      totalHoras: bm.totalHoras || 0,
      mediaHora: bm.mediaHora || 0,
      valorTotal: bm.valorTotal || 0,
      liderNome: bm.liderProjetoNome || "Líder de Projeto",
      responsavelNome: bm.responsavelNnosNome || "Leonardo Campos",
      atividades: bm.atividades || [],
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="BM_${bm.codigo}_Oficial.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("Erro ao gerar PDF do BM via rota:", err.message);
    return new NextResponse("Erro ao gerar PDF do BM: " + err.message, { status: 500 });
  }
}

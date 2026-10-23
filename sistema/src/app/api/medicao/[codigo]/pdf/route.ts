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
    const possiblePaths = [
      path.resolve(process.cwd(), "src/lib/bms-2026.json"),
      path.resolve(process.cwd(), "sistema/src/lib/bms-2026.json"),
      path.resolve(__dirname, "../../../../../src/lib/bms-2026.json"),
    ];

    let bm: any = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const bms = JSON.parse(fs.readFileSync(p, "utf-8"));
          bm = bms.find((b: any) => String(b.codigo) === String(codigo));
          if (bm) break;
        } catch {}
      }
    }

    // Fallback: Se não encontrou localmente (ex: ambiente Vercel Serverless), busca na nuvem (Supabase)
    if (!bm) {
      try {
        const { supabaseAdmin } = await import("@/lib/supabase-server");
        const sb = supabaseAdmin();
        const { data } = await sb
          .from("configuracoes")
          .select("descricao")
          .eq("chave", "bms_lista_completa")
          .maybeSingle();

        if (data?.descricao) {
          const cloudList = JSON.parse(data.descricao);
          if (Array.isArray(cloudList)) {
            bm = cloudList.find((b: any) => String(b.codigo) === String(codigo));
          }
        }
      } catch (sbErr: any) {
        console.warn("Aviso ao consultar Supabase para gerar PDF:", sbErr.message);
      }
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

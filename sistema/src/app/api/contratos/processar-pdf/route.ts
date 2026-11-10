import { NextRequest, NextResponse } from "next/server";
import { extrairDadosContratoPorIA } from "@/lib/contratos-ia-extractor";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let textoCompleto = "";
    let nomeArquivo = "Contrato_Upload.pdf";
    let tamanhoBytes = 0;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { sucesso: false, erro: "Nenhum arquivo PDF foi enviado." },
          { status: 400 }
        );
      }

      nomeArquivo = file.name;
      tamanhoBytes = file.size;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pdfBase64 = buffer.toString("base64");

      // Tenta extrair texto com pdf-parse se disponível, caso contrário decodifica buffer
      try {
        const pdfModule: any = await import("pdf-parse");
        const pdfParse = pdfModule?.default || pdfModule;
        const pdfData = await pdfParse(buffer);
        textoCompleto = pdfData?.text || "";
      } catch (parseErr) {
        console.warn("Aviso ao extrair texto com pdf-parse, utilizando decodificador direto:", parseErr);
        textoCompleto = buffer.toString("utf-8").replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, " ");
      }

      const contratoExtraido = await extrairDadosContratoPorIA({
        textoCompleto,
        nomeArquivo,
        tamanhoBytes,
        pdfBase64,
      });

      return NextResponse.json({
        sucesso: true,
        contrato: contratoExtraido,
        inconsistencias: contratoExtraido.inconsistencias,
        textoResumo: textoCompleto.slice(0, 500),
      });
    } else {
      return NextResponse.json(
        { sucesso: false, erro: "Formato inválido. Envie via multipart/form-data." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}


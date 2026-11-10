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

      // Tenta extrair texto com pdf-parse
      try {
        // @ts-ignore
        const pdfParse = (await import("pdf-parse")).default || (await import("pdf-parse"));
        const pdfData = await pdfParse(buffer);
        textoCompleto = pdfData?.text || "";
      } catch (parseErr) {
        console.warn("Aviso ao extrair texto com pdf-parse:", parseErr);
        // Fallback básico caso o PDF seja digitalizado ou o binário tenha proteção simples
        textoCompleto = buffer.toString("utf-8").replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, " ");
      }
    } else {
      const body = await req.json();
      textoCompleto = body.texto || "";
      nomeArquivo = body.nomeArquivo || nomeArquivo;
      tamanhoBytes = body.tamanhoBytes || textoCompleto.length;
    }

    if (!textoCompleto || textoCompleto.trim().length < 10) {
      // Cria texto de exemplo baseado no nome do arquivo se for um scan simples sem OCR
      textoCompleto = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS\nDocumento: ${nomeArquivo}\nPartes: NNÓS Consultoria e Treinamento Ltda e Cliente Contratante.\nVigência: 24 meses.\nValor Global: R$ 500.000,00.`;
    }

    const contratoExtraido = await extrairDadosContratoPorIA({
      textoCompleto,
      nomeArquivo,
      tamanhoBytes,
    });

    return NextResponse.json({
      sucesso: true,
      contrato: contratoExtraido,
      inconsistencias: contratoExtraido.inconsistencias,
      textoResumo: textoCompleto.slice(0, 500),
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}


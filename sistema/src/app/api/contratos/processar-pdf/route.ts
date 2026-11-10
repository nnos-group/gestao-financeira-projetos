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

      // 1. Tenta extrair com pdf-parse (compatível com v1 e v2 PDFParse class)
      try {
        const pdfModule: any = await import("pdf-parse");
        if (pdfModule?.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: buffer });
          await parser.load();
          const res = await parser.getText();
          textoCompleto = res?.text || (typeof res === "string" ? res : "");
        } else if (typeof pdfModule === "function") {
          const pdfData = await pdfModule(buffer);
          textoCompleto = pdfData?.text || "";
        } else if (pdfModule?.default) {
          if (pdfModule.default?.PDFParse) {
            const parser = new pdfModule.default.PDFParse({ data: buffer });
            await parser.load();
            const res = await parser.getText();
            textoCompleto = res?.text || (typeof res === "string" ? res : "");
          } else if (typeof pdfModule.default === "function") {
            const pdfData = await pdfModule.default(buffer);
            textoCompleto = pdfData?.text || "";
          }
        }
      } catch (parseErr) {
        console.warn("Aviso ao extrair texto com pdf-parse:", parseErr);
      }

      // 2. Se o texto estiver curto ou falhou, descompacta streams /FlateDecode com zlib
      if (!textoCompleto || textoCompleto.trim().length < 50) {
        try {
          const zlib = await import("zlib");
          let pos = 0;
          let streamsText = "";
          while ((pos = buffer.indexOf("stream", pos)) !== -1) {
            let start = pos + 6;
            if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
            else if (buffer[start] === 0x0a || buffer[start] === 0x0d) start += 1;
            const end = buffer.indexOf("endstream", start);
            if (end === -1) break;
            const chunk = buffer.subarray(start, end);
            try {
              const inflated = zlib.inflateSync(chunk);
              streamsText += " " + inflated.toString("latin1");
            } catch {
              try {
                const raw = zlib.inflateRawSync(chunk);
                streamsText += " " + raw.toString("latin1");
              } catch {}
            }
            pos = end + 9;
          }
          if (streamsText.length > 50) {
            textoCompleto += " " + streamsText;
          }
        } catch (zErr) {
          console.warn("Aviso ao descompactar streams:", zErr);
        }
      }

      // 3. Fallback de strings brutas caso ainda não haja texto suficiente
      if (!textoCompleto || textoCompleto.trim().length < 50) {
        textoCompleto = buffer.toString("latin1").replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, " ");
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


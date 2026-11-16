import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET_VIAGENS = "viagens-documentos";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tipo = (String(formData.get("tipo") || "ORCAMENTO") as "ORCAMENTO" | "PROPOSTA" | "VOUCHER");
    const solicitacaoId = String(formData.get("solicitacaoId") || "geral").replace(/[^a-zA-Z0-9_-]/g, "_");
    const categoria = String(formData.get("categoria") || "GERAL").replace(/[^a-zA-Z0-9_-]/g, "_");

    if (!file) {
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const mimeType = file.type || "application/pdf";
    const nomeLimpo = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const db = supabaseAdmin();
    let finalUrl = "";

    // 1. Tenta enviar diretamente para o Supabase Storage (bucket público)
    try {
      const { data: buckets } = await db.storage.listBuckets();
      const existeBucket = Array.isArray(buckets) && buckets.some((b) => b.name === BUCKET_VIAGENS);
      if (!existeBucket) {
        await db.storage.createBucket(BUCKET_VIAGENS, { public: true });
      }

      const storagePath = `${solicitacaoId}/${categoria}/${docId}-${nomeLimpo}`;
      const { error: uploadErr } = await db.storage
        .from(BUCKET_VIAGENS)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: urlData } = db.storage.from(BUCKET_VIAGENS).getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          finalUrl = urlData.publicUrl;
        }
      } else {
        console.warn("Aviso no upload para Supabase Storage:", uploadErr.message);
      }
    } catch (storageErr) {
      console.warn("Fallback de upload para tabela configuracoes:", storageErr);
    }

    // 2. Fallback: armazena em registro individual na tabela configuracoes e serve via GET /api/viagens/anexo?id=
    if (!finalUrl) {
      const payloadDoc = {
        nome: file.name,
        mimeType,
        base64: buffer.toString("base64"),
      };
      const { error: dbErr } = await db.from("configuracoes").upsert(
        {
          chave: `viagem_doc_${docId}`,
          valor: buffer.length,
          descricao: JSON.stringify(payloadDoc),
        },
        { onConflict: "chave" }
      );
      if (dbErr) {
        throw new Error(`Erro ao salvar arquivo na base: ${dbErr.message}`);
      }
      finalUrl = `/api/viagens/anexo?id=${docId}`;
    }

    const anexo = {
      id: docId,
      nome: file.name,
      tipo,
      url: finalUrl,
      mimeType,
      tamanhoFormatado: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      criadoEm: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, anexo });
  } catch (err: any) {
    console.error("Erro no upload de anexo de viagem:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro interno ao enviar arquivo" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parâmetro id obrigatório" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", `viagem_doc_${id}`)
      .maybeSingle();

    if (error || !data?.descricao) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const parsed = JSON.parse(data.descricao) as {
      nome?: string;
      mimeType?: string;
      base64: string;
    };

    const buffer = Buffer.from(parsed.base64, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": parsed.mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(parsed.nome || "documento.pdf")}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro ao ler documento" }, { status: 500 });
  }
}

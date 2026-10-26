import { NextResponse } from "next/server";
import { listarBloqueios, salvarBloqueio, removerBloqueio } from "@/lib/agenda-bloqueios-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const consultor = searchParams.get("consultor");
    let lista = await listarBloqueios();

    if (consultor) {
      const clean = (s: string) =>
        (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
      const cBusca = clean(consultor);
      lista = lista.filter((b) => {
        const bNome = clean(b.consultorNome);
        return bNome === cBusca || bNome.includes(cBusca) || cBusca.includes(bNome);
      });
    }

    return NextResponse.json({ ok: true, bloqueios: lista });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { consultorNome, consultorId, dataInicial, dataFinal, tipo, motivo, observacoes } = body;

    if (!consultorNome || !dataInicial || !dataFinal || !motivo) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios: consultorNome, dataInicial, dataFinal e motivo." },
        { status: 400 }
      );
    }

    const bloqueio = await salvarBloqueio({
      consultorNome,
      consultorId,
      dataInicial,
      dataFinal,
      tipo: tipo || "OFF",
      motivo,
      observacoes,
    });

    return NextResponse.json({ ok: true, bloqueio, mensagem: "Período bloqueado com sucesso na agenda!" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Parâmetro id é obrigatório" }, { status: 400 });
    }

    await removerBloqueio(id);
    return NextResponse.json({ ok: true, mensagem: "Bloqueio removido com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

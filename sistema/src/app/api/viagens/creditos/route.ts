import { NextResponse } from "next/server";
import {
  listarCreditosLogistica,
  salvarListaCreditosLogistica,
  normalizarItemCredito,
  CreditoLogisticaItem,
} from "@/lib/viagens-creditos-service";
import ccBase from "@/lib/centros-de-custo.json";
import consultoresBase from "@/lib/consultores-base.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const creditos = await listarCreditosLogistica();

    const setProjetos = new Set<string>();
    const centros = (ccBase as { centrosDeCusto?: { projeto?: string }[] })?.centrosDeCusto || [];
    for (const c of centros) {
      const p = String(c.projeto || "").trim().toUpperCase();
      if (p && p !== "-" && p !== "—") setProjetos.add(p);
    }
    for (const cr of creditos) {
      if (cr.projeto) setProjetos.add(cr.projeto);
      if (cr.projetoUtilizado) setProjetos.add(cr.projetoUtilizado);
    }

    const setConsultores = new Set<string>();
    const listaCons = Array.isArray(consultoresBase) ? consultoresBase : [];
    for (const c of listaCons as { nome?: string }[]) {
      const n = String(c.nome || "").trim().toUpperCase();
      if (n) setConsultores.add(n);
    }
    for (const cr of creditos) {
      if (cr.instrutor) setConsultores.add(cr.instrutor);
    }

    const projetos = Array.from(setProjetos).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const consultores = Array.from(setConsultores).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return NextResponse.json({
      ok: true,
      creditos,
      projetos,
      consultores,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar controle de créditos";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lista = await listarCreditosLogistica();

    const valor = Number(body.valor) || 0;
    const multaTaxa = Number(body.multaTaxa) || 0;
    const creditoCalculado = Math.max(0, Math.round((valor - multaTaxa) * 100) / 100);

    const novoItem: CreditoLogisticaItem = normalizarItemCredito({
      id: `cred-${Date.now()}`,
      projeto: body.projeto,
      dataInicial: body.dataInicial,
      dataFinal: body.dataFinal,
      instrutor: body.instrutor,
      ciaAereaHotel: body.ciaAereaHotel,
      valor,
      multaTaxa,
      credito:
        body.credito !== undefined && body.credito !== null && body.credito !== ""
          ? Number(body.credito)
          : creditoCalculado,
      notaDebito: body.notaDebito,
      creditoUtilizado: body.creditoUtilizado === "SIM" ? "SIM" : "NÃO",
      projetoUtilizado: body.projetoUtilizado,
      dataInicialUtilizacao: body.dataInicialUtilizacao,
      dataFinalUtilizacao: body.dataFinalUtilizacao,
      observacoes: body.observacoes,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: body.atualizadoPor || "Agência de Viagens",
    });

    const novaLista = [novoItem, ...lista];
    const salvos = await salvarListaCreditosLogistica(novaLista);

    return NextResponse.json({
      ok: true,
      credito: novoItem,
      creditos: salvos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao cadastrar crédito";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID do registro de crédito é obrigatório." }, { status: 400 });
    }

    const lista = await listarCreditosLogistica();
    const idx = lista.findIndex((c) => c.id === id);
    if (idx < 0) {
      return NextResponse.json({ ok: false, error: "Registro de crédito não encontrado." }, { status: 404 });
    }

    const atual = lista[idx];
    const valor = body.valor !== undefined ? Number(body.valor) || 0 : atual.valor;
    const multaTaxa = body.multaTaxa !== undefined ? Number(body.multaTaxa) || 0 : atual.multaTaxa;
    const creditoCalculado = Math.max(0, Math.round((valor - multaTaxa) * 100) / 100);

    const atualizado = normalizarItemCredito(
      {
        ...atual,
        ...body,
        id,
        valor,
        multaTaxa,
        credito:
          body.credito !== undefined && body.credito !== null && body.credito !== ""
            ? Number(body.credito)
            : creditoCalculado,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: body.atualizadoPor || "Agência de Viagens",
      },
      id
    );

    lista[idx] = atualizado;
    const salvos = await salvarListaCreditosLogistica(lista);

    return NextResponse.json({
      ok: true,
      credito: atualizado,
      creditos: salvos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar crédito";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID do registro de crédito é obrigatório." }, { status: 400 });
    }

    const lista = await listarCreditosLogistica();
    const filtrada = lista.filter((c) => c.id !== id);
    const salvos = await salvarListaCreditosLogistica(filtrada);

    return NextResponse.json({
      ok: true,
      creditos: salvos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao remover crédito";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import {
  carregarSolicitacoesArquivo,
  sincronizarSolicitacoesIniciais,
  garantirSolicitacaoAtividade,
} from "@/lib/viagens-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competencia = searchParams.get("competencia") || undefined;
    const sincronizar = searchParams.get("sincronizar") === "true";

    let solicitacoes = carregarSolicitacoesArquivo();
    if (solicitacoes.length === 0 || sincronizar) {
      solicitacoes = await sincronizarSolicitacoesIniciais(competencia);
    }

    // Filtros opcionais
    const status = searchParams.get("status");
    const projeto = searchParams.get("projeto");
    const consultor = searchParams.get("consultor");
    const busca = searchParams.get("busca");

    let filtradas = solicitacoes;

    if (status && status !== "TODOS") {
      filtradas = filtradas.filter((s) => s.status === status);
    }
    if (projeto && projeto !== "TODOS") {
      filtradas = filtradas.filter((s) => s.projeto.toUpperCase() === projeto.toUpperCase());
    }
    if (consultor && consultor !== "TODOS") {
      filtradas = filtradas.filter((s) => s.consultor.toUpperCase() === consultor.toUpperCase());
    }
    if (busca) {
      const b = busca.toLowerCase();
      filtradas = filtradas.filter(
        (s) =>
          s.projeto.toLowerCase().includes(b) ||
          s.atividade.toLowerCase().includes(b) ||
          s.consultor.toLowerCase().includes(b) ||
          s.destino.toLowerCase().includes(b)
      );
    }

    return NextResponse.json({
      ok: true,
      total: filtradas.length,
      solicitacoes: filtradas,
    });
  } catch (err: any) {
    console.error("Erro ao listar solicitações de viagem:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro interno ao listar solicitações" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lancamentoId, dadosAtividade } = body;

    if (!lancamentoId) {
      return NextResponse.json(
        { ok: false, error: "ID do lançamento é obrigatório" },
        { status: 400 }
      );
    }

    const sol = await garantirSolicitacaoAtividade(lancamentoId, dadosAtividade || {});
    return NextResponse.json({ ok: true, solicitacao: sol });
  } catch (err: any) {
    console.error("Erro ao criar/atualizar solicitação de viagem:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}

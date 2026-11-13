import { NextRequest, NextResponse } from "next/server";
import {
  lerLogsAsync,
  salvarLogsAsync,
  registrarLogSegurancaAsync,
} from "@/lib/usuarios-service";

function extrairIpCliente(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "189.40.112.84";
}

export async function GET() {
  try {
    const logs = await lerLogsAsync();
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.acao === "LIMPAR_LOGS" || body.acao === "RESTAURAR_PADRAO") {
      await salvarLogsAsync([]);
      return NextResponse.json({ ok: true, logs: [] });
    }

    const ipCliente = body.ip || extrairIpCliente(req);

    await registrarLogSegurancaAsync({
      usuarioLogin: body.usuarioLogin || "sistema",
      usuarioNome: body.usuarioNome || "Usuário do Sistema",
      usuarioEmail: body.usuarioEmail || "sistema@nnos.com.br",
      perfilId: body.perfilId || "ADMIN",
      evento: body.evento || "ACESSO_SISTEMA",
      metodo: body.metodo || "Sessão Web",
      status: body.status || "SUCESSO",
      ip: ipCliente,
      dispositivo: body.dispositivo || "Windows • Navegador Corporativo",
      detalhes: body.detalhes || "Evento registrado pelo monitoramento de segurança.",
    });

    const logs = await lerLogsAsync();
    return NextResponse.json({ ok: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

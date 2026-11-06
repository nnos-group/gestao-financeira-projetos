import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import logsPadrao from "@/lib/logs-acesso.json";
import { registrarLogSeguranca } from "@/app/api/admin/usuarios/route";

const LOGS_PATH = path.join(process.cwd(), "src", "lib", "logs-acesso.json");

function lerLogs(): any[] {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      const raw = fs.readFileSync(LOGS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Aviso ao ler logs-acesso.json:", e);
  }
  return logsPadrao as any[];
}

export async function GET() {
  try {
    const logs = lerLogs();
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.acao === "RESTAURAR_PADRAO") {
      fs.writeFileSync(LOGS_PATH, JSON.stringify(logsPadrao, null, 2), "utf-8");
      return NextResponse.json({ ok: true, logs: logsPadrao });
    }

    registrarLogSeguranca({
      usuarioLogin: body.usuarioLogin || "sistema",
      usuarioNome: body.usuarioNome || "Usuário do Sistema",
      usuarioEmail: body.usuarioEmail || "sistema@nnos.com.br",
      perfilId: body.perfilId || "ADMIN",
      evento: body.evento || "ACESSO_SISTEMA",
      metodo: body.metodo || "Sessão Web",
      status: body.status || "SUCESSO",
      ip: body.ip || "189.40.112.84",
      dispositivo: body.dispositivo || "Windows • Navegador Corporativo",
      detalhes: body.detalhes || "Evento registrado pelo monitoramento de segurança.",
    });

    const logs = lerLogs();
    return NextResponse.json({ ok: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


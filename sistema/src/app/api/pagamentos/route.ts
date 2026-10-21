import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "src/lib/pagamentos-base.json");

export async function GET() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return NextResponse.json([]);
    }
    const content = fs.readFileSync(DATA_FILE, "utf8");
    const json = JSON.parse(content);
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("Erro ao ler pagamentos:", err);
    return NextResponse.json({ error: "Erro ao ler pagamentos" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Payload inválido. Esperava array de pagamentos." }, { status: 400 });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, count: body.length });
  } catch (err: any) {
    console.error("Erro ao salvar pagamentos:", err);
    return NextResponse.json({ error: "Erro ao salvar pagamentos" }, { status: 500 });
  }
}

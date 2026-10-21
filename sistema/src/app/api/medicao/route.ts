import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "src/lib/bms-2026.json");

export async function GET() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    return NextResponse.json([]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify(body, null, 2), "utf-8");
      return NextResponse.json({ success: true, count: body.length });
    }
    return NextResponse.json({ error: "Dados inválidos, esperado array de BMs." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

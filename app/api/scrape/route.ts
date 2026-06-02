import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  const scriptPath = path.join(process.cwd(), "bot", "scraper.py");
  const body = await req.json().catch(() => ({}));
  const source: string | undefined = body?.source;

  const args = ["--force"];
  if (source) args.push(`--source=${source}`);

  try {
    const { stdout } = await execFileAsync("python3", [scriptPath, ...args]);
    return NextResponse.json({ ok: true, output: stdout.trim() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.stderr || error.message }, { status: 500 });
  }
}

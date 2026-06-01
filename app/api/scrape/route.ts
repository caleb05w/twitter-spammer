import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export async function POST() {
  const scriptPath = path.join(process.cwd(), "bot", "scraper.py");
  try {
    const { stdout } = await execFileAsync("python3", [scriptPath, "--force"]);
    return NextResponse.json({ ok: true, output: stdout.trim() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.stderr || error.message }, { status: 500 });
  }
}

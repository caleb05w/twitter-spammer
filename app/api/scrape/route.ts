import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST() {
  const scriptPath = path.join(process.cwd(), "bot", "scraper.py");

  return new Promise<NextResponse>((resolve) => {
    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        resolve(NextResponse.json({ ok: false, error: stderr }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true, output: stdout.trim() }));
      }
    });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { exec } from "child_process";
import path from "path";
import { getDb } from "@/lib/mongodb";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await req.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("posts").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );

  if (status === "approved") {
    const scriptPath = path.join(process.cwd(), "bot", "poster.py");
    exec(`python3 ${scriptPath} ${id}`, (error, stdout, stderr) => {
      if (error) console.error("Poster error:", stderr);
      else console.log("Poster:", stdout.trim());
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function POST() {
  const db = await getDb();
  const posts = db.collection("posts");

  const approvedCount = await posts.countDocuments({ status: "approved" });
  if (approvedCount > 0) {
    return NextResponse.json({ ok: true, approved: false, reason: "queue not empty" });
  }

  const pending = await posts.find({ status: "pending" }).toArray();
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, approved: false, reason: "no pending posts" });
  }

  const pick = pending[Math.floor(Math.random() * pending.length)];
  await posts.updateOne({ _id: pick._id }, { $set: { status: "approved" } });

  return NextResponse.json({ ok: true, approved: true, id: pick._id.toString(), handle: pick.handle });
}

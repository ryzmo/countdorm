import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DEFAULT_ROOMS = ["plaza", "sergun", "kom1", "kom2", "kom3", "kom5", "cws"];

// GET: Ambil status counts dan 100 log terakhir
export async function GET() {
  try {
    const roomRows = await sql`
      SELECT room, count FROM room_counts
    `;

    const logRows = await sql`
      SELECT id, room, action, current_count, created_at 
      FROM crowd_logs 
      ORDER BY created_at DESC 
      LIMIT 100
    `;

    const counts: Record<string, number> = {};
    for (const r of DEFAULT_ROOMS) {
      counts[r] = 0;
    }

    for (const row of roomRows as { room: string; count: number }[]) {
      counts[row.room] = row.count;
    }

    return NextResponse.json({
      success: true,
      counts,
      logs: logRows.map((l: any) => ({
        id: String(l.id),
        room: l.room,
        type: l.action,
        currentCount: l.current_count,
        timestamp: l.created_at,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/crowd error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Tambah aksi IN / OUT / RESET
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { room, action } = body as { room: string; action: "IN" | "OUT" | "RESET" };

    if (!room || !["IN", "OUT", "RESET"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    // Ambil count saat ini
    const existing = await sql`
      SELECT count FROM room_counts WHERE room = ${room} LIMIT 1
    `;

    const currentCount = existing.length > 0 ? (existing[0] as any).count : 0;
    let nextCount = currentCount;

    if (action === "IN") {
      nextCount = currentCount + 1;
    } else if (action === "OUT") {
      nextCount = Math.max(0, currentCount - 1);
    } else if (action === "RESET") {
      nextCount = 0;
    }

    // Upsert room_counts
    await sql`
      INSERT INTO room_counts (room, count, updated_at)
      VALUES (${room}, ${nextCount}, CURRENT_TIMESTAMP)
      ON CONFLICT (room) 
      DO UPDATE SET count = ${nextCount}, updated_at = CURRENT_TIMESTAMP
    `;

    // Insert log
    const insertedLog = await sql`
      INSERT INTO crowd_logs (room, action, current_count, created_at)
      VALUES (${room}, ${action}, ${nextCount}, CURRENT_TIMESTAMP)
      RETURNING id, room, action, current_count, created_at
    `;

    const newLogItem = insertedLog[0] as any;

    return NextResponse.json({
      success: true,
      room,
      nextCount,
      log: {
        id: String(newLogItem.id),
        room: newLogItem.room,
        type: newLogItem.action,
        currentCount: newLogItem.current_count,
        timestamp: newLogItem.created_at,
      },
    });
  } catch (error: any) {
    console.error("POST /api/crowd error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Hapus log dataset
export async function DELETE() {
  try {
    await sql`DELETE FROM crowd_logs`;
    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error: any) {
    console.error("DELETE /api/crowd error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


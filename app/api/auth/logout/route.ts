import { clearSessionCookie, deleteSession } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await deleteSession(request); } catch { /* Cookie is still cleared when the database is unavailable. */ }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
}

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { games } from "@/db/schema";
import { getSessionUser } from "@/app/lib/auth";

function cleanName(value: string) {
  return value.replace(/消消乐/g, "").trim().slice(0, 10) || "奶龙";
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const rows = await getDb().select().from(games).where(eq(games.userId, user.id)).orderBy(desc(games.updatedAt));
  return Response.json({ games: rows });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = await request.json() as { name?: string };
  const game = { id: crypto.randomUUID(), userId: user.id, name: cleanName(payload.name ?? "奶龙") };
  await getDb().insert(games).values(game);
  return Response.json({ game: { ...game, currentLevel: 1, highestLevel: 1, highestScore: 0 } }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = await request.json() as { id?: string; name?: string; currentLevel?: number; highestLevel?: number; highestScore?: number };
  if (!payload.id) return Response.json({ error: "缺少游戏记录" }, { status: 400 });
  const currentLevel = Math.max(1, Math.floor(payload.currentLevel ?? 1));
  const highestLevel = Math.max(currentLevel, Math.floor(payload.highestLevel ?? currentLevel));
  const highestScore = Math.max(0, Math.floor(payload.highestScore ?? 0));
  const [updated] = await getDb().update(games).set({
    name: cleanName(payload.name ?? "奶龙"),
    currentLevel,
    highestLevel,
    highestScore,
    updatedAt: new Date().toISOString(),
  }).where(and(eq(games.id, payload.id), eq(games.userId, user.id))).returning();
  if (!updated) return Response.json({ error: "没有找到这个游戏" }, { status: 404 });
  return Response.json({ game: updated });
}

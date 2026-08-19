import { getSessionUser } from "@/app/lib/auth";
import {
  GameRecord,
  gameKey,
  gamePrefix,
  listJSON,
  publicAssetUrl,
  readJSON,
  writeJSON,
} from "@/app/lib/store";

export const runtime = "nodejs";

function cleanName(value: string) {
  return value.replace(/消消乐/g, "").trim().slice(0, 10) || "奶龙";
}

function toClientGame(game: GameRecord) {
  return {
    ...game,
    normalAssets: game.normalAssetKeys.map(publicAssetUrl),
    bossAsset: game.bossAssetKey ? publicAssetUrl(game.bossAssetKey) : null,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const games = await listJSON<GameRecord>(gamePrefix(user.id));
  games.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return Response.json({ games: games.map(toClientGame) });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = await request.json() as { name?: string };
  const now = new Date().toISOString();
  const game: GameRecord = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: cleanName(payload.name ?? "奶龙"),
    currentLevel: 1,
    highestLevel: 1,
    highestScore: 0,
    normalAssetKeys: [],
    bossAssetKey: null,
    createdAt: now,
    updatedAt: now,
  };
  await writeJSON(gameKey(user.id, game.id), game);
  return Response.json({ game: toClientGame(game) }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = await request.json() as { id?: string; name?: string; currentLevel?: number; highestLevel?: number; highestScore?: number };
  if (!payload.id) return Response.json({ error: "缺少游戏记录" }, { status: 400 });

  const key = gameKey(user.id, payload.id);
  const existing = await readJSON<GameRecord>(key);
  if (!existing || existing.userId !== user.id) return Response.json({ error: "没有找到这个游戏" }, { status: 404 });

  const currentLevel = Math.max(1, Math.floor(payload.currentLevel ?? existing.currentLevel));
  const updated: GameRecord = {
    ...existing,
    name: cleanName(payload.name ?? existing.name),
    currentLevel,
    highestLevel: Math.max(existing.highestLevel, currentLevel, Math.floor(payload.highestLevel ?? currentLevel)),
    highestScore: Math.max(existing.highestScore, Math.floor(payload.highestScore ?? 0)),
    updatedAt: new Date().toISOString(),
  };
  await writeJSON(key, updated);
  return Response.json({ game: toClientGame(updated) });
}

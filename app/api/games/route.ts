import { getSessionUser } from "@/app/lib/auth";
import {
  assetUrl,
  GameRecord,
  gameKey,
  gamePrefix,
  listJSON,
  readJSON,
  writeJSON,
} from "@/app/lib/store";

export const runtime = "nodejs";

function cleanName(value: string) {
  return value.replace(/消消乐/g, "").trim().slice(0, 10) || "奶龙";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalInteger(value: unknown, minimum: number) {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;
}

function toClientGame(game: GameRecord) {
  return {
    ...game,
    normalAssets: game.normalAssetKeys.map(assetUrl),
    bossAsset: game.bossAssetKey ? assetUrl(game.bossAssetKey) : null,
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
  const rawPayload: unknown = await request.json();
  if (!isObject(rawPayload) || (rawPayload.name !== undefined && typeof rawPayload.name !== "string")) {
    return Response.json({ error: "游戏名称格式不正确" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const game: GameRecord = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: cleanName(rawPayload.name ?? "奶龙"),
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
  const rawPayload: unknown = await request.json();
  if (!isObject(rawPayload) || typeof rawPayload.id !== "string" || !rawPayload.id) {
    return Response.json({ error: "缺少游戏记录" }, { status: 400 });
  }
  if (rawPayload.name !== undefined && typeof rawPayload.name !== "string") {
    return Response.json({ error: "游戏名称格式不正确" }, { status: 400 });
  }

  const requestedCurrentLevel = optionalInteger(rawPayload.currentLevel, 1);
  const requestedHighestLevel = optionalInteger(rawPayload.highestLevel, 1);
  const requestedHighestScore = optionalInteger(rawPayload.highestScore, 0);
  if (requestedCurrentLevel === null || requestedHighestLevel === null || requestedHighestScore === null) {
    return Response.json({ error: "游戏进度格式不正确" }, { status: 400 });
  }

  const key = gameKey(user.id, rawPayload.id);
  const existing = await readJSON<GameRecord>(key);
  if (!existing || existing.userId !== user.id) return Response.json({ error: "没有找到这个游戏" }, { status: 404 });

  const currentLevel = requestedCurrentLevel ?? existing.currentLevel;
  const updated: GameRecord = {
    ...existing,
    name: cleanName(rawPayload.name ?? existing.name),
    currentLevel,
    highestLevel: Math.max(existing.highestLevel, currentLevel, requestedHighestLevel ?? currentLevel),
    highestScore: Math.max(existing.highestScore, requestedHighestScore ?? 0),
    updatedAt: new Date().toISOString(),
  };
  await writeJSON(key, updated);
  return Response.json({ game: toClientGame(updated) });
}

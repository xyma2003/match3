import { getSessionUser } from "@/app/lib/auth";
import {
  assetKey,
  assetUrl,
  deleteKey,
  GameRecord,
  gameKey,
  readAsset,
  readJSON,
  writeAsset,
  writeJSON,
} from "@/app/lib/store";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// EdgeOne Node Functions accept request bodies up to 6 MB. Keep room for multipart metadata.
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith(`assets/${user.id}/`)) return new Response("Not found", { status: 404 });
  const asset = await readAsset(key);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset, {
    headers: {
      "Content-Type": asset.type || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const form = await request.formData();
  const gameId = String(form.get("gameId") ?? "");
  const tier = String(form.get("tier") ?? "") as "normal" | "boss";
  if (!gameId || !["normal", "boss"].includes(tier)) return Response.json({ error: "上传信息不完整" }, { status: 400 });

  const key = gameKey(user.id, gameId);
  const game = await readJSON<GameRecord>(key);
  if (!game || game.userId !== user.id) return Response.json({ error: "没有找到这个游戏" }, { status: 404 });

  const maxFiles = tier === "boss" ? 1 : 5;
  const files = form.getAll("files").filter((value): value is File => value instanceof File).slice(0, maxFiles);
  if (!files.length) return Response.json({ error: "请选择图片" }, { status: 400 });
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
    return Response.json({ error: "仅支持不超过 5MB 的 JPG、PNG、WebP 或 GIF 图片" }, { status: 400 });
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_REQUEST_BYTES) {
    return Response.json({ error: "一次上传的图片合计不能超过 5MB" }, { status: 400 });
  }

  const keys: string[] = [];
  const previousKeys = tier === "normal" ? game.normalAssetKeys : game.bossAssetKey ? [game.bossAssetKey] : [];
  try {
    for (const file of files) {
      const nextKey = assetKey(user.id, gameId, tier, file.name);
      keys.push(nextKey);
      await writeAsset(nextKey, file);
    }

    const updated: GameRecord = {
      ...game,
      normalAssetKeys: tier === "normal" ? keys : game.normalAssetKeys,
      bossAssetKey: tier === "boss" ? keys[0] : game.bossAssetKey,
      updatedAt: new Date().toISOString(),
    };
    await writeJSON(key, updated);
  } catch (error) {
    await Promise.allSettled(keys.map(deleteKey));
    throw error;
  }

  await Promise.allSettled(previousKeys.filter((previousKey) => !keys.includes(previousKey)).map(deleteKey));

  return Response.json({
    tier,
    assets: keys.map((asset) => ({ key: asset, url: assetUrl(asset) })),
  });
}

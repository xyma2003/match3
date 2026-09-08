import { createSession, hashPassword, sessionCookie, sha256, validatePassword, validateUsername } from "@/app/lib/auth";
import { createJSON, deleteKey, GameRecord, gameKey, UserRecord, usernameKey, writeJSON } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawPayload: unknown = await request.json();
    if (typeof rawPayload !== "object" || rawPayload === null || Array.isArray(rawPayload)) {
      return Response.json({ error: "注册信息格式不正确" }, { status: 400 });
    }
    const payload = rawPayload as Record<string, unknown>;
    const username = typeof payload.username === "string" ? payload.username : "";
    const plainPassword = typeof payload.password === "string" ? payload.password : "";
    const checked = validateUsername(username);
    if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
    const passwordError = validatePassword(plainPassword);
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });

    const userId = crypto.randomUUID();
    const password = await hashPassword(plainPassword);
    const now = new Date().toISOString();
    const user: UserRecord = {
      id: userId,
      username: checked.username,
      usernameNormalized: checked.normalized,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      recoveryEmail: null,
      createdAt: now,
      updatedAt: now,
    };
    const userKey = usernameKey(await sha256(checked.normalized));
    const created = await createJSON(userKey, user);
    if (!created) return Response.json({ error: "这个用户名已经被使用" }, { status: 409 });

    const game: GameRecord = {
      id: crypto.randomUUID(),
      userId,
      name: "奶龙",
      currentLevel: 1,
      highestLevel: 1,
      highestScore: 0,
      normalAssetKeys: [],
      bossAssetKey: null,
      createdAt: now,
      updatedAt: now,
    };
    const initialGameKey = gameKey(userId, game.id);
    try {
      await writeJSON(initialGameKey, game);
      const session = await createSession({ id: userId, username: user.username });
      return Response.json({ user: { id: userId, username: checked.username } }, {
        status: 201,
        headers: { "Set-Cookie": sessionCookie(session.token, request) },
      });
    } catch (error) {
      await Promise.allSettled([deleteKey(initialGameKey), deleteKey(userKey)]);
      throw error;
    }
  } catch {
    return Response.json({ error: "注册暂时不可用，请稍后重试" }, { status: 500 });
  }
}

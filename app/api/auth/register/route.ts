import { createSession, hashPassword, sessionCookie, sha256, validatePassword, validateRecoveryEmail, validateUsername } from "@/app/lib/auth";
import { createJSON, GameRecord, gameKey, UserRecord, usernameKey, writeJSON } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { username?: string; password?: string; recoveryEmail?: string };
    const checked = validateUsername(payload.username ?? "");
    if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
    const passwordError = validatePassword(payload.password ?? "");
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const recoveryEmail = (payload.recoveryEmail ?? "").trim().toLocaleLowerCase();
    const emailError = validateRecoveryEmail(recoveryEmail);
    if (emailError) return Response.json({ error: emailError }, { status: 400 });

    const userId = crypto.randomUUID();
    const password = await hashPassword(payload.password ?? "");
    const now = new Date().toISOString();
    const user: UserRecord = {
      id: userId,
      username: checked.username,
      usernameNormalized: checked.normalized,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      recoveryEmail: recoveryEmail || null,
      createdAt: now,
      updatedAt: now,
    };
    const created = await createJSON(usernameKey(await sha256(checked.normalized)), user);
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
    await writeJSON(gameKey(userId, game.id), game);
    const session = await createSession({ id: userId, username: user.username, recoveryEmail: user.recoveryEmail });
    return Response.json({ user: { id: userId, username: checked.username, recoveryEmail: recoveryEmail || null } }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(session.token, request) },
    });
  } catch {
    return Response.json({ error: "注册暂时不可用，请稍后重试" }, { status: 500 });
  }
}

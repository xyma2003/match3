import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { games, users } from "@/db/schema";
import { createSession, hashPassword, sessionCookie, validatePassword, validateRecoveryEmail, validateUsername } from "@/app/lib/auth";

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

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.usernameNormalized, checked.normalized)).limit(1);
    if (existing) return Response.json({ error: "这个用户名已经被使用" }, { status: 409 });

    const userId = crypto.randomUUID();
    const password = await hashPassword(payload.password ?? "");
    await db.insert(users).values({
      id: userId,
      username: checked.username,
      usernameNormalized: checked.normalized,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      recoveryEmail: recoveryEmail || null,
    });
    await db.insert(games).values({ id: crypto.randomUUID(), userId, name: "奶龙" });
    const session = await createSession(userId);
    return Response.json({ user: { id: userId, username: checked.username, recoveryEmail: recoveryEmail || null } }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(session.token, request) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败";
    if (message.includes("UNIQUE constraint failed")) return Response.json({ error: "这个用户名已经被使用" }, { status: 409 });
    return Response.json({ error: "注册暂时不可用，请稍后重试" }, { status: 500 });
  }
}

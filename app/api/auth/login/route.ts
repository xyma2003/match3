import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, normalizeUsername, sessionCookie, verifyPassword } from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { username?: string; password?: string };
    const username = (payload.username ?? "").trim().normalize("NFKC");
    const [user] = await getDb().select().from(users).where(eq(users.usernameNormalized, normalizeUsername(username))).limit(1);
    if (!user || !await verifyPassword(payload.password ?? "", user.passwordHash, user.passwordSalt, user.passwordIterations)) {
      return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
    }
    const session = await createSession(user.id);
    return Response.json({ user: { id: user.id, username: user.username, recoveryEmail: user.recoveryEmail } }, {
      headers: { "Set-Cookie": sessionCookie(session.token, request) },
    });
  } catch {
    return Response.json({ error: "登录暂时不可用，请稍后重试" }, { status: 500 });
  }
}

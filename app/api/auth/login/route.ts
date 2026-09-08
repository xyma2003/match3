import { createSession, findUserKey, sessionCookie, verifyPassword } from "@/app/lib/auth";
import { readJSON, UserRecord } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawPayload: unknown = await request.json();
    if (typeof rawPayload !== "object" || rawPayload === null || Array.isArray(rawPayload)) {
      return Response.json({ error: "登录信息格式不正确" }, { status: 400 });
    }
    const payload = rawPayload as Record<string, unknown>;
    const username = (typeof payload.username === "string" ? payload.username : "").trim().normalize("NFKC");
    const password = typeof payload.password === "string" ? payload.password : "";
    const user = await readJSON<UserRecord>(await findUserKey(username));
    if (!user || !await verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations)) {
      return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
    }
    const session = await createSession({ id: user.id, username: user.username });
    return Response.json({ user: { id: user.id, username: user.username } }, {
      headers: { "Set-Cookie": sessionCookie(session.token, request) },
    });
  } catch {
    return Response.json({ error: "登录暂时不可用，请稍后重试" }, { status: 500 });
  }
}

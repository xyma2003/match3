import { createSession, findUserKey, sessionCookie, verifyPassword } from "@/app/lib/auth";
import { readJSON, UserRecord } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { username?: string; password?: string };
    const username = (payload.username ?? "").trim().normalize("NFKC");
    const user = await readJSON<UserRecord>(await findUserKey(username));
    if (!user || !await verifyPassword(payload.password ?? "", user.passwordHash, user.passwordSalt, user.passwordIterations)) {
      return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
    }
    const session = await createSession({ id: user.id, username: user.username, recoveryEmail: user.recoveryEmail });
    return Response.json({ user: { id: user.id, username: user.username, recoveryEmail: user.recoveryEmail } }, {
      headers: { "Set-Cookie": sessionCookie(session.token, request) },
    });
  } catch {
    return Response.json({ error: "登录暂时不可用，请稍后重试" }, { status: 500 });
  }
}

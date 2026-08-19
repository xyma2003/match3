import { getSessionUser } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    return user ? Response.json({ user }) : Response.json({ user: null }, { status: 401 });
  } catch {
    return Response.json({ user: null }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const LOGIN = process.env.HR_LOGIN || "admin";
const PASSWORD = process.env.HR_PASSWORD || "roomers2024";
const SESSION_TOKEN = "hr_session";

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();

  if (login === LOGIN && password === PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_TOKEN, "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Неверный логин или пароль" }, { status: 401 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_TOKEN);
  return NextResponse.json({ ok: true });
}

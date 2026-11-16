import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/server/auth";
import { authorizeUrl, withingsConfigured } from "@/lib/server/withings";

/** Starts the Withings sign-in. */
export async function GET(req: Request) {
  if (!(await isSignedIn())) return NextResponse.redirect(new URL("/login", req.url));
  if (!withingsConfigured()) return NextResponse.redirect(new URL("/progress?withings=not-configured", req.url));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("withings_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}

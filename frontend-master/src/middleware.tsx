import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("refreshToken");

  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.value.split(".")[1], "base64").toString(),
      );
      const role = payload.role as string | undefined;
      const pathname = req.nextUrl.pathname;

      // Jika user sudah login dan mengunjungi /login, lempar sesuai role
      if (pathname === "/login" && role) {
        if (role === "MANAGER")
          return NextResponse.redirect(new URL("/admin/monitoring", req.url));
        if (role === "MAHASISWA")
          return NextResponse.redirect(
            new URL("/mahasiswa/timesheet", req.url),
          );
        if (role === "STAF")
          return NextResponse.redirect(new URL("/user/dashboard", req.url));
        if (role === "DIRMAWA")
          return NextResponse.redirect(new URL("/admin/monitoring", req.url));
      }

      // Proteksi prefix sesuai role
      if (role === "MANAGER" && !pathname.startsWith("/admin"))
        return NextResponse.redirect(new URL("/admin/monitoring", req.url));
      if (role === "MAHASISWA" && !pathname.startsWith("/mahasiswa"))
        return NextResponse.redirect(new URL("/mahasiswa/timesheet", req.url));
      if (role === "STAF" && !pathname.startsWith("/user"))
        return NextResponse.redirect(new URL("/user/dashboard", req.url));
      if (role === "DIRMAWA" && !pathname.startsWith("/admin"))
        return NextResponse.redirect(new URL("/admin/monitoring", req.url));

      // Arahkan root "/" sesuai role
      if (pathname === "/" && role) {
        if (role === "MANAGER" || role === "DIRMAWA")
          return NextResponse.redirect(new URL("/admin/monitoring", req.url));
        if (role === "MAHASISWA")
          return NextResponse.redirect(
            new URL("/mahasiswa/timesheet", req.url),
          );
        if (role === "STAF")
          return NextResponse.redirect(new URL("/user/dashboard", req.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } else {
    if (req.nextUrl.pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/mahasiswa/:path*",
    "/user/:path*",
    "/",
    "/login",
  ],
};

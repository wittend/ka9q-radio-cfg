// src/auth.ts

export function basicAuthGuard(
  req: Request,
  user: string,
  pass: string,
): Response | null {
  const hdr = req.headers.get("authorization");
  if (!hdr || !hdr.toLowerCase().startsWith("basic ")) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "www-authenticate": `Basic realm="Config Editor"` },
    });
  }
  try {
    const decoded = atob(hdr.slice(6));
    const [u, p] = decoded.split(":");
    if (u === user && p === pass) return null;
  } catch {
    // fall through
  }
  return new Response("Unauthorized", {
    status: 401,
    headers: { "www-authenticate": `Basic realm="Config Editor"` },
  });
}

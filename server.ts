// server.ts
// Permissions needed: --allow-read --allow-write --allow-net --allow-env

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  dirname,
  join,
  relative,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { IniDoc, parseIniDoc, patchIniValues, toIniText } from "./src/ini.ts";
import {
  discoverConfigs,
  isSubPath,
  resolveWithFallback,
} from "./src/discovery.ts";
import { validateObject } from "./src/validate.ts";
import { renderHTML } from "./src/ui.ts";
import { basicAuthGuard } from "./src/auth.ts";

const PORT = Number(Deno.env.get("PORT") ?? "8787");
const CONFIG_ROOT = Deno.env.get("CONFIG_ROOT") ?? Deno.cwd();

const BASIC_AUTH_USER = Deno.env.get("BASIC_AUTH_USER");
const BASIC_AUTH_PASS = Deno.env.get("BASIC_AUTH_PASS");

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function ensureInsideRoot(absPath: string) {
  if (!isSubPath(CONFIG_ROOT, absPath)) {
    throw new Error("Path escapes root");
  }
}

async function readTextMaybe(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

function detectIniOrConf(path: string) {
  const lower = path.toLowerCase();
  return lower.endsWith(".ini") || lower.endsWith(".conf");
}

async function handleGetIndex(_req: Request): Promise<Response> {
  const discovered = await discoverConfigs(CONFIG_ROOT);
  const html = renderHTML({
    root: CONFIG_ROOT,
    discovered,
  });
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleGetFile(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rel = url.searchParams.get("path");
  if (!rel) return errorResponse("Missing path");
  const abs = join(CONFIG_ROOT, rel);
  ensureInsideRoot(abs);

  const resolved = await resolveWithFallback(abs);
  if (!resolved) return errorResponse("Not found", 404);

  const text = await Deno.readTextFile(resolved.actualPath);
  const iniDoc = parseIniDoc(text);

  return jsonResponse({
    requestedPath: rel,
    actualPath: relative(CONFIG_ROOT, resolved.actualPath),
    baseExists: resolved.baseExists,
    source: detectIniOrConf(resolved.actualPath) ? "ini" : "unknown",
    doc: iniDoc.data,
    raw: text,
  });
}

async function handleSave(req: Request): Promise<Response> {
  const body = await req.json();
  const {
    path, // relative to CONFIG_ROOT
    data, // parsed object
    preserve = true,
    schema, // optional schema
  } = body ?? {};

  if (!path || typeof path !== "string") return errorResponse("Missing path");
  const abs = join(CONFIG_ROOT, path);
  ensureInsideRoot(abs);

  if (schema) {
    const result = validateObject(data, schema);
    if (!result.valid) {
      return jsonResponse({ ok: false, errors: result.errors }, 422);
    }
  }

  let outputText: string;
  if (preserve) {
    const existing = await readTextMaybe(abs);
    if (existing) {
      const patched = patchIniValues(existing, data);
      outputText = patched.text;
    } else {
      // If base doesn't exist, write a fresh INI
      outputText = toIniText(data);
    }
  } else {
    outputText = toIniText(data);
  }

  await Deno.mkdir(dirname(abs), { recursive: true });
  await Deno.writeTextFile(abs, outputText);
  return jsonResponse({ ok: true, bytes: outputText.length });
}

async function handleSaveAs(req: Request): Promise<Response> {
  const body = await req.json();
  const {
    fromPath, // ref to original (optional)
    toPath, // required
    data,
    preserve = true,
    schema,
  } = body ?? {};
  if (!toPath) return errorResponse("Missing toPath");

  const absTo = join(CONFIG_ROOT, toPath);
  ensureInsideRoot(absTo);

  if (schema) {
    const result = validateObject(data, schema);
    if (!result.valid) {
      return jsonResponse({ ok: false, errors: result.errors }, 422);
    }
  }

  let outputText: string | null = null;
  if (preserve && fromPath) {
    const absFrom = join(CONFIG_ROOT, fromPath);
    ensureInsideRoot(absFrom);
    const existing = await readTextMaybe(absFrom);
    if (existing) {
      outputText = patchIniValues(existing, data).text;
    }
  }
  if (!outputText) {
    outputText = toIniText(data);
  }

  await Deno.mkdir(dirname(absTo), { recursive: true });
  await Deno.writeTextFile(absTo, outputText);
  return jsonResponse({ ok: true, bytes: outputText.length });
}

async function handleBrowse(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rel = url.searchParams.get("dir") ?? "";
  const abs = join(CONFIG_ROOT, rel);
  ensureInsideRoot(abs);

  let entries: Array<{ name: string; path: string; type: "file" | "dir" }> = [];
  try {
    for await (const e of Deno.readDir(abs)) {
      const p = join(rel, e.name);
      entries.push({
        name: e.name,
        path: p,
        type: e.isDirectory ? "dir" : "file",
      });
    }
  } catch {
    return errorResponse("Cannot read directory", 400);
  }

  entries.sort((
    a,
    b,
  ) => (a.type === b.type
    ? a.name.localeCompare(b.name)
    : a.type === "dir"
    ? -1
    : 1)
  );
  return jsonResponse({ dir: rel, entries });
}

function isLocalhostRequest(req: Request): boolean {
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
}

function applyAuth(req: Request): Response | null {
  if (!isLocalhostRequest(req) && BASIC_AUTH_USER && BASIC_AUTH_PASS) {
    const auth = basicAuthGuard(req, BASIC_AUTH_USER, BASIC_AUTH_PASS);
    if (auth) return auth;
  }
  return null;
}

function route(req: Request): Promise<Response> | Response {
  const maybeAuth = applyAuth(req);
  if (maybeAuth) return maybeAuth;

  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/") return handleGetIndex(req);
  if (req.method === "GET" && pathname === "/api/file") {
    return handleGetFile(req);
  }
  if (req.method === "POST" && pathname === "/api/save") {
    return handleSave(req);
  }
  if (req.method === "POST" && pathname === "/api/save-as") {
    return handleSaveAs(req);
  }
  if (req.method === "GET" && pathname === "/api/browse") {
    return handleBrowse(req);
  }

  // Serve client assets
  if (
    req.method === "GET" &&
    (pathname === "/app.js" || pathname === "/style.css")
  ) {
    const file = pathname === "/app.js"
      ? "./static/app.js"
      : "./static/style.css";
    return Deno.readTextFile(file)
      .then((text) =>
        new Response(text, {
          headers: {
            "content-type": contentType(pathname.split(".").pop() || "text") ||
              "text/plain",
          },
        })
      )
      .catch(() => new Response("Not found", { status: 404 }));
  }

  return new Response("Not found", { status: 404 });
}

console.log(`Config root: ${CONFIG_ROOT}`);
console.log(`Listening on http://localhost:${PORT}`);
serve(route, { port: PORT });

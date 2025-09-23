// src/discovery.ts
import { extname, join, relative, resolve } from "https://deno.land/std@0.224.0/path/mod.ts";

const INI_LIKE = new Set([".ini", ".conf"]);
const FALLBACKS = [".conf.example", ".conf.template", ".ini.example", ".ini.template"];

export async function discoverConfigs(root: string): Promise<string[]> {
    const out: string[] = [];
    for await (const entry of walkSafe(root)) {
        if (entry.isFile) {
            const ext = extname(entry.path).toLowerCase();
            if (INI_LIKE.has(ext)) out.push(relative(root, entry.path));
        }
    }
    out.sort();
    return out;
}

export async function resolveWithFallback(absPath: string): Promise<{ actualPath: string; baseExists: boolean } | null> {
    try {
        await Deno.stat(absPath);
        return { actualPath: absPath, baseExists: true };
    } catch {
        // try fallbacks
        for (const fb of FALLBACKS) {
            const candidate = absPath + fb.substring(extname(absPath).length); // replace ext with .conf.example style
            try {
                await Deno.stat(candidate);
                return { actualPath: candidate, baseExists: false };
            } catch { /* continue */ }
        }
        return null;
    }
}

async function* walkSafe(root: string): AsyncGenerator<Deno.DirEntry & { path: string }> {
    const stack: string[] = [resolve(root)];
    while (stack.length) {
        const dir = stack.pop()!;
        try {
            for await (const e of Deno.readDir(dir)) {
                const path = join(dir, e.name);
                if (e.isDirectory) {
                    stack.push(path);
                }
                yield Object.assign(e, { path });
            }
        } catch {
            // ignore unreadable dirs
        }
    }
}

export function isSubPath(root: string, candidate: string): boolean {
    const r = resolve(root);
    const c = resolve(candidate);
    return c === r || c.startsWith(r + "/");
}
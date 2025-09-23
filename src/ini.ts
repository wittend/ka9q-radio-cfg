// src/ini.ts
// Simple INI parse/serialize with best-effort preserve-format patching.

export type IniPrimitive = string | number | boolean | null;
export type IniValue = IniPrimitive | IniValue[] | { [k: string]: IniValue };
export interface IniDoc { data: Record<string, IniValue>; }

const SECTION_RE = /^\s*\[\s*([^\]]+)\s*\]\s*$/;
const KEYVAL_RE = /^\s*([^=:#]+?)\s*[:=]\s*(.*?)\s*$/;
const COMMENT_RE = /^\s*[#;].*$/;

function parseScalar(raw: string): IniPrimitive
{
    // booleans
    const low = raw.trim().toLowerCase();
    if (low === "true" || low === "yes" || low === "on") return true;
    if (low === "false" || low === "no" || low === "off") return false;
    // numbers
    if (/^[+-]?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw.trim());
    // null-like
    if (low === "null" || low === "nil" || low === "none") return null;
    // Return the raw string value
    return raw;
}

function serializeScalar(v: IniPrimitive): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v);
}

export function parseIniDoc(text: string): IniDoc {
  const data: Record<string, IniValue> = {};
  let current: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || COMMENT_RE.test(line)) continue;
    const sec = line.match(SECTION_RE);
    if (sec) {
      current = sec[1].trim();
      if (!data[current]) data[current] = {};
      continue;
    }
    const kv = line.match(KEYVAL_RE);
    if (kv) {
      const key = kv[1].trim();
      const val = parseScalar(kv[2] ?? "");
      if (!current) {
        data[key] = val;
      } else {
        if (typeof data[current] !== "object" || Array.isArray(data[current])) {
          data[current] = {};
        }
        (data[current] as Record<string, IniValue>)[key] = val;
      }
    }
  }
  return { data };
}

function flatten(data: Record<string, IniValue>): Record<string, IniPrimitive> {
  const flat: Record<string, IniPrimitive> = {};
  function walk(prefix: string[], v: IniValue) {
    if (Array.isArray(v)) {
      flat[prefix.join(".")] = v.map((x) => serializeScalar(x as IniPrimitive)).join(", ");
    } else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        walk(prefix.concat(k), val);
      }
    } else {
      flat[prefix.join(".")] = v as IniPrimitive;
    }
  }
  for (const [k, v] of Object.entries(data)) walk([k], v);
  return flat;
}

export function toIniText(data: Record<string, IniValue>): string {
  const top: Record<string, IniValue> = {};
  const sections: Record<string, Record<string, IniValue>> = {};

  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      sections[k] = v as Record<string, IniValue>;
    } else {
      top[k] = v;
    }
  }

  const lines: string[] = [];
  for (const [k, v] of Object.entries(top)) {
    lines.push(`${k} = ${serializeScalar(v as IniPrimitive)}`);
  }
  if (Object.keys(top).length && Object.keys(sections).length) lines.push("");

  for (const [sec, kvs] of Object.entries(sections)) {
    lines.push(`[${sec}]`);
    for (const [k, v] of Object.entries(kvs)) {
      if (Array.isArray(v)) {
        lines.push(`${k} = ${v.map((x) => serializeScalar(x as IniPrimitive)).join(", ")}`);
      } else if (v && typeof v === "object") {
        // nested objects -> dotted keys
        for (const [nk, nv] of Object.entries(v)) {
          lines.push(`${k}.${nk} = ${serializeScalar(nv as IniPrimitive)}`);
        }
      } else {
        lines.push(`${k} = ${serializeScalar(v as IniPrimitive)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/,"") + "\n";
}

export function patchIniValues(original: string, data: Record<string, IniValue>): { text: string } {
  // Best-effort: replace scalar RHS where we can find exact key lines; keep comments/layout.
  const flat = flatten(data);
  const lines = original.split(/\r?\n/);
  const assigned = new Set<string>();

  let currentSec: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sec = line.match(SECTION_RE);
    if (sec) {
      currentSec = sec[1].trim();
      continue;
    }
    if (COMMENT_RE.test(line) || !line.trim()) continue;

    const kv = line.match(KEYVAL_RE);
    if (!kv) continue;

    let key = kv[1].trim();
    const rhs = kv[2] ?? "";

    // Resolve dotted keys relative to section
    const compound = currentSec ? `${currentSec}.${key}` : key;

    if (Object.prototype.hasOwnProperty.call(flat, compound)) {
      const newVal = serializeScalar(flat[compound]);
      const left = line.slice(0, line.indexOf(rhs));
      const commentSplit = rhs.split(/(?=[#;])/); // preserve inline comments
      const inlineComment = commentSplit.length > 1 ? commentSplit.slice(1).join("") : "";
      lines[i] = `${left}${newVal}${inlineComment ? " " + inlineComment.trimStart() : ""}`;
      assigned.add(compound);
    } else if (Object.prototype.hasOwnProperty.call(flat, key)) {
      const newVal = serializeScalar(flat[key]);
      const left = line.slice(0, line.indexOf(rhs));
      const commentSplit = rhs.split(/(?=[#;])/);
      const inlineComment = commentSplit.length > 1 ? commentSplit.slice(1).join("") : "";
      lines[i] = `${left}${newVal}${inlineComment ? " " + inlineComment.trimStart() : ""}`;
      assigned.add(key);
    }
  }

  // Append missing keys conservatively at end within sections
  const missing = Object.keys(flat).filter((k) => !assigned.has(k));
  if (missing.length) {
    const out = [...lines];
    out.push("");
    out.push("; Added by editor:");
    const bySection: Record<string, Array<[string, string]>> = {};
    for (const k of missing) {
      const parts = k.split(".");
      if (parts.length > 1) {
        const sec = parts[0];
        const kk = parts.slice(1).join(".");
        (bySection[sec] ||= []).push([kk, serializeScalar(flat[k])]);
      } else {
        (bySection[""] ||= []).push([k, serializeScalar(flat[k])]);
      }
    }
    if (bySection[""]) {
      for (const [k, v] of bySection[""]) out.push(`${k} = ${v}`);
      delete bySection[""];
      out.push("");
    }
    for (const [sec, entries] of Object.entries(bySection)) {
      out.push(`[${sec}]`);
      for (const [k, v] of entries) out.push(`${k} = ${v}`);
      out.push("");
    }
    return { text: out.join("\n") };
  }
  return { text: lines.join("\n") };
}
// src/validate.ts

type Rule =
  | {
    type: "string";
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
  }
  | { type: "number"; minimum?: number; maximum?: number; integer?: boolean }
  | { type: "boolean" }
  | { type: "array"; items?: Rule }
  | { type: "object"; properties?: Record<string, Rule>; required?: string[] }
  | { type: "any" };

export function validateObject(
  data: unknown,
  schema: Rule,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  function check(value: unknown, rule: Rule, path: string) {
    switch (rule.type) {
      case "any":
        return;
      case "boolean":
        if (typeof value !== "boolean") errors.push(`${path} must be boolean`);
        return;
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          errors.push(`${path} must be number`);
          return;
        }
        if (rule.integer && !Number.isInteger(value)) {
          errors.push(`${path} must be integer`);
        }
        if (rule.minimum !== undefined && value < rule.minimum) {
          errors.push(`${path} >= ${rule.minimum}`);
        }
        if (rule.maximum !== undefined && value > rule.maximum) {
          errors.push(`${path} <= ${rule.maximum}`);
        }
        return;
      case "string":
        if (typeof value !== "string") {
          errors.push(`${path} must be string`);
          return;
        }
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(`${path} length >= ${rule.minLength}`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push(`${path} length <= ${rule.maxLength}`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${path} must be one of ${rule.enum.join(", ")}`);
        }
        if (rule.pattern) {
          const re = new RegExp(rule.pattern);
          if (!re.test(value)) {
            errors.push(`${path} must match ${rule.pattern}`);
          }
        }
        return;
      case "array":
        if (!Array.isArray(value)) {
          errors.push(`${path} must be array`);
          return;
        }
        if (rule.items) {
          value.forEach((v, i) => check(v, rule.items!, `${path}[${i}]`));
        }
        return;
      case "object": {
        if (
          !value ||
          typeof value !==
            "object" ||
          Array.isArray(value)
        ) {
          errors.push(`${path} must be object`);
          return;
        }
        const obj = value as Record<string, unknown>;
        if (rule.required) {
          for (const k of rule.required) {
            if (
              !(k in
                obj)
            ) errors.push(`${path}.${k} is required`);
          }
        }
        if (rule.properties) {
          for (const [k, r] of Object.entries(rule.properties)) {
            if (
              k in
                obj
            ) check(obj[k], r, path ? `${path}.${k}` : k);
          }
        }
        return;
      }
    }
  }
  check(data, schema, "");
  return { valid: errors.length === 0, errors };
}

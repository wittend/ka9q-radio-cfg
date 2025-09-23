# ka9q-cfg — Web INI/CONF Editor for Deno

A small Deno-based web app to browse, view, edit, and save `.ini` / `.conf` files. It preserves formatting and comments where possible, renders nested structures as an HTML form with sensible input types, and supports optional Basic Auth when accessed remotely.

- Opens target config or falls back to `.conf.example` / `.conf.template` variants
- Best-effort preserve-format patching of scalar values in original INI text
- Renders objects/arrays to HTML forms (checkbox/number/date/datetime-local/color/email/url/password/text)
- Save and Save As (write to original or new path)
- Directory browser to discover config files under a chosen root
- Pluggable, minimal validation (min/max, pattern, enum, required, type)
- Optional Basic Auth when not on localhost

## Quick start

Requirements:
- Deno 1.45+ (or latest stable)

Run:
```
bash deno task dev
# then open [http://localhost:8787](http://localhost:8787)
```

Optional environment:
- `CONFIG_ROOT`: Root directory to search and edit configs (default: current working directory)
- `PORT`: HTTP port (default: 8787)
- `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`: Enable Basic Auth for non-localhost access

Example:

```aiignore
bash CONFIG_ROOT=/etc/myapp PORT=8080 BASIC_AUTH_USER=admin BASIC_AUTH_PASS=secret deno task dev
```
## Usage

- Home page lists discovered `.ini`/`.conf` files found under `CONFIG_ROOT`.
- Use the path field to open a file by relative path (e.g., `etc/app.conf`).
- If the file doesn’t exist, the app tries: `.conf.example`, `.conf.template`, `.ini.example`, `.ini.template`.
- Edit values in the generated form:
    - Booleans → checkbox
    - Likely numeric fields → number
    - email/url/color/date/datetime-local/password → appropriate HTML input
    - Other values → text
- Save:
    - Save writes to the given relative path
    - Save As writes to a new path
    - Preserve format keeps comments/spacing where reasonable by patching scalar values
- Browse:
    - Use the Browse pane to navigate directories and open files

## Validation

You can send a small schema with save requests to enforce constraints (type, enum, min/max, pattern, required). The server will reject invalid data with 422 and a list of errors.

Schema shape (example):
```
json 
{ 
    "type": "object", 
    "required": ["server", "port"], 
    "properties": 
    { 
        "server": 
        { 
            "type": "string", 
            "minLength": 1 
        }, 
        "port": 
        { 
            "type": "number", 
            "minimum": 1, 
            "maximum": 65535, 
            "integer": true 
        }, 
        "email": 
        { 
            "type": "string", 
            "pattern": "^[^@]+@[^@]+\.[^@]+$" 
        }, 
        "mode": 
        { 
            "type": "string", 
            "enum": ["dev", "prod"] 
        } 
    } 
}
```
n the default UI, the schema payload is null. You can wire your own schema on the client side by populating the `schema` field in the Save/Save As requests.

## Permissions

The app needs:
- `--allow-read`: read configs and static files
- `--allow-write`: save changes
- `--allow-net`: serve HTTP
- `--allow-env`: read environment variables

These are provided by the `deno task dev` command.

## Project layout

- `server.ts` — HTTP server and API endpoints
- `src/ini.ts` — INI parser, serializer, preserve-format patcher
- `src/discovery.ts` — tree walk, fallbacks, path safety
- `src/validate.ts` — tiny schema validator
- `src/auth.ts` — Basic Auth helper
- `src/ui.ts` — server-side HTML shell
- `static/app.js` — client-side app (form rendering, actions)
- `static/style.css` — basic styling
- `deno.json` — tasks and imports

## Tests
```
bash deno task test
```
## Security notes

- Basic Auth activates only when not accessed from localhost and both `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` are set.
- Paths are constrained to `CONFIG_ROOT`; attempts to escape the root are rejected.

## Limitations

- Preserve-format is best-effort and focuses on scalar key/value lines; complex edge cases may not be fully preserved.
- Arrays are handled in a pragmatic way; nested objects are represented via dotted keys on serialization.

## License

MIT. Contributions welcome.
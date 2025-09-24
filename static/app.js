// static/app.js

const formEl = document.getElementById("form");
const rawEl = document.getElementById("raw");
const pathEl = document.getElementById("path");
const openBtn = document.getElementById("open");
const saveBtn = document.getElementById("save");
const saveAsBtn = document.getElementById("saveas");
const saveAsPathEl = document.getElementById("saveas-path");
const preserveEl = document.getElementById("preserve");
const browseBtn = document.getElementById("browse-btn");
const dirInput = document.getElementById("dir-input");
const browseList = document.getElementById("browse-list");
const treeRoot = document.getElementById("tree");

let currentDoc = null;
let currentActualPath = null;

// Build clickable tree from discovered files
if(treeRoot)
{
    const files = JSON.parse(treeRoot.dataset.files || "[]");
    const model = buildTreeModel(files);
    const treeEl = renderTree(model);
    treeRoot.appendChild(treeEl);
}

function buildTreeModel(paths)
{
    const root = {name: "/", type: "dir", children: {}};
    for(const p of paths)
    {
        const parts = p.split("/").filter(Boolean);
        let node = root;
        for(let i = 0; i < parts.length; i ++)
        {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            if(isLast)
            {
                node.children[part] = {name: part, type: "file", path: p, sections: null};
            }
            else
            {
                node.children[part] ||= {name: part, type: "dir", children: {}};
                node = node.children[part];
            }
        }
    }
    return root;
}

function renderTree(node)
{
    const ul = document.createElement("ul");
    for(const child of Object.values(node.children))
    {
        const li = document.createElement("li");
        const line = document.createElement("span");
        line.className = "node";
        
        if(child.type === "dir")
        {
            const toggle = document.createElement("span");
            toggle.textContent = "▸";
            toggle.className = "toggle";
            const name = document.createElement("span");
            name.textContent = child.name;
            name.className = "folder";
            
            const sub = renderTree(child);
            sub.style.display = "none";
            
            const open = () =>
            {
                const isOpen = sub.style.display !== "none";
                sub.style.display = isOpen ? "none" : "";
                toggle.textContent = isOpen ? "▸" : "▾";
            };
            toggle.addEventListener("click", open);
            name.addEventListener("click", open);
            
            line.appendChild(toggle);
            line.appendChild(name);
            li.appendChild(line);
            li.appendChild(sub);
        }
        else if(child.type === "file")
        {
            const toggle = document.createElement("span");
            toggle.textContent = "▸";
            toggle.className = "toggle";
            const name = document.createElement("span");
            name.textContent = child.name;
            name.className = "file";
            name.addEventListener("click", async() =>
            {
                pathEl.value = child.path;
                await openFile(child.path);
                // populate sections if not loaded
                const sections = Object.keys(currentDoc || {}).filter(k => typeof (currentDoc[k]) === "object" && !Array.isArray(currentDoc[k]));
                child.sections = sections;
                const sub = li.querySelector("ul") || document.createElement("ul");
                sub.innerHTML = "";
                for(const s of sections)
                {
                    const sli = document.createElement("li");
                    const sspan = document.createElement("span");
                    sspan.textContent = s;
                    sspan.className = "section";
                    sspan.addEventListener("click", () => scrollToSection(s));
                    sli.appendChild(sspan);
                    sub.appendChild(sli);
                }
                if( !li.querySelector("ul"))
                {
                    li.appendChild(sub);
                }
                sub.style.display = "";
                toggle.textContent = "▾";
            });
            
            const sub = document.createElement("ul");
            sub.style.display = "none";
            
            const toggleOpen = () =>
            {
                const isOpen = sub.style.display !== "none";
                if(isOpen)
                {
                    sub.style.display = "none";
                    toggle.textContent = "▸";
                }
                else
                {
                    // If sections known, just toggle. Otherwise click filename to load sections.
                    if(child.sections)
                    {
                        sub.style.display = "";
                        toggle.textContent = "▾";
                    }
                    else
                    {
                        name.click();
                    }
                }
            };
            toggle.addEventListener("click", toggleOpen);
            
            line.appendChild(toggle);
            line.appendChild(name);
            li.appendChild(line);
            li.appendChild(sub);
        }
        ul.appendChild(li);
    }
    return ul;
}

function scrollToSection(sectionName)
{
    // Find fieldset legend matching section
    const legends = formEl.querySelectorAll("legend");
    for(const lg of legends)
    {
        if(lg.textContent === sectionName)
        {
            lg.scrollIntoView({behavior: "smooth", block: "start"});
            lg.style.background = "rgba(255, 230, 150, 0.7)";
            setTimeout(() => (lg.style.background = ""), 800);
            break;
        }
    }
}

// Existing click handlers for inline "Discovered" list are removed since tree replaces it

browseBtn.addEventListener("click", async() =>
{
    const dir = dirInput.value.trim();
    const res = await fetch(`/api/browse?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();
    browseList.innerHTML = "";
    for(const e of data.entries)
    {
        const li = document.createElement("li");
        if(e.type === "dir")
        {
            const b = document.createElement("button");
            b.textContent = e.path + "/";
            b.className = "file-link";
            b.addEventListener("click", () =>
            {
                dirInput.value = e.path;
                browseBtn.click();
            });
            li.appendChild(b);
        }
        else if(e.path.endsWith(".ini") || e.path.endsWith(".conf"))
        {
            const b = document.createElement("button");
            b.textContent = e.path;
            b.className = "file-link";
            b.addEventListener("click", () =>
            {
                pathEl.value = e.path;
                openBtn.click();
            });
            li.appendChild(b);
        }
        else
        {
            li.textContent = e.path;
        }
        browseList.appendChild(li);
    }
});

openBtn.addEventListener("click", async() =>
{
    const p = pathEl.value.trim();
    if( !p)
    {
        return alert("Enter a relative path");
    }
    await openFile(p);
});

async function openFile(p)
{
    const res = await fetch(`/api/file?path=${encodeURIComponent(p)}`);
    if( !res.ok)
    {
        const t = await res.text();
        alert("Open failed: " + t);
        return;
    }
    const data = await res.json();
    currentDoc = data.doc || {};
    currentActualPath = data.actualPath;
    rawEl.textContent = data.raw || "";
    formEl.innerHTML = "";
    buildForm(formEl, currentDoc, "");
}

saveBtn.addEventListener("click", async() =>
{
    if( !pathEl.value.trim())
    {
        return alert("No path");
    }
    const payload = {
        path: pathEl.value.trim(),
        data: valueFromForm(formEl),
        preserve: preserveEl.checked,
        schema: null,
    };
    const res = await fetch("/api/save", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(payload)
    });
    const j = await res.json();
    if( !res.ok || j.ok === false)
    {
        alert("Save failed: " + JSON.stringify(j));
    }
    else
    {
        alert("Saved");
        openBtn.click();
    }
});

saveAsBtn.addEventListener("click", async() =>
{
    const toPath = saveAsPathEl.value.trim();
    if( !toPath)
    {
        return alert("Enter Save As path");
    }
    const payload = {
        fromPath: pathEl.value.trim(),
        toPath,
        data: valueFromForm(formEl),
        preserve: preserveEl.checked,
        schema: null,
    };
    const res = await fetch("/api/save-as", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(payload)
    });
    const j = await res.json();
    if( !res.ok || j.ok === false)
    {
        alert("Save As failed: " + JSON.stringify(j));
    }
    else
    {
        alert("Saved As");
    }
});

function buildForm(container, obj, path)
{
    if(Array.isArray(obj))
    {
        const fs = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = path || "(array)";
        fs.appendChild(legend);
        
        obj.forEach((item, index) =>
        {
            const row = document.createElement("div");
            row.className = "field";
            const label = document.createElement("label");
            label.textContent = `${index}`;
            row.appendChild(label);
            const input = inputForValue(`${path}[${index}]`, item);
            row.appendChild(input);
            fs.appendChild(row);
        });
        container.appendChild(fs);
        return;
    }
    if(obj && typeof obj === "object")
    {
        const fs = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = path || "(root)";
        fs.appendChild(legend);
        for(const [k, v] of Object.entries(obj))
        {
            if(v && typeof v === "object" && !Array.isArray(v))
            {
                buildForm(fs, v, path ? `${path}.${k}` : k);
            }
            else
            {
                const row = document.createElement("div");
                row.className = "field";
                const label = document.createElement("label");
                label.textContent = k;
                row.appendChild(label);
                const input = inputForValue(path ? `${path}.${k}` : k, v);
                row.appendChild(input);
                fs.appendChild(row);
            }
        }
        container.appendChild(fs);
        return;
    }
}

function guessType(key, val)
{
    const k = (key || "").toLowerCase();
    if(typeof val === "boolean" || /^(enable|enabled|disable|disabled|flag|bool)/.test(k))
    {
        return "checkbox";
    }
    if(typeof val === "number" || /(port|timeout|retries|size|count|ttl)$/.test(k))
    {
        return "number";
    }
    if(/password|secret|token|key$/.test(k))
    {
        return "password";
    }
    if(/email/.test(k))
    {
        return "email";
    }
    if(/url|uri/.test(k))
    {
        return "url";
    }
    if(/color/.test(k))
    {
        return "color";
    }
    if(/date$/.test(k))
    {
        return "date";
    }
    if(/datetime|timestamp/.test(k))
    {
        return "datetime-local";
    }
    return "text";
}

function inputForValue(key, val)
{
    const type = guessType(key, val);
    if(type === "checkbox")
    {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = key;
        input.checked = !!val;
        return input;
    }
    const input = document.createElement("input");
    input.type = type;
    input.name = key;
    if(type === "number")
    {
        input.value = (typeof val === "number" ? String(val) : "");
    }
    else if(type === "datetime-local")
    {
        input.value = toDatetimeLocal(val);
    }
    else
    {
        input.value = val == null ? "" : String(val);
    }
    return input;
}

function toDatetimeLocal(v)
{
    if( !v)
    {
        return "";
    }
    try
    {
        const d = new Date(typeof v === "number" ? v : String(v));
        const pad = (n) => String(n).padStart(2, "0");
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
    catch
    {
        return "";
    }
}

function valueFromForm(container)
{
    const obj = {};
    const inputs = container.querySelectorAll("input");
    inputs.forEach((input) =>
    {
        const name = input.name;
        const val = input.type === "checkbox" ? input.checked : input.value;
        setDeep(obj, name, castValue(input.type, val, name));
    });
    return obj;
}

function castValue(type, raw, key)
{
    if(type === "checkbox")
    {
        return !!raw;
    }
    if(type === "number")
    {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if(type === "datetime-local")
    {
        return raw;
    }
    if(/^(true|false)$/i.test(String(raw)))
    {
        return /^true$/i.test(String(raw));
    }
    if(/^[+-]?\d+(\.\d+)?$/.test(String(raw)))
    {
        return Number(raw);
    }
    if(/,/.test(String(raw)))
    {
        return String(raw).split(",").map((s) => s.trim());
    }
    return raw;
}

function setDeep(target, dottedKey, value)
{
    const parts = dottedKey.split(".");
    let obj = target;
    while(parts.length > 1)
    {
        const p = parts.shift();
        if( !(p in obj))
        {
            obj[p] = {};
        }
        obj = obj[p];
    }
    obj[parts[0]] = value;
}

// Expose helpers for debugging (optional)
window.__cfg = {valueFromForm, buildForm};
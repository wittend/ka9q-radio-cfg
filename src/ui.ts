// src/ui.ts
export function renderHTML(
  params: { root: string; discovered: string[] },
): string {
  const list = ""; // replaced by dynamic tree container
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Config Editor</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>Config Editor</h1>
    <div class="root">Root: ${params.root}</div>
  </header>
  <main>
    <aside>
      <h2>Discovered</h2>
      <div id="tree" class="tree" data-files='${
    JSON.stringify(params.discovered)
  }'></div>
      <h3>Browse</h3>
      <div class="browser">
        <input id="dir-input" placeholder="subdir (optional)">
        <button id="browse-btn">Browse</button>
        <ul id="browse-list"></ul>
      </div>
    </aside>
    <section id="editor">
      <div class="path-row">
        <input id="path" placeholder="relative path e.g. etc/app.conf">
        <button id="open">Open</button>
      </div>
      <form id="form"></form>
      <div class="actions">
        <button id="save">Save</button>
        <input id="saveas-path" placeholder="save as path">
        <button id="saveas">Save As</button>
        <label><input type="checkbox" id="preserve" checked> Preserve format</label>
      </div>
      <pre id="raw"></pre>
    </section>
  </main>
  <script type="module" src="/app.js"></script>
</body>
</html>`;
}

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
  <style>
    /* Make the layout fill the viewport to constrain scrolling */
    html, body {
      height: 100%;
      margin: 0;
    }
    body {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    main {
      flex: 1 1 auto;
      display: flex;
      min-height: 0; /* allow children to shrink and scroll */
    }
    aside {
      width: 320px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 1rem;
      border-right: 1px solid #ddd;
      min-height: 0; /* important for nested overflow containers */
    }
    /* Independently scrollable tree area that never exceeds page height */
    .tree {
      overflow: auto;
      flex: 1 1 auto;  /* take remaining height in aside */
      min-height: 0;   /* allow flex child to shrink */
      border: 1px solid #e3e3e3;
      border-radius: 4px;
      padding: 0.5rem;
      background: #fafafa;
    }
    /* Keep "Browse" section visible below the tree */
    .browser {
      flex: 0 0 auto;
    }
    /* Make editor area scroll independently as well (optional) */
    #editor {
      flex: 1 1 auto;
      min-width: 0;
      padding: 1rem;
      overflow: auto;
    }
  </style>
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

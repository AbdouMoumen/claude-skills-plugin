// File/folder icon set: 16px stroke SVGs drawn in currentColor; the CSS class picks the color.

const PAGE = '<path d="M4 1.5h5.5L13 5v9.5H4z"/><path d="M9.5 1.5V5H13"/>';
const page = (glyph) => PAGE + glyph;

const GLYPHS = {
    text: page('<path d="M6 8h5M6 10h5M6 12h3"/>'),
    markdown: page('<path d="M5.6 12.5v-4l1.4 1.8 1.4-1.8v4M10.6 8.5v4M9.5 11.4l1.1 1.1 1.1-1.1"/>'),
    code: page('<path d="M7 8.5l-1.5 2 1.5 2M10 8.5l1.5 2-1.5 2"/>'),
    json: page('<path d="M7.2 8c-.8 0-.9.4-.9 1.1s-.3 1-.9 1c.6 0 .9.3.9 1s.1 1.1.9 1.1M9.8 8c.8 0 .9.4.9 1.1s.3 1 .9 1c-.6 0-.9.3-.9 1s-.1 1.1-.9 1.1"/>'),
    data: page('<path d="M5.5 8h6v5h-6zM5.5 10.5h6M8.5 8v5"/>'),
    pdf: page('<path class="f" d="M5.5 9h6v3.5h-6z"/>'),
    config: page('<path d="M5.5 9h6M5.5 12h6"/><circle class="f" cx="7" cy="9" r="1"/><circle class="f" cx="10" cy="12" r="1"/>'),
    archive: page('<path d="M7 2v1.2M8.2 3.5v1.2M7 5v1.2M8.2 6.5v1.2"/><path d="M6.6 8.5h2v2.5h-2z"/>'),
    image: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6" r="1.2"/><path d="M1.8 12l3.7-3.7 3 3 2-2 3.8 3.8"/>',
    shell: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4.5 6.5l2 2-2 2M8 10.5h3.5"/>',
    db: '<ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
    lock: '<rect x="3.5" y="7" width="9" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    file: PAGE,
};

const FOLDER =
    '<path class="f" d="M1.5 4a1 1 0 0 1 1-1h3.6l1.5 1.5h5.9a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>';
const FOLDER_OPEN =
    '<path d="M1.5 12V4a1 1 0 0 1 1-1h3.6l1.5 1.5h5a1 1 0 0 1 1 1V7"/>' +
    '<path class="f" d="M1.5 12.3l1.8-4.6a1 1 0 0 1 .9-.7h10.3l-2 5.3a1 1 0 0 1-.9.7H2.5a1 1 0 0 1-1-.7z"/>';

// kind → [glyph, color]
const KINDS = {
    markdown: ["markdown", "blue"],
    text: ["text", "muted"],
    log: ["text", "muted"],
    js: ["code", "yellow"],
    ts: ["code", "blue"],
    py: ["code", "green"],
    code: ["code", "purple"],
    html: ["code", "orange"],
    css: ["code", "purple"],
    json: ["json", "yellow"],
    data: ["data", "green"],
    pdf: ["pdf", "red"],
    config: ["config", "muted"],
    archive: ["archive", "orange"],
    image: ["image", "purple"],
    shell: ["shell", "green"],
    db: ["db", "orange"],
    lock: ["lock", "muted"],
};

const EXT = {
    md: "markdown", markdown: "markdown", mdx: "markdown",
    txt: "text", rst: "text", log: "log", jsonl: "log", ndjson: "log",
    js: "js", mjs: "js", cjs: "js", jsx: "js",
    ts: "ts", tsx: "ts", mts: "ts", cts: "ts",
    py: "py", ipynb: "py",
    cs: "code", java: "code", go: "code", rs: "code", c: "code", h: "code", cpp: "code", hpp: "code",
    rb: "code", php: "code", swift: "code", kt: "code", sql: "code", lua: "code", r: "code",
    html: "html", htm: "html", xml: "html", vue: "html", svelte: "html",
    css: "css", scss: "css", less: "css",
    json: "json", jsonc: "json", json5: "json",
    csv: "data", tsv: "data", xlsx: "data", xls: "data", parquet: "data",
    pdf: "pdf",
    yaml: "config", yml: "config", toml: "config", ini: "config", env: "config", cfg: "config", conf: "config",
    zip: "archive", tar: "archive", gz: "archive", tgz: "archive", "7z": "archive", rar: "archive",
    png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", bmp: "image", ico: "image", svg: "image",
    excalidraw: "image", drawio: "image", mermaid: "image", mmd: "image",
    sh: "shell", bash: "shell", zsh: "shell", ps1: "shell", psm1: "shell", bat: "shell", cmd: "shell",
    db: "db", sqlite: "db", sqlite3: "db",
    lock: "lock", hold: "lock",
};

const FOLDER_COLORS = { files: "blue", research: "purple", checkpoints: "green", extensions: "orange" };

const svg = (body) => `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;

function fileIcon(node, open) {
    if (node.type === "dir") {
        const color = FOLDER_COLORS[node.path] ?? "folder";
        return { html: svg(open ? FOLDER_OPEN : FOLDER), color };
    }
    const dot = node.name.lastIndexOf(".");
    const ext = dot > 0 ? node.name.slice(dot + 1).toLowerCase() : "";
    const [glyph, color] = KINDS[EXT[ext]] ?? ["file", "muted"];
    return { html: svg(GLYPHS[glyph]), color };
}

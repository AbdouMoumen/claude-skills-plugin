import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, watch } from "node:fs";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = {
    "": ["ui.html", "text/html; charset=utf-8"],
    "ui.css": ["ui.css", "text/css; charset=utf-8"],
    "ui.js": ["ui.js", "text/javascript; charset=utf-8"],
    "icons.js": ["icons.js", "text/javascript; charset=utf-8"],
};

const MAX_ENTRIES = 5000;
const MAX_TEXT_BYTES = 1024 * 1024;
const ARTIFACTS_DIR = "files";

const MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
};
const IMAGES = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg"]);
const MARKDOWN = new Set([".md", ".markdown"]);
const HTML = new Set([".html", ".htm"]);

class HttpError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function send(res, code, body) {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
}

const toRel = (rootReal, abs) => relative(rootReal, abs).split(sep).join("/");

// Resolves a relative (or absolute) path and refuses anything outside the root, symlinks included.
async function safePath(rootReal, p) {
    let real;
    try {
        real = await realpath(resolve(rootReal, String(p ?? "")));
    } catch {
        throw new HttpError(404, `Not found: ${p}`);
    }
    if (real !== rootReal && !real.startsWith(rootReal + sep)) throw new HttpError(403, `Outside the session folder: ${p}`);
    return real;
}

async function walk(rootReal, { internal }) {
    let count = 0;
    let truncated = false;
    async function dir(abs, rel) {
        let entries;
        try {
            entries = await readdir(abs, { withFileTypes: true });
        } catch {
            return [];
        }
        const out = [];
        for (const e of entries) {
            if (count >= MAX_ENTRIES) {
                truncated = true;
                break;
            }
            // Top-level files are the session's own bookkeeping (events.jsonl, session.db, locks).
            if (!rel && !e.isDirectory() && !internal) continue;
            const path = rel ? `${rel}/${e.name}` : e.name;
            const full = join(abs, e.name);
            if (e.isDirectory()) {
                count++;
                out.push({ name: e.name, path, type: "dir", children: await dir(full, path) });
            } else if (e.isFile()) {
                const s = await stat(full).catch(() => null);
                if (!s) continue;
                count++;
                out.push({ name: e.name, path, type: "file", size: s.size, mtime: s.mtimeMs });
            }
        }
        out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
        if (!rel) out.sort((a, b) => (b.name === ARTIFACTS_DIR) - (a.name === ARTIFACTS_DIR));
        return out;
    }
    return { children: await dir(rootReal, ""), truncated };
}

function flatten(nodes, out = []) {
    for (const n of nodes) {
        if (n.type === "dir") flatten(n.children, out);
        else out.push({ path: n.path, size: n.size, modified: new Date(n.mtime).toISOString() });
    }
    return out;
}

async function readHead(abs, bytes) {
    const fh = await open(abs, "r");
    try {
        const buf = Buffer.alloc(bytes);
        const { bytesRead } = await fh.read(buf, 0, bytes, 0);
        return buf.subarray(0, bytesRead);
    } finally {
        await fh.close();
    }
}

async function describe(rootReal, p) {
    const abs = await safePath(rootReal, p);
    const s = await stat(abs);
    if (!s.isFile()) throw new HttpError(400, `Not a file: ${p}`);
    const ext = extname(abs).toLowerCase();
    const info = { path: toRel(rootReal, abs), absolutePath: abs, size: s.size, mtime: s.mtimeMs };
    if (IMAGES.has(ext)) return { ...info, kind: "image" };
    if (ext === ".pdf") return { ...info, kind: "pdf" };
    const head = await readHead(abs, Math.min(s.size, MAX_TEXT_BYTES));
    if (head.subarray(0, 8192).includes(0)) return { ...info, kind: "binary" };
    const kind = MARKDOWN.has(ext) ? "markdown" : HTML.has(ext) ? "html" : ext === ".json" ? "json" : "text";
    return { ...info, kind, text: head.toString("utf8"), truncated: s.size > MAX_TEXT_BYTES };
}

async function readJson(req) {
    let raw = "";
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16_000) throw new HttpError(413, "Request too large");
    }
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        throw new HttpError(400, "Invalid JSON");
    }
}

// Types whose default "open" action runs code. These are shown in their folder instead.
const EXECUTABLE = new Set([
    ".exe", ".com", ".scr", ".pif", ".msi", ".msp", ".msc", ".cpl", ".dll", ".sys", ".lnk", ".url", ".reg", ".inf",
    ".bat", ".cmd", ".ps1", ".psm1", ".psd1", ".ps1xml", ".vbs", ".vbe", ".js", ".jse", ".mjs", ".cjs", ".wsf", ".wsh", ".hta",
    ".jar", ".appref-ms", ".application", ".settingcontent-ms", ".library-ms", ".sh", ".bash", ".zsh", ".command", ".app", ".py", ".pyw",
]);

function launch(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false, ...opts });
        child.once("error", reject);
        child.once("spawn", () => {
            child.unref();
            resolve();
        });
    });
}

// Opens a folder in the file manager, a file with its default app, or (reveal) selects the file in its folder.
async function openPath(rootReal, p, { reveal }) {
    const abs = await safePath(rootReal, p);
    const isDir = (await stat(abs)).isDirectory();
    const blocked = !isDir && !reveal && EXECUTABLE.has(extname(abs).toLowerCase());
    const select = !isDir && (reveal || blocked);
    // Windows paths can't contain quotes, so verbatim quoting is safe and keeps /select, intact.
    if (process.platform === "win32") {
        await launch("explorer.exe", [select ? `/select,"${abs}"` : `"${abs}"`], { windowsVerbatimArguments: true });
    } else if (process.platform === "darwin") {
        await launch("open", select ? ["-R", abs] : [abs]);
    } else {
        await launch("xdg-open", [select ? dirname(abs) : abs]);
    }
    return { path: toRel(rootReal, abs), action: isDir ? "folder" : select ? "revealed" : "opened", blocked };
}

// Serves a file's bytes. Active content (HTML/SVG) is sandboxed so it can't reach this server's API.
async function serveRaw(res, rootReal, rel) {
    const abs = await safePath(rootReal, rel);
    const s = await stat(abs);
    if (!s.isFile()) throw new HttpError(404, "Not found");
    const ext = extname(abs).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    const headers = {
        "Content-Type": type,
        "Content-Length": s.size,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    };
    // Unknown types are never rendered inline.
    if (type === "application/octet-stream") headers["Content-Disposition"] = "attachment";
    if (HTML.has(ext)) headers["Content-Security-Policy"] = "sandbox allow-scripts allow-popups allow-forms";
    else if (ext === ".svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
    res.writeHead(200, headers);
    createReadStream(abs).pipe(res);
}

export async function startServer(root) {
    const rootReal = await realpath(root);
    const token = randomBytes(16).toString("hex");
    const prefix = `/${token}/`;
    const clients = new Set();
    let selected = null;
    let host = "";

    const broadcast = (msg) => {
        const data = `data: ${JSON.stringify(msg)}\n\n`;
        for (const c of clients) c.write(data);
    };

    let debounce = null;
    const changed = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => broadcast({ type: "changed" }), 300);
    };
    let watcher = null;
    let poller = null;
    try {
        watcher = watch(rootReal, { recursive: true }, (_event, name) => {
            // Top-level files (events.jsonl, session.db) change every turn; the tree hides them by default.
            if (name && !String(name).includes(sep) && !String(name).includes("/")) {
                stat(join(rootReal, String(name)))
                    .then((s) => s.isDirectory() && changed())
                    .catch(changed);
                return;
            }
            changed();
        });
        watcher.on("error", () => {});
    } catch {
        poller = setInterval(() => broadcast({ type: "changed" }), 5000);
    }

    const server = createServer(async (req, res) => {
        try {
            // Rejects DNS-rebinding requests; the token in the path keeps other local pages out.
            if (req.headers.host !== host) return send(res, 421, { error: "Misdirected request" });
            const url = new URL(req.url, `http://${host}`);
            if (!url.pathname.startsWith(prefix)) return send(res, 404, { error: "Not found" });
            const route = url.pathname.slice(prefix.length);

            if (req.method === "POST" && route === "api/open") {
                // Requiring JSON forces a CORS preflight for cross-origin pages, which we never approve.
                if (!String(req.headers["content-type"]).startsWith("application/json")) {
                    return send(res, 415, { error: "Expected application/json" });
                }
                const body = await readJson(req);
                return send(res, 200, await openPath(rootReal, body.path, { reveal: !!body.reveal }));
            }
            if (req.method !== "GET") return send(res, 404, { error: "Not found" });

            if (route in STATIC) {
                const [file, type] = STATIC[route];
                res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
                return res.end(await readFile(join(here, file)));
            }
            if (route === "events") {
                res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
                res.write(`data: ${JSON.stringify({ type: "hello", root: rootReal, selected })}\n\n`);
                clients.add(res);
                req.on("close", () => clients.delete(res));
                return;
            }
            if (route === "api/tree") {
                return send(res, 200, await walk(rootReal, { internal: url.searchParams.get("internal") === "1" }));
            }
            if (route === "api/file") return send(res, 200, await describe(rootReal, url.searchParams.get("path")));
            if (route.startsWith("raw/")) {
                const rel = route.slice(4).split("/").map(decodeURIComponent).join("/");
                return await serveRaw(res, rootReal, rel);
            }
            send(res, 404, { error: "Not found" });
        } catch (err) {
            if (!res.headersSent) send(res, err instanceof HttpError ? err.code : 500, { error: err.message });
            else res.destroy();
        }
    });

    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();
    host = `127.0.0.1:${port}`;

    return {
        url: `http://${host}${prefix}`,
        list: async ({ internal }) => {
            const { children, truncated } = await walk(rootReal, { internal });
            return { root: rootReal, files: flatten(children), truncated };
        },
        reveal: async (p) => {
            const info = await describe(rootReal, p);
            selected = info.path;
            broadcast({ type: "reveal", path: selected });
            return { path: selected, absolutePath: info.absolutePath, panelsConnected: clients.size };
        },
        close: () =>
            new Promise((r) => {
                watcher?.close();
                clearInterval(poller);
                clearTimeout(debounce);
                for (const c of clients) c.end();
                server.close(() => r());
            }),
    };
}

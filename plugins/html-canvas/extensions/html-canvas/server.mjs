import { createServer } from "node:http";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = {
    "": ["ui.html", "text/html; charset=utf-8"],
    "ui.css": ["ui.css", "text/css; charset=utf-8"],
    "ui.js": ["ui.js", "text/javascript; charset=utf-8"],
};

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_HISTORY = 50;
const MAX_SEND_TEXT = 8000;
const MAX_SEND_DATA = 16_000;
const SEND_INTERVAL_MS = 1000;
// The page can't touch the panel or this server (opaque origin); external resources are allowed.
const PAGE_SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

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

async function readJson(req, limit) {
    let raw = "";
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > limit) throw new HttpError(413, "Request too large");
    }
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        throw new HttpError(400, "Invalid JSON");
    }
}

// Runs inside the rendered page: exposes copilot.send() and applies the app theme the panel forwards.
const BRIDGE = `<script>(()=>{const P=parent,M="__htmlCanvas";
window.copilot=Object.freeze({send(text,data){if(typeof text!=="string"||!text.trim())throw new TypeError("copilot.send(text, data?): text must be a non-empty string");
P.postMessage({[M]:"send",text,data:data===undefined?undefined:JSON.parse(JSON.stringify(data))},"*");}});
addEventListener("message",e=>{if(e.source!==P||!e.data||e.data[M]!=="theme")return;const r=document.documentElement;
for(const[k,v]of Object.entries(e.data.vars||{}))r.style.setProperty(k,v);for(const[k,v]of Object.entries(e.data.attrs||{}))r.setAttribute(k,v);
r.style.colorScheme=e.data.attrs&&e.data.attrs["data-color-mode"]==="dark"?"dark":"light";});
P.postMessage({[M]:"ready"},"*");})();</script>`;

const BASE_STYLE = `<style>
html{color-scheme:light dark}
body{margin:0;padding:16px;background:var(--background-color-default,Canvas);color:var(--text-color-default,CanvasText);
font-family:var(--font-sans,system-ui,-apple-system,"Segoe UI",sans-serif);font-size:var(--text-body-medium,14px);line-height:var(--leading-body-medium,20px)}
code,pre{font-family:var(--font-mono,ui-monospace,Consolas,monospace)}
a{color:var(--true-color-blue,#0969da)}
</style>`;

// Full documents get the bridge injected; fragments are wrapped in a themed document.
function buildPage(html) {
    if (/^\s*(<!--[\s\S]*?-->\s*)*(<!doctype|<html[\s>])/i.test(html)) {
        const head = html.match(/<head(\s[^>]*)?>/i);
        if (head) return html.slice(0, head.index + head[0].length) + BRIDGE + html.slice(head.index + head[0].length);
        const root = html.match(/<html(\s[^>]*)?>/i);
        if (root) return html.slice(0, root.index + root[0].length) + BRIDGE + html.slice(root.index + root[0].length);
        return BRIDGE + html;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${BASE_STYLE}${BRIDGE}</head><body>${html}</body></html>`;
}

// Each panel's history lives in <storeRoot>/<instanceId>/: one .html file per render plus index.json.
export async function startServer({ storeRoot, onSend }) {
    const token = randomBytes(16).toString("hex");
    const prefix = `/${token}/`;
    const instances = new Map(); // instanceId → Promise<{ dir, pages, index, clients, lastSend }>
    let host = "";

    const load = async (instanceId) => {
        const dir = join(storeRoot, instanceId.replace(/[^A-Za-z0-9._-]/g, "_"));
        const s = { dir, pages: [], index: -1, clients: new Set(), lastSend: 0 };
        try {
            const saved = JSON.parse(await readFile(join(dir, "index.json"), "utf8"));
            if (Array.isArray(saved.pages)) {
                s.pages = saved.pages.filter(
                    (p) => p && /^[a-f0-9]+$/.test(p.id) && typeof p.file === "string" && /^[\w-]+\.html$/.test(p.file),
                );
                s.index = Math.min(Math.max(Number(saved.index) || 0, 0), s.pages.length - 1);
                s.openedWith = typeof saved.openedWith === "string" ? saved.openedWith : undefined;
            }
        } catch {
            // No saved history yet (or unreadable): start empty.
        }
        return s;
    };

    const inst = (instanceId) => {
        let p = instances.get(instanceId);
        if (!p) {
            p = load(instanceId);
            instances.set(instanceId, p);
        }
        return p;
    };

    // Serializes index.json writes per panel; the temp-file rename keeps it intact on crash.
    const save = async (s) => {
        s.saving = (s.saving ?? Promise.resolve()).catch(() => {}).then(async () => {
            await mkdir(s.dir, { recursive: true });
            const tmp = join(s.dir, "index.json.tmp");
            await writeFile(tmp, JSON.stringify({ index: s.index, openedWith: s.openedWith, pages: s.pages }, null, 2));
            await rename(tmp, join(s.dir, "index.json"));
        });
        return s.saving;
    };

    const findPage = async (pageId) => {
        for (const p of instances.values()) {
            const s = await p;
            const page = s.pages.find((x) => x.id === pageId);
            if (page) return { s, page };
        }
        return null;
    };

    const summary = (s) => ({
        page: s.index + 1,
        count: s.pages.length,
        folder: s.dir,
        pages: s.pages.map((p, i) => ({ page: i + 1, title: p.title, at: p.at, file: join(s.dir, p.file) })),
    });

    const broadcast = (s) => {
        const data = `data: ${JSON.stringify({ type: "state", ...summary(s), pageIds: s.pages.map((p) => p.id) })}\n\n`;
        for (const c of s.clients) c.write(data);
    };

    const setIndex = async (s, index) => {
        if (!s.pages.length) throw new HttpError(404, "Nothing has been rendered in this panel yet.");
        if (!Number.isInteger(index) || index < 0 || index >= s.pages.length) {
            throw new HttpError(400, `Page must be between 1 and ${s.pages.length}.`);
        }
        s.index = index;
        broadcast(s);
        await save(s);
    };

    const server = createServer(async (req, res) => {
        try {
            // Rejects DNS-rebinding requests; the token in the path keeps other local pages out.
            if (req.headers.host !== host) return send(res, 421, { error: "Misdirected request" });
            const url = new URL(req.url, `http://${host}`);
            if (!url.pathname.startsWith(prefix)) return send(res, 404, { error: "Not found" });
            const route = url.pathname.slice(prefix.length);

            if (req.method === "POST") {
                // Rendered pages run with an opaque ("null") origin, so only the panel itself passes.
                // Requiring JSON also forces a CORS preflight that is never approved.
                if (req.headers.origin !== `http://${host}`) return send(res, 403, { error: "Forbidden" });
                if (!String(req.headers["content-type"]).startsWith("application/json")) {
                    return send(res, 415, { error: "Expected application/json" });
                }
                const body = await readJson(req, MAX_SEND_TEXT + MAX_SEND_DATA + 2000);
                const pending = instances.get(String(body.instanceId));
                if (!pending) throw new HttpError(404, "Unknown panel");
                const s = await pending;

                if (route === "api/go") {
                    await setIndex(s, body.page - 1);
                    return send(res, 200, { page: s.index + 1 });
                }
                if (route === "api/send") {
                    const text = String(body.text ?? "").trim();
                    if (!text) throw new HttpError(400, "Empty message");
                    if (text.length > MAX_SEND_TEXT) throw new HttpError(413, "Message too long");
                    const data = body.data === undefined ? undefined : JSON.stringify(body.data, null, 2);
                    if (data && data.length > MAX_SEND_DATA) throw new HttpError(413, "Data too large");
                    const now = Date.now();
                    if (now - s.lastSend < SEND_INTERVAL_MS) throw new HttpError(429, "Too many messages; wait a moment.");
                    s.lastSend = now;
                    const n = s.pages.findIndex((p) => p.id === body.pageId);
                    await onSend({
                        instanceId: String(body.instanceId),
                        page: n + 1,
                        title: s.pages[n]?.title,
                        text,
                        data,
                    });
                    return send(res, 200, { sent: true });
                }
                return send(res, 404, { error: "Not found" });
            }
            if (req.method !== "GET") return send(res, 404, { error: "Not found" });

            if (route in STATIC) {
                const [file, type] = STATIC[route];
                res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
                return res.end(await readFile(join(here, file)));
            }
            if (route === "events") {
                const pending = instances.get(url.searchParams.get("i"));
                if (!pending) return send(res, 404, { error: "Unknown panel" });
                const s = await pending;
                res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
                res.write(`data: ${JSON.stringify({ type: "state", ...summary(s), pageIds: s.pages.map((p) => p.id) })}\n\n`);
                s.clients.add(res);
                req.on("close", () => s.clients.delete(res));
                return;
            }
            if (route.startsWith("page/")) {
                const found = await findPage(route.slice(5));
                if (!found) return send(res, 404, { error: "Page not found" });
                let html;
                try {
                    html = await readFile(join(found.s.dir, found.page.file), "utf8");
                } catch {
                    html = `<p>This page's file is missing: <code>${join(found.s.dir, found.page.file).replace(/[&<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)}</code></p>`;
                }
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                    "Content-Security-Policy": `sandbox ${PAGE_SANDBOX}`,
                });
                return res.end(buildPage(html));
            }
            send(res, 404, { error: "Not found" });
        } catch (err) {
            if (!res.headersSent) send(res, err instanceof HttpError ? err.code : 500, { error: err.message });
            else res.destroy();
        }
    });

    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    host = `127.0.0.1:${server.address().port}`;

    const removeFile = (s, p) => rm(join(s.dir, p.file), { force: true }).catch(() => {});

    const api = {
        url: (instanceId) => `http://${host}${prefix}?i=${encodeURIComponent(instanceId)}`,
        render: async (instanceId, { html, title, replace }) => {
            const s = await inst(instanceId);
            const id = randomBytes(8).toString("hex");
            const page = {
                id,
                title: title?.trim() || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "Untitled",
                at: new Date().toISOString(),
                file: `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.html`,
            };
            await mkdir(s.dir, { recursive: true });
            await writeFile(join(s.dir, page.file), html);
            const dropped = [];
            if (replace && s.index >= 0) {
                dropped.push(s.pages[s.index]);
                s.pages[s.index] = page;
            } else {
                // Like a browser: rendering after going back discards the forward pages.
                dropped.push(...s.pages.splice(s.index + 1));
                s.pages.push(page);
                while (s.pages.length > MAX_HISTORY) dropped.push(s.pages.shift());
                s.index = s.pages.length - 1;
            }
            broadcast(s);
            await save(s);
            await Promise.all(dropped.map((p) => removeFile(s, p)));
            return {
                page: s.index + 1,
                count: s.pages.length,
                title: page.title,
                file: join(s.dir, page.file),
                panelsConnected: s.clients.size,
            };
        },
        list: async (instanceId) => summary(await inst(instanceId)),
        openWith: async (instanceId, input) => {
            const s = await inst(instanceId);
            const key = createHash("sha256").update(`${input.title ?? ""}\n${input.html}`).digest("hex");
            if (s.openedWith === key) return null;
            s.openedWith = key;
            return api.render(instanceId, input);
        },
        go: async (instanceId, page) => {
            const s = await inst(instanceId);
            await setIndex(s, page - 1);
            return summary(s);
        },
        // Frees a closed panel's memory; its saved history stays on disk for the next open.
        release: async (instanceId) => {
            const pending = instances.get(instanceId);
            if (!pending) return;
            instances.delete(instanceId);
            const s = await pending;
            for (const c of s.clients) c.end();
            await s.saving?.catch(() => {});
        },
        get size() {
            return instances.size;
        },
        close: async () => {
            for (const p of instances.values()) {
                const s = await p;
                for (const c of s.clients) c.end();
                await s.saving?.catch(() => {});
            }
            await new Promise((r) => server.close(() => r()));
        },
    };
    return api;
}
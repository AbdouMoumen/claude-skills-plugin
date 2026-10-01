import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StoreError } from "./store.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = {
    "/": ["ui.html", "text/html; charset=utf-8"],
    "/ui.css": ["ui.css", "text/css; charset=utf-8"],
    "/ui.js": ["ui.js", "text/javascript; charset=utf-8"],
};

function send(res, code, body) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function readJson(req) {
    let raw = "";
    for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 64_000) throw new StoreError("Request too large");
    }
    return raw ? JSON.parse(raw) : {};
}

// UI mutations. The panel is the user's surface, so these are attributed to "user".
const routes = {
    add: (s, b) => s.add({ text: b.text, notes: b.notes, addedBy: "user" }),
    status: (s, b) => s.setStatus({ id: b.id, status: b.status, by: "user" }),
    edit: (s, b) => s.edit({ id: b.id, text: b.text, notes: b.notes }),
    delete: (s, b) => s.remove(b.id),
    reorder: (s, b) => s.reorder(Array.isArray(b.ids) ? b.ids : []),
    "clear-done": (s) => s.clearDone(),
};

export async function startServer(getStore, { onSend } = {}) {
    if (onSend) routes.send = (s, b) => onSend({ id: b.id, mode: b.mode === "immediate" ? "immediate" : "enqueue" });
    const clients = new Set();
    let unsubscribe = null;

    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, "http://127.0.0.1");
            const store = await getStore();

            if (req.method === "GET" && STATIC[url.pathname]) {
                const [file, type] = STATIC[url.pathname];
                res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
                return res.end(await readFile(join(here, file)));
            }

            if (req.method === "GET" && url.pathname === "/events") {
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-store",
                    Connection: "keep-alive",
                });
                res.write(`data: ${JSON.stringify(await store.snapshot())}\n\n`);
                clients.add(res);
                req.on("close", () => clients.delete(res));
                if (!unsubscribe) {
                    const onChange = (state) => {
                        for (const c of clients) c.write(`data: ${JSON.stringify(state)}\n\n`);
                    };
                    store.on("change", onChange);
                    unsubscribe = () => store.off("change", onChange);
                }
                return;
            }

            const action = url.pathname.startsWith("/api/") && routes[url.pathname.slice(5)];
            if (req.method === "POST" && action) {
                // Requiring JSON forces a CORS preflight for cross-origin pages, which we never approve.
                if (!String(req.headers["content-type"]).startsWith("application/json")) {
                    return send(res, 415, { error: "Expected application/json" });
                }
                const result = await action(store, await readJson(req));
                return send(res, 200, { ok: true, result });
            }

            send(res, 404, { error: "Not found" });
        } catch (err) {
            const known = err instanceof StoreError || err instanceof SyntaxError;
            if (!res.headersSent) send(res, known ? 400 : 500, { error: err.message });
        }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    return {
        url: `http://127.0.0.1:${port}/`,
        close: () =>
            new Promise((resolve) => {
                unsubscribe?.();
                for (const c of clients) c.end();
                server.close(() => resolve());
            }),
    };
}

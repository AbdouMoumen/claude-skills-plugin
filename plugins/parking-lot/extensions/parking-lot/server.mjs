import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_ATTACHMENT_BYTES, StoreError } from "./store.mjs";

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

async function readBody(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) throw new StoreError("File is larger than 25 MB");
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// Files pasted into the add box before the item exists, keyed by attachment id.
const pending = new Map();

function takePending(ids) {
    return (Array.isArray(ids) ? ids : []).map((id) => pending.get(id)).filter(Boolean);
}

// Flags attachments whose file is gone so the panel can dim them.
function decorate(state) {
    for (const item of state.items) {
        for (const a of item.attachments ?? []) a.missing = !existsSync(a.path);
    }
    return state;
}

// Deletes are soft: the panel gets an undo token and how many copied files go with the items.
function trashResult(s, { token, items }) {
    const files = items.reduce((n, i) => n + (i.attachments ?? []).filter((a) => s.isOwnCopy(a)).length, 0);
    return { token, ids: items.map((i) => i.id), count: items.length, files };
}

// UI mutations. The panel is the user's surface, so these are attributed to "user".
const routes = {
    add: async (s, b) => {
        const atts = takePending(b.uploads);
        const item = await s.add({ text: b.text, notes: b.notes, addedBy: "user", attachments: atts });
        for (const a of atts) pending.delete(a.id);
        return item;
    },
    status: (s, b) => s.setStatus({ id: b.id, status: b.status, by: "user" }),
    edit: (s, b) => s.edit({ id: b.id, text: b.text, notes: b.notes }),
    delete: async (s, b) => trashResult(s, await s.remove(b.id)),
    reorder: (s, b) => s.reorder(Array.isArray(b.ids) ? b.ids : []),
    "clear-done": async (s) => trashResult(s, await s.clearDone()),
    restore: (s, b) => s.restore(String(b.token ?? "")),
    "remove-attachment": (s, b) => s.removeAttachment({ id: b.id, attachmentId: b.attachmentId }),
    "discard-upload": async (s, b) => {
        const a = pending.get(b.uploadId);
        if (a) {
            pending.delete(a.id);
            await s.deleteCopies([a]);
        }
        return true;
    },
};

// Serves a copied attachment, looked up by item id + attachment id only (never by a path from the request).
async function serveFile(res, store, itemId, attId) {
    const { items } = await store.snapshot();
    const a = items.find((i) => i.id === Number(itemId))?.attachments?.find((x) => x.id === attId);
    if (!store.isOwnCopy(a)) return send(res, 404, { error: "Not found" });
    const image = a.mime?.startsWith("image/");
    res.writeHead(200, {
        "Content-Type": image ? a.mime : "application/octet-stream",
        "Content-Disposition": image ? "inline" : "attachment",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
    });
    res.end(await readFile(a.path));
}

// Raw file body; metadata in the query. ?item=<id> attaches directly, otherwise it's held for the next add.
async function handleUpload(req, res, url, store) {
    // A non-simple content type forces a CORS preflight, which we never approve.
    if (req.headers["content-type"] !== "application/octet-stream") {
        return send(res, 415, { error: "Expected application/octet-stream" });
    }
    const itemId = url.searchParams.get("item");
    if (itemId) store.find(await store.snapshot(), itemId);
    const entry = await store.writeCopy({
        name: url.searchParams.get("name"),
        mime: url.searchParams.get("mime"),
        data: await readBody(req, MAX_ATTACHMENT_BYTES),
    });
    if (!itemId) {
        pending.set(entry.id, entry);
        return send(res, 200, { ok: true, result: entry });
    }
    try {
        await store.addAttachments({ id: itemId, attachments: [entry] });
    } catch (err) {
        await store.deleteCopies([entry]);
        throw err;
    }
    send(res, 200, { ok: true, result: entry });
}

export async function startServer(getStore, { onSend } = {}) {
    if (onSend) routes.send = (s, b) => {
        const kind = b.kind === "ask" ? "ask" : "work";
        // Ask is always queued: it's a question, not a steer.
        const mode = kind === "work" && b.mode === "immediate" ? "immediate" : "enqueue";
        return onSend({ id: b.id, mode, kind });
    };
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
                res.write(`data: ${JSON.stringify(decorate(await store.snapshot()))}\n\n`);
                clients.add(res);
                req.on("close", () => clients.delete(res));
                if (!unsubscribe) {
                    const onChange = (state) => {
                        const data = JSON.stringify(decorate(state));
                        for (const c of clients) c.write(`data: ${data}\n\n`);
                    };
                    store.on("change", onChange);
                    unsubscribe = () => store.off("change", onChange);
                }
                return;
            }

            const file = req.method === "GET" && url.pathname.match(/^\/files\/(\d+)\/([\w-]+)$/);
            if (file) return await serveFile(res, store, file[1], file[2]);
            if (req.method === "POST" && url.pathname === "/upload") return await handleUpload(req, res, url, store);

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
                for (const a of pending.values()) unlink(a.path).catch(() => {});
                pending.clear();
                Promise.resolve(getStore()).then((s) => s.purgeTrash()).catch(() => {});
                server.close(() => resolve());
            }),
    };
}

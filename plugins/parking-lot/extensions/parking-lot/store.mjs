import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";

export const STATUSES = ["open", "in_progress", "done"];
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Server-side undo window. A bit longer than the panel's 6 s toast so a late Undo click still lands.
export const UNDO_MS = 8000;

export class StoreError extends Error {}

const IMAGE_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp", "image/svg+xml": "svg" };

export function sanitizeName(name) {
    const clean = basename(String(name ?? "").replace(/\\/g, "/"))
        .replace(/[^\w.\- ]/g, "_")
        .replace(/^[.\s]+/, "")
        .trim()
        .slice(-100);
    return clean || "file";
}

// Agent-referenced files: validated once, stored by path, never copied or deleted.
export function refAttachments(paths) {
    if (paths === undefined) return [];
    if (!Array.isArray(paths)) throw new StoreError("attachments must be an array of absolute file paths");
    return paths.map((p) => {
        if (typeof p !== "string" || !isAbsolute(p)) throw new StoreError(`Attachment path must be absolute: ${p}`);
        if (!existsSync(p)) throw new StoreError(`Attachment not found: ${p}`);
        return { id: randomUUID(), kind: "ref", path: p, name: basename(p) };
    });
}

function emptyState() {
    return { version: 1, nextId: 1, items: [] };
}

export class ParkingStore extends EventEmitter {
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.attachDir = join(dirname(filePath), "parking-lot");
        this.state = null;
        this.queue = Promise.resolve();
        this.trash = new Map(); // undo token -> { entries: [{ item, index }], timer }
    }

    async load() {
        if (this.state) return this.state;
        try {
            const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
            this.state = {
                ...emptyState(),
                ...parsed,
                items: Array.isArray(parsed.items) ? parsed.items : [],
            };
        } catch (err) {
            if (err.code !== "ENOENT") throw err;
            this.state = emptyState();
        }
        return this.state;
    }

    async snapshot() {
        return structuredClone(await this.load());
    }

    // Serialize mutations so concurrent tool calls and UI requests can't interleave writes.
    mutate(fn) {
        const run = this.queue.then(async () => {
            const state = await this.load();
            const result = fn(state);
            await this.save();
            this.emit("change", structuredClone(state));
            return result;
        });
        this.queue = run.catch(() => {});
        return run;
    }

    async save() {
        await mkdir(dirname(this.filePath), { recursive: true });
        const tmp = `${this.filePath}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(this.state, null, 2), "utf8");
        await rename(tmp, this.filePath);
    }

    find(state, id) {
        const item = state.items.find((i) => i.id === Number(id));
        if (!item) throw new StoreError(`No parking lot item #${id}`);
        return item;
    }

    add({ text, notes = "", addedBy, attachments = [] }) {
        const clean = String(text ?? "").trim();
        if (!clean) throw new StoreError("Item text is required");
        return this.mutate((state) => {
            const item = {
                id: state.nextId++,
                text: clean,
                notes: String(notes ?? "").trim(),
                attachments,
                status: "open",
                addedBy,
                createdAt: new Date().toISOString(),
                completedAt: null,
                completedBy: null,
                completionNote: null,
            };
            state.items.push(item);
            return item;
        });
    }

    setStatus({ id, status, note, by }) {
        if (!STATUSES.includes(status)) throw new StoreError(`Invalid status "${status}"`);
        return this.mutate((state) => {
            const item = this.find(state, id);
            item.status = status;
            if (status === "done") {
                item.completedAt = new Date().toISOString();
                item.completedBy = by;
                item.completionNote = note ? String(note).trim() : null;
            } else {
                item.completedAt = null;
                item.completedBy = null;
                item.completionNote = null;
            }
            return item;
        });
    }

    edit({ id, text, notes }) {
        return this.mutate((state) => {
            const item = this.find(state, id);
            if (text !== undefined) {
                const clean = String(text).trim();
                if (!clean) throw new StoreError("Item text is required");
                item.text = clean;
            }
            if (notes !== undefined) item.notes = String(notes).trim();
            return item;
        });
    }

    addAttachments({ id, attachments }) {
        return this.mutate((state) => {
            const item = this.find(state, id);
            item.attachments ??= [];
            for (const a of attachments) {
                if (a.kind === "ref" && item.attachments.some((x) => x.kind === "ref" && x.path === a.path)) continue;
                item.attachments.push(a);
            }
            return item;
        });
    }

    async removeAttachment({ id, attachmentId }) {
        let removed = null;
        const item = await this.mutate((state) => {
            const item = this.find(state, id);
            removed = (item.attachments ?? []).find((a) => a.id === attachmentId);
            if (!removed) throw new StoreError(`No such attachment on #${id}`);
            item.attachments = item.attachments.filter((a) => a !== removed);
            return item;
        });
        await this.deleteCopies([removed]);
        return item;
    }

    // Pasted files are copied into <files>/parking-lot/; the entry is attached by the caller.
    async writeCopy({ name, mime, data }) {
        if (data.length > MAX_ATTACHMENT_BYTES) throw new StoreError("File is larger than 25 MB");
        const id = randomUUID();
        const raw = String(mime ?? "").toLowerCase();
        const type = /^[\w.+-]+\/[\w.+-]+$/.test(raw) ? raw : "";
        const image = type.startsWith("image/");
        const ext = IMAGE_EXT[type] ?? (extname(sanitizeName(name)).slice(1) || "png");
        const display = image ? `clipboard.${ext}` : sanitizeName(name);
        const path = join(this.attachDir, `${id}-${display}`);
        await mkdir(this.attachDir, { recursive: true });
        await writeFile(path, data);
        return { id, kind: "copy", path, name: display, mime: type || "application/octet-stream" };
    }

    isOwnCopy(a) {
        return a?.kind === "copy" && dirname(resolve(a.path)) === resolve(this.attachDir);
    }

    // Only copies inside our own attachment dir are ever deleted; refs are never touched.
    async deleteCopies(attachments) {
        for (const a of attachments) {
            if (!this.isOwnCopy(a)) continue;
            await unlink(a.path).catch((err) => { if (err.code !== "ENOENT") throw err; });
        }
    }

    // Soft-removes matching items. Their copied files stay on disk until the undo window closes,
    // so restore() can put the items back exactly (same id, position, status, notes, attachments).
    async trashItems(pick) {
        const entries = await this.mutate((state) => {
            const entries = [];
            state.items.forEach((item, index) => { if (pick(item)) entries.push({ item, index }); });
            const gone = new Set(entries.map((e) => e.item));
            state.items = state.items.filter((i) => !gone.has(i));
            return entries;
        });
        if (!entries.length) return { token: null, items: [] };
        const token = randomUUID();
        const timer = setTimeout(() => this.purge(token).catch(() => {}), UNDO_MS);
        timer.unref?.();
        this.trash.set(token, { entries, timer });
        return { token, items: entries.map((e) => e.item) };
    }

    async remove(id) {
        const result = await this.trashItems((i) => i.id === Number(id));
        if (!result.token) throw new StoreError(`No parking lot item #${id}`);
        return result;
    }

    restore(token) {
        const t = this.trash.get(token);
        if (!t) return Promise.reject(new StoreError("Nothing to undo (the undo window has closed)"));
        this.trash.delete(token);
        clearTimeout(t.timer);
        return this.mutate((state) => {
            // Entries are in ascending original index, so inserting in order rebuilds the old layout.
            for (const { item, index } of t.entries) state.items.splice(Math.min(index, state.items.length), 0, item);
            return t.entries.map((e) => e.item);
        });
    }

    async purge(token) {
        const t = this.trash.get(token);
        if (!t) return;
        this.trash.delete(token);
        clearTimeout(t.timer);
        await this.deleteCopies(t.entries.flatMap((e) => e.item.attachments ?? []));
    }

    purgeTrash() {
        return Promise.all([...this.trash.keys()].map((token) => this.purge(token).catch(() => {})));
    }

    // For process exit, when async work can't finish.
    purgeTrashSync() {
        for (const { entries, timer } of this.trash.values()) {
            clearTimeout(timer);
            for (const a of entries.flatMap((e) => e.item.attachments ?? [])) {
                if (this.isOwnCopy(a)) try { unlinkSync(a.path); } catch {}
            }
        }
        this.trash.clear();
    }

    reorder(ids) {
        return this.mutate((state) => {
            const byId = new Map(state.items.map((i) => [i.id, i]));
            const ordered = ids.map(Number).filter((id) => byId.has(id)).map((id) => byId.get(id));
            const rest = state.items.filter((i) => !ordered.includes(i));
            state.items = [...ordered, ...rest];
            return state.items.map((i) => i.id);
        });
    }

    clearDone() {
        return this.trashItems((i) => i.status === "done");
    }

}

import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const STATUSES = ["open", "in_progress", "done"];

export class StoreError extends Error {}

function emptyState() {
    return { version: 1, nextId: 1, items: [] };
}

export class ParkingStore extends EventEmitter {
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.state = null;
        this.queue = Promise.resolve();
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

    add({ text, notes = "", addedBy }) {
        const clean = String(text ?? "").trim();
        if (!clean) throw new StoreError("Item text is required");
        return this.mutate((state) => {
            const item = {
                id: state.nextId++,
                text: clean,
                notes: String(notes ?? "").trim(),
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

    remove(id) {
        return this.mutate((state) => {
            const item = this.find(state, id);
            state.items = state.items.filter((i) => i !== item);
            return item;
        });
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
        return this.mutate((state) => {
            const before = state.items.length;
            state.items = state.items.filter((i) => i.status !== "done");
            return before - state.items.length;
        });
    }
}

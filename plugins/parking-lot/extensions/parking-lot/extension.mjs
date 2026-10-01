// Parking Lot: a per-session backlog of ideas the user wants to explore later.
// The canvas is the user's UI; the agent interacts only via the parking_* tools.

import { homedir } from "node:os";
import { join } from "node:path";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";
import { ParkingStore, STATUSES } from "./store.mjs";
import { startServer } from "./server.mjs";

const MAX_INJECTED = 10;
let session;
let store;
let serverPromise = null;
const openInstances = new Set();

function getStore() {
    if (!store) {
        const base =
            session?.workspacePath ??
            join(process.env.COPILOT_HOME ?? join(homedir(), ".copilot"), "session-state", session?.sessionId ?? "unknown");
        store = new ParkingStore(join(base, "files", "parking-lot.json"));
    }
    return store;
}

function format(item) {
    const status = item.status === "open" ? "" : ` [${item.status}]`;
    const notes = item.notes ? ` (notes: ${item.notes})` : "";
    const done = item.completionNote ? ` (done: ${item.completionNote})` : "";
    return `#${item.id}${status} ${item.text}${notes}${done}`;
}

const tools = [
    {
        name: "parking_list",
        description:
            "List the user's Parking Lot: a backlog of ideas they want to explore later in this session. " +
            "Read-only. Do not start working on items unless the user explicitly asks.",
        parameters: {
            type: "object",
            properties: { includeDone: { type: "boolean", description: "Also include completed items." } },
        },
        handler: async ({ includeDone } = {}) => {
            const { items } = await getStore().snapshot();
            const shown = includeDone ? items : items.filter((i) => i.status !== "done");
            return shown.length ? shown.map(format).join("\n") : "The parking lot is empty.";
        },
    },
    {
        name: "parking_add",
        description:
            "Add an item to the user's Parking Lot backlog. ONLY call this when the user explicitly asks to park/add " +
            "something; never add your own follow-up ideas unprompted (mention them in chat instead).",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "Short description of the idea." },
                notes: { type: "string", description: "Optional extra context." },
            },
            required: ["text"],
        },
        handler: async ({ text, notes }) => {
            const item = await getStore().add({ text, notes, addedBy: "agent" });
            return `Parked ${format(item)}`;
        },
    },
    {
        name: "parking_update",
        description:
            "Change the status of a Parking Lot item. Set in_progress when the user asks you to work on it, done when " +
            "finished. If your current work incidentally completed an item, you may mark it done. A note explaining " +
            "what completed it is required for done. Cannot edit text or delete items; the user does that in the panel.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "integer", description: "Item number, e.g. 3 for #3." },
                status: { type: "string", enum: STATUSES },
                note: { type: "string", description: "Required when status is done: one line on what completed it." },
            },
            required: ["id", "status"],
        },
        handler: async ({ id, status, note }) => {
            if (status === "done" && !note?.trim()) {
                throw new Error("A completion note is required when marking an item done.");
            }
            const item = await getStore().setStatus({ id, status, note, by: "agent" });
            return `Updated ${format(item)}`;
        },
    },
];

// Panel "Queue" / "Now" buttons: hand an item to the agent as a user message.
// session.send delivers slash commands as plain text (verified), so the
// /parking-lot shorthand is followed by an explicit pointer to the skill.
async function sendToAgent({ id, mode }) {
    const item = await getStore().setStatus({ id, status: "in_progress", by: "user" });
    const notes = item.notes ? `\nNotes: ${item.notes}` : "";
    await session.send({
        prompt: `/parking-lot work ${item.id} — ${item.text}${notes}\n(Use the parking-lot skill.)`,
        mode,
    });
    return item;
}

const canvas = createCanvas({
    id: "parking-lot",
    displayName: "Parking Lot",
    description:
        "The user's per-session backlog of ideas to explore later. Open only when the user asks to see it; use the parking_* tools to read or update it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    open: async (ctx) => {
        openInstances.add(ctx.instanceId);
        serverPromise ??= startServer(async () => getStore(), { onSend: sendToAgent });
        const { url } = await serverPromise;
        return { title: "Parking Lot", url };
    },
    onClose: async (ctx) => {
        openInstances.delete(ctx.instanceId);
        if (openInstances.size === 0 && serverPromise) {
            const pending = serverPromise;
            serverPromise = null;
            await (await pending).close();
        }
    },
});

session = await joinSession({
    canvases: [canvas],
    tools,
    hooks: {
        onUserPromptSubmitted: async () => {
            const { items } = await getStore().snapshot();
            const open = items.filter((i) => i.status !== "done");
            if (!open.length) return;
            const shown = open.slice(0, MAX_INJECTED).map(format).join("\n");
            const more = open.length > MAX_INJECTED ? `\n…and ${open.length - MAX_INJECTED} more (use parking_list).` : "";
            return {
                additionalContext:
                    "<parking_lot>\nThe user's Parking Lot: a backlog of ideas for LATER. Do NOT start, plan, or mention these " +
                    "unless the user explicitly asks (e.g. \"do #3\", \"grab the next one\" = topmost open item). If your current " +
                    "work happens to fully complete one, mark it done with parking_update and a completion note.\n" +
                    shown + more + "\n</parking_lot>",
            };
        },
    },
});

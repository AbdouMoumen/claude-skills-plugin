// Session Files: browse and preview the files in the current session's folder.
// Read-only. The canvas is the user's UI; the agent can list files and reveal one in the panel.

import { homedir } from "node:os";
import { join } from "node:path";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { startServer } from "./server.mjs";

let session;
let serverPromise = null;
const openInstances = new Set();

// open() can run (rehydrate) before joinSession resolves, so fall back to the context's sessionId.
function sessionRoot(sessionId) {
    return (
        session?.workspacePath ??
        join(process.env.COPILOT_HOME ?? join(homedir(), ".copilot"), "session-state", sessionId ?? session?.sessionId ?? "unknown")
    );
}

function getServer(sessionId) {
    serverPromise ??= startServer(sessionRoot(sessionId)).catch((err) => {
        serverPromise = null;
        throw err;
    });
    return serverPromise;
}

async function reveal(path, sessionId) {
    try {
        return await (await getServer(sessionId)).reveal(path);
    } catch (err) {
        throw new CanvasError("not_found", err.message);
    }
}

const PATH_PARAM = {
    type: "string",
    description: "File path relative to the session folder (e.g. files/plan.md), or an absolute path inside it.",
};

const canvas = createCanvas({
    id: "session-files",
    displayName: "Session Files",
    description:
        "Browse and preview files in this session's folder (artifacts in files/, research/, checkpoints/). Open when the user wants to see session artifacts; use reveal to show a specific one.",
    inputSchema: { type: "object", properties: { path: PATH_PARAM }, additionalProperties: false },
    actions: [
        {
            name: "list",
            description: "List files in the session folder as relative paths with size and modified time.",
            inputSchema: {
                type: "object",
                properties: {
                    internal: {
                        type: "boolean",
                        description: "Also include internal top-level session files (events.jsonl, session.db, locks).",
                    },
                },
                additionalProperties: false,
            },
            handler: async (ctx) => (await getServer(ctx.sessionId)).list({ internal: !!ctx.input?.internal }),
        },
        {
            name: "reveal",
            description: "Select and preview a file in the open panel.",
            inputSchema: { type: "object", properties: { path: PATH_PARAM }, required: ["path"], additionalProperties: false },
            handler: async (ctx) => reveal(ctx.input.path, ctx.sessionId),
        },
    ],
    open: async (ctx) => {
        openInstances.add(ctx.instanceId);
        const { url } = await getServer(ctx.sessionId);
        if (ctx.input?.path) await reveal(ctx.input.path, ctx.sessionId);
        return { title: "Session Files", url };
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

session = await joinSession({ canvases: [canvas] });

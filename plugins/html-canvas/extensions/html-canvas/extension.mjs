// HTML Canvas: the agent renders HTML straight into a panel. Each panel keeps a navigable
// history saved under the session's files/html-canvas/<instanceId>/, and pages can call
// copilot.send(text, data?) to message the agent.

import { homedir } from "node:os";
import { join } from "node:path";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { startServer, MAX_HTML_BYTES } from "./server.mjs";

let session;
let serverPromise = null;

// open() can run (rehydrate) before joinSession resolves, so fall back to the context's sessionId.
function storeRoot(sessionId) {
    const root =
        session?.workspacePath ??
        join(process.env.COPILOT_HOME ?? join(homedir(), ".copilot"), "session-state", sessionId ?? session?.sessionId ?? "unknown");
    return join(root, "files", "html-canvas");
}

async function onSend({ instanceId, page, title, text, data }) {
    if (!session) throw new Error("Session not ready");
    const where = `${title ? `"${title}"` : "page"}${page > 0 ? ` (page ${page})` : ""}, panel ${instanceId}`;
    const extra = data ? `\n\nData:\n\`\`\`json\n${data}\n\`\`\`` : "";
    await session.send({ prompt: `[HTML Canvas · ${where}] ${text}${extra}`, mode: "immediate" });
}

function getServer(sessionId) {
    serverPromise ??= startServer({ storeRoot: storeRoot(sessionId), onSend }).catch((err) => {
        serverPromise = null;
        throw err;
    });
    return serverPromise;
}

const HTML_PARAM = {
    type: "string",
    description:
        "HTML to render: a full document or a fragment. Fragments are wrapped in a page styled with the app theme. Scripts and external resources (CDNs, fonts, images) are allowed.",
};
const TITLE_PARAM = { type: "string", description: "Title shown in the panel toolbar and history. Defaults to the document's <title>." };

function checkHtml(html) {
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
        throw new CanvasError("too_large", `HTML is over ${MAX_HTML_BYTES / 1024 / 1024} MB.`);
    }
}

const canvas = createCanvas({
    id: "html-canvas",
    displayName: "HTML Canvas",
    description:
        "Render HTML directly in a panel (mockups, explainers, diagrams, interactive widgets) without writing files or starting a server. Pages can call copilot.send(text, data?) to message the agent.",
    inputSchema: {
        type: "object",
        properties: { html: HTML_PARAM, title: TITLE_PARAM },
        additionalProperties: false,
    },
    actions: [
        {
            name: "render",
            description:
                "Render HTML in the panel as a new history page (or replace the current one). Theme CSS variables such as var(--text-color-default), var(--background-color-default), var(--border-color-default), and var(--font-sans) are available. Inside the page, call copilot.send(text, data?) from a button or form to send a message to the agent immediately; data is optional JSON-serializable context.",
            inputSchema: {
                type: "object",
                properties: {
                    html: HTML_PARAM,
                    title: TITLE_PARAM,
                    replace: { type: "boolean", description: "Replace the current page instead of adding a new one (for small iterations)." },
                },
                required: ["html"],
                additionalProperties: false,
            },
            handler: async (ctx) => {
                checkHtml(ctx.input.html);
                return (await getServer(ctx.sessionId)).render(ctx.instanceId, ctx.input);
            },
        },
        {
            name: "list",
            description: "List the panel's history pages (title, time, saved file path) and which one is shown.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            handler: async (ctx) => (await getServer(ctx.sessionId)).list(ctx.instanceId),
        },
        {
            name: "go",
            description: "Show a page from the panel's history.",
            inputSchema: {
                type: "object",
                properties: { page: { type: "integer", minimum: 1, description: "1-based page number from list." } },
                required: ["page"],
                additionalProperties: false,
            },
            handler: async (ctx) => {
                try {
                    return await (await getServer(ctx.sessionId)).go(ctx.instanceId, ctx.input.page);
                } catch (err) {
                    throw new CanvasError("invalid_page", err.message);
                }
            },
        },
    ],
    open: async (ctx) => {
        const server = await getServer(ctx.sessionId);
        // Rehydrate (after reloads/restarts) re-sends the original input; don't add it to history again.
        if (ctx.input?.html) {
            checkHtml(ctx.input.html);
            await server.openWith(ctx.instanceId, ctx.input);
        }
        const state = await server.list(ctx.instanceId);
        const current = state.pages[state.page - 1]?.title;
        return { title: ctx.input?.title || current || "HTML Canvas", url: server.url(ctx.instanceId) };
    },
    onClose: async (ctx) => {
        if (!serverPromise) return;
        const server = await serverPromise;
        await server.release(ctx.instanceId);
        if (server.size === 0 && serverPromise) {
            serverPromise = null;
            await server.close();
        }
    },
});

session = await joinSession({ canvases: [canvas] });

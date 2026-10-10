const $ = (id) => document.getElementById(id);

const state = {
    tree: [],
    files: new Map(),
    truncated: false,
    expanded: new Set(["files", "research"]),
    selected: null,
    current: null,
    mode: "rendered",
    internal: false,
    filter: "",
    openedAt: Date.now(),
    seq: 0,
};

// ---------- helpers ----------

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const unesc = (s) => String(s).replace(/&(amp|lt|gt|quot|#39);/g, (m) => Object.keys(ESC).find((k) => ESC[k] === m));
const safeDecode = (s) => {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
};
const raw = (path) => "raw/" + path.split("/").map(encodeURIComponent).join("/");

async function getJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
}

function ago(ms) {
    const s = (Date.now() - ms) / 1000;
    if (s < 60) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}

function bytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
};

// ---------- tree ----------

function icon(node, open) {
    const { html, color } = fileIcon(node, open);
    return el("span", { className: `icon c-${color}`, innerHTML: html });
}

function index(nodes) {
    for (const n of nodes) {
        if (n.type === "dir") index(n.children);
        else state.files.set(n.path, n);
    }
}

function matches(node, q) {
    if (node.type === "file") return node.path.toLowerCase().includes(q);
    return node.children.some((c) => matches(c, q));
}

function build(nodes, depth, q) {
    const ul = el("ul", { role: depth ? "group" : "none" });
    for (const n of nodes) {
        if (q && !matches(n, q)) continue;
        const open = n.type === "dir" && (!!q || state.expanded.has(n.path));
        const row = el("div", { className: `row ${n.type}`, title: n.path });
        row.dataset.path = n.path;
        row.style.setProperty("--depth", depth);
        row.setAttribute("role", "treeitem");
        row.append(el("span", { className: "twisty" }, n.type === "dir" ? (open ? "▾" : "▸") : ""));
        row.append(icon(n, open));
        row.append(el("span", { className: "name" }, n.name));
        if (n.type === "dir") {
            row.setAttribute("aria-expanded", String(open));
            row.append(el("button", { type: "button", className: "icon-btn open-dir", title: "Open folder" }, "↗"));
        } else {
            if (n.mtime > state.openedAt) row.append(el("span", { className: "dot", title: "Changed since the panel opened" }));
            row.append(el("span", { className: "age", title: new Date(n.mtime).toLocaleString() }, ago(n.mtime)));
        }
        if (n.path === state.selected) {
            row.classList.add("selected");
            row.setAttribute("aria-selected", "true");
        }
        const li = el("li", {}, row);
        if (open) li.append(build(n.children, depth + 1, q));
        ul.append(li);
    }
    return ul;
}

function renderTree() {
    const q = state.filter.trim().toLowerCase();
    const ul = build(state.tree, 0, q);
    const empty = q ? "No matches." : "No files yet. Artifacts the agent writes to files/ show up here.";
    $("tree").replaceChildren(ul.children.length ? ul : el("p", { className: "empty muted" }, empty));
    const n = state.files.size;
    $("count").textContent = `${n}${state.truncated ? "+" : ""} file${n === 1 ? "" : "s"}`;
}

async function loadTree() {
    const t = await getJson(`api/tree${state.internal ? "?internal=1" : ""}`);
    state.tree = t.children;
    state.truncated = t.truncated;
    state.files.clear();
    index(state.tree);
    renderTree();
    if (!state.selected) return;
    const f = state.files.get(state.selected);
    if (!f) showMessage("This file was removed.");
    else if (!state.current || f.mtime !== state.current.mtime) loadPreview(state.selected, { keepScroll: true });
}

function select(path) {
    state.selected = path;
    state.mode = "rendered";
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) state.expanded.add(parts.slice(0, i).join("/"));
    renderTree();
    document.querySelector(`.row[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: "nearest" });
    loadPreview(path);
}

// ---------- preview ----------

function showMessage(text) {
    state.current = null;
    $("preview-head").hidden = true;
    $("body").replaceChildren(el("p", { className: "empty muted" }, text));
}

async function loadPreview(path, { keepScroll = false } = {}) {
    const seq = ++state.seq;
    try {
        const info = await getJson(`api/file?path=${encodeURIComponent(path)}`);
        if (seq !== state.seq) return;
        state.current = info;
        renderPreview(keepScroll);
    } catch (err) {
        if (seq === state.seq) showMessage(err.message);
    }
}

function renderPreview(keepScroll) {
    const f = state.current;
    const body = $("body");
    const scroll = keepScroll ? body.scrollTop : 0;

    $("preview-head").hidden = false;
    $("file-icon").replaceWith(Object.assign(icon({ type: "file", name: f.path.split("/").pop() }), { id: "file-icon" }));
    const crumbs = $("crumbs");
    crumbs.replaceChildren();
    f.path.split("/").forEach((part, i) => {
        if (i) crumbs.append(el("span", { className: "sep" }, "/"));
        crumbs.append(part);
    });
    $("meta").textContent = `${bytes(f.size)} · ${new Date(f.mtime).toLocaleString()}`;
    const toggle = $("mode");
    toggle.hidden = !["markdown", "html", "json"].includes(f.kind);
    toggle.textContent = state.mode === "rendered" ? "Source" : f.kind === "json" ? "Formatted" : "Rendered";
    if (f.truncated) kids.push(el("p", { className: "notice" }, `Showing the first 1 MB of ${bytes(f.size)}. Use Open for the full file.`));
    const source = () => el("pre", {}, f.text);
    const frame = (sandbox) => {
        const iframe = el("iframe", { src: `${raw(f.path)}?v=${f.mtime}`, title: f.path });
        if (sandbox != null) iframe.setAttribute("sandbox", sandbox);
        return iframe;
    };
    const rendered = state.mode === "rendered";

    switch (f.kind) {
        case "image":
            kids.push(el("div", { className: "image" }, el("img", { src: `${raw(f.path)}?v=${f.mtime}`, alt: f.path })));
            break;
        case "pdf":
            kids.push(frame());
            break;
        case "html":
            kids.push(rendered ? frame("allow-scripts allow-popups allow-forms") : source());
            break;
        case "markdown": {
            if (!rendered) {
                kids.push(source());
                break;
            }
            const div = el("div", { className: "md" });
            div.innerHTML = markdown(f.text, f.path.split("/").slice(0, -1).join("/"));
            kids.push(div);
            break;
        }
        case "json": {
            let text = f.text;
            if (rendered && !f.truncated) {
                try {
                    text = JSON.stringify(JSON.parse(f.text), null, 2);
                } catch {}
            }
            kids.push(el("pre", {}, text));
            break;
        }
        case "binary":
            kids.push(el("p", { className: "empty muted" }, "Binary file, no preview. Use Open or Show in folder."));
            break;
        default:
            kids.push(source());
    }
    body.replaceChildren(...kids);
    body.scrollTop = scroll;
}

// ---------- markdown (small, dependency-free subset) ----------

function resolveRel(dir, href) {
    const parts = href.startsWith("/") ? [] : dir.split("/").filter(Boolean);
    for (const seg of href.split("/")) {
        if (!seg || seg === ".") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
    }
    return parts.join("/");
}

function link(text, href, dir) {
    const h = unesc(href);
    if (/^(https?:|mailto:)/i.test(h)) return `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    if (h.startsWith("#")) return `<a href="${esc(h)}">${text}</a>`;
    if (/^[a-z][\w+.-]*:/i.test(h)) return text;
    const path = resolveRel(dir, safeDecode(h.split(/[?#]/)[0]));
    return `<a href="#" data-path="${esc(path)}">${text}</a>`;
}

function image(alt, src, dir) {
    const s = unesc(src);
    if (/^(https?:|data:image\/)/i.test(s)) return `<img alt="${alt}" src="${esc(s)}">`;
    if (/^[a-z][\w+.-]*:/i.test(s)) return alt;
    return `<img alt="${alt}" src="${esc(raw(resolveRel(dir, safeDecode(s.split(/[?#]/)[0]))))}">`;
}

function inline(src, dir) {
    const stash = [];
    const put = (html) => `\u0000${stash.push(html) - 1}\u0000`;
    let s = esc(src);
    s = s.replace(/`([^`]+)`/g, (_, c) => put(`<code>${c}</code>`));
    s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (_, alt, url) => put(image(alt, url, dir)));
    s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (_, text, url) => put(link(text, url, dir)));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+?)([.,;:!?]*)(?=$|[\s<)])/g, (_, pre, url, tail) => pre + put(link(url, url, dir)) + tail);
    s = s
        .replace(/\*\*(?=\S)(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(?=\S)(.+?)__/g, "<strong>$1</strong>")
        .replace(/(^|[^\w*])\*(?=\S)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
        .replace(/(^|[^\w])_(?=\S)(.+?)_(?!\w)/g, "$1<em>$2</em>")
        .replace(/~~(.+?)~~/g, "<del>$1</del>");
    while (s.includes("\u0000")) s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
    return s;
}

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const BLOCK_START = /^\s*(```|~~~|#{1,6}\s|>|([-*+]|\d+[.)])\s|((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$)/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function list(lines, i, dir) {
    const items = [];
    while (i < lines.length) {
        const line = lines[i];
        const m = line.match(LIST_ITEM);
        if (m) {
            items.push({ indent: m[1].replace(/\t/g, "    ").length, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), text: m[3] });
        } else if (line.trim() && /^\s/.test(line)) {
            items[items.length - 1].text += "\n" + line.trim();
        } else if (!line.trim() && LIST_ITEM.test(lines[i + 1] ?? "")) {
            // blank line inside a loose list
        } else {
            break;
        }
        i++;
    }
    let pos = 0;
    const level = (indent) => {
        const first = items[pos];
        const tag = first.ordered ? "ol" : "ul";
        let html = `<${tag}${first.ordered && first.start !== 1 ? ` start="${first.start}"` : ""}>`;
        while (pos < items.length && items[pos].indent >= indent) {
            const it = items[pos++];
            const task = it.text.match(/^\[([ xX])\]\s+(.*)$/s);
            let inner = task
                ? `<input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> ${inline(task[2], dir)}`
                : inline(it.text, dir);
            while (pos < items.length && items[pos].indent > indent) inner += level(items[pos].indent);
            html += `<li${task ? ' class="task"' : ""}>${inner}</li>`;
        }
        return html + `</${tag}>`;
    };
    let html = "";
    while (pos < items.length) html += level(items[pos].indent);
    return { html, next: i };
}

function markdown(text, dir) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        let m;
        if (!line.trim()) {
            i++;
        } else if ((m = line.match(/^\s*(```|~~~)/))) {
            const buf = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith(m[1])) buf.push(lines[i++]);
            i++;
            out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
        } else if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
            const n = m[1].length;
            const html = inline(m[2], dir);
            out.push(`<h${n} id="${esc(slug(html))}">${html}</h${n}>`);
            i++;
        } else if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
            out.push("<hr>");
            i++;
        } else if (/^\s*>/.test(line)) {
            const buf = [];
            while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
            out.push(`<blockquote>${markdown(buf.join("\n"), dir)}</blockquote>`);
        } else if (line.includes("|") && TABLE_SEP.test(lines[i + 1] ?? "") && lines[i + 1].includes("-")) {
            const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
            const aligns = cells(lines[i + 1]).map((c) =>
                c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : "",
            );
            const row = (l, tag) =>
                "<tr>" +
                cells(l)
                    .map((c, k) => `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${inline(c.replace(/\\\|/g, "|"), dir)}</${tag}>`)
                    .join("") +
                "</tr>";
            let html = `<table><thead>${row(line, "th")}</thead><tbody>`;
            i += 2;
            while (i < lines.length && lines[i].trim() && lines[i].includes("|")) html += row(lines[i++], "td");
            out.push(html + "</tbody></table>");
        } else if (LIST_ITEM.test(line)) {
            const res = list(lines, i, dir);
            out.push(res.html);
            i = res.next;
        } else {
            const buf = [lines[i++]];
            while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) buf.push(lines[i++]);
            out.push(`<p>${inline(buf.map((l) => l.trim()).join("\n"), dir)}</p>`);
        }
    }
    return out.join("\n");
}

// ---------- open with the OS ----------

let toastTimer = null;
function toast(text, error = false) {
    const t = $("toast");
    t.textContent = text;
    t.className = error ? "error" : "";
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), error ? 5000 : 2500);
}

async function openOnHost(path, reveal = false) {
    try {
        const res = await fetch("api/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, reveal }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || res.statusText);
        const name = r.path || "session folder";
        toast(
            r.blocked
                ? `${name} could run code, so it's shown in its folder instead.`
                : r.action === "folder" ? `Opened ${name}` : r.action === "revealed" ? `Showing ${name} in its folder` : `Opened ${name}`,
        );
    } catch (err) {
        toast(`Couldn't open: ${err.message}`, true);
    }
}

// ---------- events ----------

$("tree").addEventListener("dblclick", (e) => {
    const row = e.target.closest(".row.file");
    if (row) openOnHost(row.dataset.path);
});

$("open-root").addEventListener("click", () => openOnHost(""));
$("open").addEventListener("click", () => state.current && openOnHost(state.current.path));
$("reveal").addEventListener("click", () => state.current && openOnHost(state.current.path, true));

$("tree").addEventListener("click", (e) => {
    const row = e.target.closest(".row");
    if (!row) return;
    const path = row.dataset.path;
    if (e.target.closest(".open-dir")) return openOnHost(path);
    if (row.classList.contains("dir")) {
        if (state.expanded.has(path)) state.expanded.delete(path);
        else state.expanded.add(path);
        renderTree();
    } else {
        select(path);
    }
});

document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea") && e.target.id !== "internal") return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...document.querySelectorAll(".row.file")];
    if (!rows.length) return;
    e.preventDefault();
    const at = rows.findIndex((r) => r.dataset.path === state.selected);
    const next = e.key === "ArrowDown" ? Math.min(at + 1, rows.length - 1) : Math.max(at - 1, 0);
    select(rows[at < 0 ? 0 : next].dataset.path);
});

$("body").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-path]");
    if (!a) return;
    e.preventDefault();
    select(a.dataset.path);
});

$("filter").addEventListener("input", (e) => {
    state.filter = e.target.value;
    renderTree();
});

$("internal").addEventListener("change", (e) => {
    state.internal = e.target.checked;
    loadTree();
});

$("mode").addEventListener("click", () => {
    state.mode = state.mode === "rendered" ? "source" : "rendered";
    renderPreview(false);
});

$("copy").addEventListener("click", async () => {
    const text = state.current?.absolutePath;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = el("textarea", { value: text });
        document.body.append(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
    }
    $("copy").textContent = "Copied";
    setTimeout(() => ($("copy").textContent = "Copy path"), 1200);
});

const events = new EventSource("events");
events.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "hello") {
        await loadTree();
        if (msg.selected && !state.selected) select(msg.selected);
    } else if (msg.type === "changed") {
        loadTree();
    } else if (msg.type === "reveal") {
        await loadTree();
        select(msg.path);
    }
};

setInterval(renderTree, 60_000);

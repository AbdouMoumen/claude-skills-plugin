const $ = (id) => document.getElementById(id);
const MAX_BYTES = 25 * 1024 * 1024;
const UNDO_MS = 6000; // the server keeps deleted items' files a little longer (store.mjs UNDO_MS)
const KEYS = "↑/↓ select · Space done · E edit · Q queue · A ask · Del delete · Alt+↑/↓ move · Esc deselect · / or N add";
let state = { items: [] };
let editing = null;
let editAtts = null; // refreshes the chips of the open ✎ form without re-rendering its inputs
let dragId = null;
let dragGroup = null;
let selected = null;
let menu = null; // the open ▾ menu: { el, anchor, id }
let stale = false; // an update arrived while the menu was open
let toastTimer = null;
let pendingUploads = []; // pasted into the add box before the item exists: { entry, url }
const expanded = new Set();

async function api(path, body) {
  const res = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { alert(json.error || res.statusText); return null; }
  return json.result;
}

// Uploads one pasted file. With itemId it's attached right away; without, it's held for the next add.
async function upload(file, itemId) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name || "Pasted file"} is larger than 25 MB`);
  const q = new URLSearchParams({ name: file.name || "", mime: file.type || "" });
  if (itemId != null) q.set("item", itemId);
  const res = await fetch("/upload?" + q, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.result;
}

// Pasting files uploads them; pasted text keeps its default behavior.
function onPasteFiles(errEl, handle) {
  return async (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length || e.clipboardData.getData("text/plain")) return;
    e.preventDefault();
    errEl.textContent = "";
    for (const f of files) {
      try { await handle(f); } catch (err) { errEl.textContent = err.message; }
    }
  };
}

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/g;

// Plain-text notes with clickable http(s) links, built without innerHTML.
function linkify(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    frag.append(text.slice(last, m.index), el("a", { href: m[0], textContent: m[0], target: "_blank", rel: "noopener noreferrer" }));
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function notesView(item) {
  const n = el("div", { className: "meta notes" + (expanded.has(item.id) ? " expanded" : ""), title: "Click to expand/collapse" }, linkify(item.notes));
  n.addEventListener("click", (e) => {
    if (e.target.closest("a") || getSelection().toString()) return;
    if (!n.classList.toggle("expanded")) expanded.delete(item.id); else expanded.add(item.id);
  });
  return n;
}

function showImage(src) {
  const close = () => { o.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const o = el("div", { className: "overlay", title: "Click to close", onclick: close }, el("img", { src }));
  document.addEventListener("keydown", onKey);
  document.body.append(o);
}

function chip(a, src, onRemove) {
  const isImage = a.kind === "copy" && a.mime?.startsWith("image/") && !a.missing;
  const c = el("span", { className: "chip" + (a.missing ? " missing" : ""), title: (a.missing ? "Missing: " : "") + (a.path || a.name) });
  if (isImage) {
    c.append(el("img", { src, alt: a.name, onclick: () => showImage(src) }));
  } else {
    c.append((a.missing ? "⚠ " : "📎 ") + a.name);
  }
  if (onRemove) c.append(el("button", { className: "x", textContent: "×", title: "Remove attachment", onclick: onRemove }));
  return c;
}

function chips(item, editable) {
  const atts = item.attachments || [];
  return el("div", { className: "atts" }, ...atts.map((a) => chip(a, `/files/${item.id}/${a.id}`,
    editable && (() => api("remove-attachment", { id: item.id, attachmentId: a.id })))));
}

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function group(item) {
  return item.status === "in_progress" ? "now" : item.status === "done" ? "done" : "next";
}

function makeDraggable(li, item) {
  li.draggable = true;
  li.append(el("span", { className: "grip", textContent: "⋮⋮", title: "Drag to reorder" }));
  li.addEventListener("dragstart", () => { dragId = item.id; dragGroup = group(item); li.classList.add("dragging"); });
  li.addEventListener("dragend", () => { dragId = null; dragGroup = null; li.classList.remove("dragging"); });
  // Reordering stays within a section (Now / Up next); the result is saved over the global order.
  li.addEventListener("dragover", (e) => {
    if (dragGroup !== group(item)) return;
    e.preventDefault();
    li.classList.add("over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("over");
    if (dragId == null || dragId === item.id || dragGroup !== group(item)) return;
    const ids = state.items.map((i) => i.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(item.id), 0, dragId);
    api("reorder", { ids });
  });
}

// Alt+↑/↓: swap with the neighbor in the same section.
function move(item, dir) {
  const g = group(item);
  if (g === "done") return;
  const peers = state.items.filter((i) => group(i) === g);
  const target = peers[peers.indexOf(item) + dir];
  if (!target) return;
  const ids = state.items.map((i) => i.id).filter((id) => id !== item.id);
  ids.splice(ids.indexOf(target.id) + (dir > 0 ? 1 : 0), 0, item.id);
  api("reorder", { ids });
}

function editor(item) {
  const t = el("input", { type: "text", value: item.text });
  const n = el("textarea", { value: item.notes || "", placeholder: "Notes (optional). Paste screenshots or files here." });
  const err = el("div", { className: "err" });
  const atts = el("div", {}, chips(item, true));
  editAtts = () => {
    const fresh = state.items.find((i) => i.id === item.id);
    if (fresh) atts.replaceChildren(chips(fresh, true));
  };
  const close = () => { editing = null; editAtts = null; };
  const save = () => { close(); api("edit", { id: item.id, text: t.value, notes: n.value }); };
  const cancel = () => { close(); render(); };
  for (const f of [t, n]) {
    f.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && (f === t || e.ctrlKey)) { e.preventDefault(); save(); }
    });
    f.addEventListener("paste", onPasteFiles(err, (file) => upload(file, item.id)));
  }
  setTimeout(() => t.focus(), 0);
  return el("div", { className: "edit-box" }, t, n, atts, err,
    el("div", {}, el("button", { textContent: "Save", onclick: save }), " ",
      el("button", { textContent: "Cancel", onclick: cancel })));
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });
const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

function relTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const secs = (t - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return rtf.format(0, "second");
}

function stamp(item) {
  const done = item.status === "done";
  const iso = done ? item.completedAt : item.createdAt;
  const rel = iso && relTime(iso);
  if (!rel) return null;
  return el("span", { className: "when", textContent: (done ? "done " : "added ") + rel, title: new Date(iso).toLocaleString() });
}

function completedTime(item) {
  const t = item.completedAt ? Date.parse(item.completedAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

function display(item) {
  const done = item.status === "done";
  const wrap = el("div");
  const text = el("div", { className: "text", textContent: item.text, title: "Double-click to edit" });
  if (item.addedBy === "agent") text.append(el("span", { className: "badge", textContent: "🤖", title: "Added by agent" }));
  if (done && item.completedBy === "agent") text.append(el("span", { className: "badge", textContent: "🤖✓", title: "Completed by agent" }));
  const when = stamp(item);
  if (when) text.append(when);
  text.addEventListener("dblclick", () => { editing = item.id; render(); });
  wrap.append(text);
  if (item.notes) wrap.append(notesView(item));
  if (item.attachments?.length) wrap.append(chips(item, false));
  if (done && item.completionNote) wrap.append(el("div", { className: "meta", textContent: "✓ " + item.completionNote }));
  return wrap;
}

function toast(text, undo) {
  const ms = undo ? UNDO_MS : 2500;
  const t = $("toast");
  clearTimeout(toastTimer);
  const row = el("div", { className: "toast-row" }, el("span", { textContent: text }));
  if (undo) {
    row.append(" · ", el("button", { type: "button", textContent: "Undo", onclick: () => { hideToast(); undo(); } }));
  }
  const bar = el("div", { className: "bar" });
  bar.style.animationDuration = ms + "ms";
  t.replaceChildren(row, bar);
  t.hidden = false;
  toastTimer = setTimeout(hideToast, ms);
}

function hideToast() {
  clearTimeout(toastTimer);
  $("toast").hidden = true;
  $("toast").replaceChildren();
}

// Deletes are soft on the server; Undo puts the items back exactly as they were.
function undoToast(text, r) {
  const files = r.files ? ` incl. ${r.files} file${r.files === 1 ? "" : "s"}` : "";
  toast(text + files, async () => {
    if (await api("restore", { token: r.token }) && r.ids.length === 1) select(r.ids[0], true);
  });
}

async function copyText(item) {
  try {
    await navigator.clipboard.writeText(item.text);
  } catch {
    const ta = el("textarea", { value: item.text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(`Copied #${item.id}`);
}

// The send request can stay pending until the host accepts the message, so ignore repeats in flight.
const sending = new Set();
async function sendItem(item, body, feedback) {
  const key = `${item.id}:${body.kind || "work"}`;
  if (sending.has(key)) return;
  sending.add(key);
  if (feedback) toast(feedback);
  try { await api("send", { id: item.id, ...body }); } finally { sending.delete(key); }
}

const actions = {
  queue: (item) => sendItem(item, { mode: "enqueue" }),
  now: (item) => sendItem(item, { mode: "immediate" }),
  ask: (item) => sendItem(item, { kind: "ask" }, `Asked the agent about #${item.id}`),
  edit: (item) => { selected = item.id; editing = item.id; render(); },
  copy: copyText,
  toggle: (item) => api("status", { id: item.id, status: item.status === "done" ? "open" : "done" }),
  del: async (item) => {
    if (selected === item.id) select(neighbor(item.id));
    const r = await api("delete", { id: item.id });
    if (r?.token) undoToast(`Deleted #${item.id}`, r);
  },
};

function menuEntries(item) {
  const entries = item.status === "done" ? [] : [
    { label: "⚡ Send now", run: actions.now, title: "Send to the agent now (steer)" },
    { label: "? Ask (answer, don't do)", key: "A", run: actions.ask, title: "Ask the agent about it without starting the work" },
    null,
  ];
  entries.push(
    { label: "Edit", key: "E", run: actions.edit },
    { label: "Copy text", run: actions.copy },
    null,
    { label: "Delete", key: "Del", run: actions.del, danger: true },
  );
  return entries;
}

function openMenu(anchor, item) {
  closeMenu(false);
  select(item.id);
  const m = el("div", { className: "menu" });
  m.setAttribute("role", "menu");
  const buttons = [];
  for (const e of menuEntries(item)) {
    if (!e) { m.append(el("div", { className: "sep" })); continue; }
    const b = el("button", { type: "button", tabIndex: -1, className: e.danger ? "danger" : "", title: e.title || "" },
      el("span", { textContent: e.label }), e.key ? el("kbd", { textContent: e.key }) : null);
    b.setAttribute("role", "menuitem");
    b.addEventListener("click", () => { closeMenu(false); e.run(item); });
    buttons.push(b);
    m.append(b);
  }
  m.addEventListener("keydown", (ev) => {
    const i = buttons.indexOf(document.activeElement);
    const go = (n) => buttons[(n + buttons.length) % buttons.length].focus();
    if (ev.key === "ArrowDown") go(i + 1);
    else if (ev.key === "ArrowUp") go(i < 0 ? -1 : i - 1);
    else if (ev.key === "Home") go(0);
    else if (ev.key === "End") go(-1);
    else if (ev.key === "Escape" || ev.key === "Tab") closeMenu(true);
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  const below = r.bottom + 2 + m.offsetHeight <= innerHeight;
  m.style.top = (below ? r.bottom + 2 : Math.max(4, r.top - 2 - m.offsetHeight)) + "px";
  m.style.left = Math.max(4, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 4)) + "px";
  anchor.setAttribute("aria-expanded", "true");
  menu = { el: m, anchor, id: item.id };
  buttons[0].focus();
}

function closeMenu(refocus) {
  if (!menu) return;
  const { el: m, anchor, id } = menu;
  menu = null;
  m.remove();
  anchor.setAttribute("aria-expanded", "false");
  if (stale) { stale = false; if (editing == null) render(); }
  if (refocus) document.querySelector(`li[data-id="${id}"] .more`)?.focus();
}

function rowActions(item) {
  const more = el("button", { type: "button", className: "more", textContent: "▾", title: "More actions" });
  more.setAttribute("aria-haspopup", "menu");
  more.setAttribute("aria-expanded", "false");
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu?.id === item.id) closeMenu(true); else openMenu(more, item);
  });
  more.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    e.stopPropagation();
    openMenu(more, item);
  });
  if (item.status === "done") return el("span", { className: "split solo" }, more);
  const main = el("button", { type: "button", className: "main", textContent: "▶ Queue",
    title: "Queue for the agent, after its current work (Q)" });
  main.addEventListener("click", (e) => { e.stopPropagation(); select(item.id); actions.queue(item); });
  return el("span", { className: "split" }, main, more);
}

function row(item) {
  const done = item.status === "done";
  const cls = [done && "done", item.status === "in_progress" && "wip", selected === item.id && "selected"];
  const li = el("li", { className: cls.filter(Boolean).join(" ") });
  li.dataset.id = item.id;
  if (!done) makeDraggable(li, item);

  const cb = el("input", { type: "checkbox", checked: done, title: done ? "Reopen (Space)" : "Mark done (Space)" });
  cb.addEventListener("change", () => api("status", { id: item.id, status: cb.checked ? "done" : "open" }));
  li.append(cb, el("span", { className: "id", textContent: "#" + item.id }));
  li.append(el("div", { className: "body" }, editing === item.id ? editor(item) : display(item)));
  if (editing !== item.id) li.append(rowActions(item));
  li.addEventListener("click", (e) => {
    if (!e.target.closest("input, textarea, .edit-box")) select(item.id);
  });
  return li;
}

function groups() {
  const now = state.items.filter((i) => i.status === "in_progress");
  const next = state.items.filter((i) => i.status === "open");
  const done = state.items.filter((i) => i.status === "done")
    .sort((a, b) => {
      const ta = completedTime(a), tb = completedTime(b);
      return ta === tb ? 0 : tb > ta ? 1 : -1;
    });
  return { now, next, done };
}

// Rows in on-screen order; done rows only while the Done section is expanded.
function visibleOrder() {
  const { now, next, done } = groups();
  return [...now, ...next, ...($("doneWrap").open ? done : [])];
}

function neighbor(id) {
  const order = visibleOrder();
  const i = order.findIndex((x) => x.id === id);
  if (i < 0) return null;
  return (order[i + 1] ?? order[i - 1])?.id ?? null;
}

function select(id, scroll) {
  selected = id;
  if (id != null && document.activeElement?.matches("input, textarea")) document.activeElement.blur();
  for (const li of document.querySelectorAll("li[data-id]")) li.classList.toggle("selected", Number(li.dataset.id) === id);
  if (scroll && id != null) document.querySelector(`li[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

function emptyState() {
  return el("li", { className: "empty" },
    el("div", { textContent: (state.items.length ? "Nothing open." : "Nothing parked yet.") +
      " Ideas for later: the agent won't act on these unless you ask." }),
    el("div", { className: "keys", textContent: "Enter add · Shift+Enter notes · " + KEYS }));
}

function render() {
  const { now, next, done } = groups();
  if (selected != null && !state.items.some((i) => i.id === selected)) selected = null;
  $("now").replaceChildren(...now.map(row));
  $("open").replaceChildren(...(now.length || next.length ? next.map(row) : [emptyState()]));
  $("now").hidden = $("nowLabel").hidden = !now.length;
  $("nextLabel").hidden = !now.length || !next.length;
  $("done").replaceChildren(...done.map(row));
  $("doneLabel").textContent = `Done (${done.length})`;
  $("doneWrap").style.display = done.length ? "" : "none";
  const on = now.length ? ` · on ${now.map((i) => "#" + i.id).join(", ")}` : "";
  $("summary").textContent = ` · ${now.length + next.length} open${on}`;
}

function renderPending() {
  $("addAtts").replaceChildren(...pendingUploads.map((p) => chip(p.entry, p.url, () => {
    pendingUploads = pendingUploads.filter((x) => x !== p);
    URL.revokeObjectURL(p.url);
    renderPending();
    api("discard-upload", { uploadId: p.entry.id });
  })));
}

function showAddNotes() {
  $("addExtra").hidden = false;
  $("addNotes").focus();
}

function submitAdd() {
  const v = $("text").value.trim();
  if (!v) { $("text").focus(); return; }
  const notes = $("addNotes").value;
  const uploads = pendingUploads.map((p) => p.entry.id);
  for (const p of pendingUploads) URL.revokeObjectURL(p.url);
  pendingUploads = [];
  $("text").value = "";
  $("addNotes").value = "";
  $("addErr").textContent = "";
  $("addExtra").hidden = true;
  renderPending();
  $("text").focus();
  api("add", { text: v, notes, uploads });
}

$("add").addEventListener("submit", (e) => {
  e.preventDefault();
  submitAdd();
});

$("text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); showAddNotes(); }
});

$("addNotes").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAdd(); }
});

$("addNotes").addEventListener("paste", onPasteFiles($("addErr"), async (file) => {
  const entry = await upload(file);
  pendingUploads.push({ entry, url: URL.createObjectURL(file) });
  renderPending();
}));

$("clear").addEventListener("click", async (e) => {
  e.preventDefault();
  const r = await api("clear-done");
  if (r?.token) undoToast(`Cleared ${r.count} done`, r);
});

$("title").title = "Shortcuts: " + KEYS;

// Outside click closes the ▾ menu; so do scrolling and resizing, which would detach it from its button.
document.addEventListener("mousedown", (e) => {
  if (menu && !menu.el.contains(e.target) && !menu.anchor.contains(e.target)) closeMenu(false);
}, true);
addEventListener("resize", () => closeMenu(false));
document.addEventListener("scroll", () => closeMenu(false), true);

const KEY_ACTIONS = { " ": "toggle", e: "edit", q: "queue", a: "ask", Delete: "del", Backspace: "del" };

document.addEventListener("keydown", (e) => {
  if (menu || e.defaultPrevented || e.ctrlKey || e.metaKey || document.querySelector(".overlay")) return;
  const t = e.target;
  if (t.closest?.("input, textarea, select, [contenteditable]")) return;
  const k = e.key;
  if ((k === "/" || k === "n" || k === "N") && !e.altKey) {
    e.preventDefault();
    $("text").focus();
    return;
  }
  const item = state.items.find((i) => i.id === selected);
  if (k === "ArrowUp" || k === "ArrowDown") {
    const dir = k === "ArrowDown" ? 1 : -1;
    if (e.altKey) {
      if (item && editing == null) move(item, dir);
    } else {
      const order = visibleOrder();
      if (!order.length) return;
      const i = order.findIndex((x) => x.id === selected);
      const n = i < 0 ? (dir > 0 ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, i + dir));
      select(order[n].id, true);
    }
    e.preventDefault();
    return;
  }
  if (k === "Escape") {
    if (selected != null) { e.preventDefault(); select(null); }
    return;
  }
  if (!item || editing != null || e.altKey) return;
  // Space/Enter on a focused button or link keep their normal meaning.
  if ((k === " " || k === "Enter") && t.closest?.("button, a, summary")) return;
  const run = KEY_ACTIONS[k.length === 1 ? k.toLowerCase() : k];
  if (!run || (item.status === "done" && (run === "queue" || run === "ask"))) return;
  e.preventDefault();
  if (e.repeat) return;
  // Marking done hides the row when the Done section is collapsed; keep the selection in view.
  if (run === "toggle" && item.status !== "done" && !$("doneWrap").open) select(neighbor(item.id));
  actions[run](item);
});

const events = new EventSource("/events");
events.onmessage = (e) => {
  state = JSON.parse(e.data);
  if (editing != null) editAtts?.();
  else if (menu) stale = true;
  else render();
};
setInterval(() => { if (editing == null && dragId == null && !menu) render(); }, 60000);
render();

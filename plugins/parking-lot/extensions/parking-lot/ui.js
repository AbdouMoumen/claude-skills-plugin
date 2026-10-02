const $ = (id) => document.getElementById(id);
const MAX_BYTES = 25 * 1024 * 1024;
let state = { items: [] };
let editing = null;
let editAtts = null; // refreshes the chips of the open ✎ form without re-rendering its inputs
let dragId = null;
let pendingUploads = []; // pasted into the add box before the item exists: { entry, url }
const expanded = new Set();

async function api(path, body) {
  const res = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) alert((await res.json().catch(() => ({}))).error || res.statusText);
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

function copyCount(items) {
  return items.reduce((n, i) => n + (i.attachments || []).filter((a) => a.kind === "copy").length, 0);
}

function deleteWarning(items) {
  const n = copyCount(items);
  return n ? `\nThis will delete ${n} screenshot(s)/file(s).` : "";
}

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function makeDraggable(li, item) {
  li.draggable = true;
  li.append(el("span", { className: "grip", textContent: "⋮⋮", title: "Drag to reorder" }));
  li.addEventListener("dragstart", () => { dragId = item.id; li.classList.add("dragging"); });
  li.addEventListener("dragend", () => { dragId = null; li.classList.remove("dragging"); });
  li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("over"); });
  li.addEventListener("dragleave", () => li.classList.remove("over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("over");
    if (dragId == null || dragId === item.id) return;
    const ids = state.items.map((i) => i.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(item.id), 0, dragId);
    api("reorder", { ids });
  });
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
  if (item.status === "in_progress") text.append(el("span", { className: "badge wip", textContent: "in progress" }));
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

function row(item) {
  const done = item.status === "done";
  const li = el("li", { className: done ? "done" : "" });
  if (!done) makeDraggable(li, item);

  const cb = el("input", { type: "checkbox", checked: done, title: done ? "Reopen" : "Mark done" });
  cb.addEventListener("change", () => api("status", { id: item.id, status: cb.checked ? "done" : "open" }));
  li.append(cb, el("span", { className: "id", textContent: "#" + item.id }));
  li.append(el("div", { className: "body" }, editing === item.id ? editor(item) : display(item)));

  if (!done) {
    li.append(
      el("button", { className: "icon", textContent: "▶", title: "Queue for the agent (after current work)", onclick: () => api("send", { id: item.id, mode: "enqueue" }) }),
      el("button", { className: "icon", textContent: "⚡", title: "Send to the agent now (steer)", onclick: () => api("send", { id: item.id, mode: "immediate" }) }),
    );
  }
  if (editing !== item.id) {
    li.append(el("button", { className: "icon", textContent: "✎", title: "Edit", onclick: () => { editing = item.id; render(); } }));
  }
  const del = el("button", { className: "icon", textContent: "✕", title: "Delete" });
  del.addEventListener("click", () => { if (confirm(`Delete #${item.id}?${deleteWarning([item])}`)) api("delete", { id: item.id }); });
  li.append(del);
  return li;
}

function render() {
  const open = state.items.filter((i) => i.status !== "done");
  const done = state.items.filter((i) => i.status === "done")
    .sort((a, b) => {
      const ta = completedTime(a), tb = completedTime(b);
      return ta === tb ? 0 : tb > ta ? 1 : -1;
    });
  $("open").replaceChildren(...(open.length ? open.map(row) : [el("li", { className: "empty", textContent: "Nothing parked yet." })]));
  $("done").replaceChildren(...done.map(row));
  $("doneLabel").textContent = `Done (${done.length})`;
  $("doneWrap").style.display = done.length ? "" : "none";
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

$("clear").addEventListener("click", (e) => {
  e.preventDefault();
  const done = state.items.filter((i) => i.status === "done");
  if (confirm("Remove all done items?" + deleteWarning(done))) api("clear-done");
});

const events = new EventSource("/events");
events.onmessage = (e) => {
  state = JSON.parse(e.data);
  if (editing == null) render();
  else editAtts?.();
};
setInterval(() => { if (editing == null && dragId == null) render(); }, 60000);
render();

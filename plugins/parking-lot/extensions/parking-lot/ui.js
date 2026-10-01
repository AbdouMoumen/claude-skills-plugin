const $ = (id) => document.getElementById(id);
let state = { items: [] };
let editing = null;
let dragId = null;

async function api(path, body) {
  const res = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) alert((await res.json().catch(() => ({}))).error || res.statusText);
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
  const n = el("textarea", { value: item.notes || "", placeholder: "Notes (optional)" });
  const save = () => { editing = null; api("edit", { id: item.id, text: t.value, notes: n.value }); };
  const cancel = () => { editing = null; render(); };
  for (const f of [t, n]) {
    f.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && (f === t || e.ctrlKey)) { e.preventDefault(); save(); }
    });
  }
  setTimeout(() => t.focus(), 0);
  return el("div", { className: "edit-box" }, t, n,
    el("div", {}, el("button", { textContent: "Save", onclick: save }), " ",
      el("button", { textContent: "Cancel", onclick: cancel })));
}

function display(item) {
  const done = item.status === "done";
  const wrap = el("div");
  const text = el("div", { className: "text", textContent: item.text, title: "Double-click to edit" });
  if (item.addedBy === "agent") text.append(el("span", { className: "badge", textContent: "🤖", title: "Added by agent" }));
  if (item.status === "in_progress") text.append(el("span", { className: "badge wip", textContent: "in progress" }));
  if (done && item.completedBy === "agent") text.append(el("span", { className: "badge", textContent: "🤖✓", title: "Completed by agent" }));
  text.addEventListener("dblclick", () => { editing = item.id; render(); });
  wrap.append(text);
  if (item.notes) wrap.append(el("div", { className: "meta", textContent: item.notes }));
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
  const del = el("button", { className: "icon", textContent: "✕", title: "Delete" });
  del.addEventListener("click", () => { if (confirm(`Delete #${item.id}?`)) api("delete", { id: item.id }); });
  li.append(del);
  return li;
}

function render() {
  const open = state.items.filter((i) => i.status !== "done");
  const done = state.items.filter((i) => i.status === "done");
  $("open").replaceChildren(...(open.length ? open.map(row) : [el("li", { className: "empty", textContent: "Nothing parked yet." })]));
  $("done").replaceChildren(...done.map(row));
  $("doneLabel").textContent = `Done (${done.length})`;
  $("doneWrap").style.display = done.length ? "" : "none";
}

$("add").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("text").value.trim();
  if (!v) return;
  $("text").value = "";
  api("add", { text: v });
});

$("clear").addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("Remove all done items?")) api("clear-done");
});

const events = new EventSource("/events");
events.onmessage = (e) => {
  state = JSON.parse(e.data);
  if (editing == null) render();
};
render();

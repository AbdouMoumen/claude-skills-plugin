(() => {
    const instanceId = new URLSearchParams(location.search).get("i") ?? "";
    const $ = (id) => document.getElementById(id);
    const frame = $("frame");
    const historySel = $("history");
    const MARK = "__htmlCanvas";
    const THEME_ATTRS = ["data-color-mode", "data-dark-theme", "data-light-theme", "data-theme-source", "data-theme-tone", "data-visual-mode"];
    const FALLBACK_VARS = [
        "--background-color-default", "--border-color-default", "--text-color-default", "--text-color-muted",
        "--color-focus-outline", "--color-white", "--true-color-red", "--true-color-red-muted", "--true-color-blue",
        "--true-color-blue-muted", "--true-color-green", "--true-color-green-muted", "--true-color-yellow",
        "--true-color-yellow-muted", "--true-color-purple", "--true-color-purple-muted", "--font-sans", "--font-sans-display",
        "--font-mono", "--font-weight-semibold", "--text-body-medium", "--leading-body-medium", "--text-title-large",
        "--leading-title-large", "--text-code-inline",
    ];

    let state = { page: 0, count: 0, pages: [], pageIds: [] };
    let shownId = null;

    let toastTimer;
    function toast(text, error = false) {
        const el = $("toast");
        el.textContent = text;
        el.className = error ? "error" : "";
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => (el.hidden = true), 2500);
    }

    async function post(route, body) {
        const res = await fetch(route, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instanceId, ...body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
    }

    // The app injects its theme into this document; forward it so rendered pages can use the same tokens.
    function themePayload() {
        const root = document.documentElement;
        const cs = getComputedStyle(root);
        const names = new Set(FALLBACK_VARS);
        for (let i = 0; i < cs.length; i++) if (cs[i].startsWith("--")) names.add(cs[i]);
        const vars = {};
        for (const n of names) {
            const v = cs.getPropertyValue(n).trim();
            if (v) vars[n] = v;
        }
        const attrs = {};
        for (const a of THEME_ATTRS) {
            const v = root.getAttribute(a) ?? document.body.getAttribute(a);
            if (v != null) attrs[a] = v;
        }
        return { [MARK]: "theme", vars, attrs };
    }

    const sendTheme = () => frame.contentWindow?.postMessage(themePayload(), "*");
    new MutationObserver(sendTheme).observe(document.documentElement, { attributes: true });
    new MutationObserver(sendTheme).observe(document.body, { attributes: true });

    window.addEventListener("message", async (e) => {
        if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
        if (e.data[MARK] === "ready") return sendTheme();
        if (e.data[MARK] !== "send") return;
        const text = typeof e.data.text === "string" ? e.data.text : "";
        try {
            await post("api/send", { pageId: shownId, text, data: e.data.data });
            toast(`Sent to agent: ${text}`);
        } catch (err) {
            toast(`Couldn't send: ${err.message}`, true);
        }
    });

    function render() {
        const { page, count, pages, pageIds } = state;
        $("empty").hidden = count > 0;
        frame.hidden = count === 0;
        $("back").disabled = page <= 1;
        $("forward").disabled = page >= count;
        $("reload").disabled = count === 0;
        historySel.disabled = count === 0;
        $("count").textContent = count ? `${page}/${count}` : "";

        historySel.replaceChildren(
            ...pages.map((p) => {
                const o = document.createElement("option");
                o.value = String(p.page);
                o.textContent = `${p.page}. ${p.title}`;
                o.title = `${p.title} · ${new Date(p.at).toLocaleString()}`;
                return o;
            }),
        );
        if (count) historySel.value = String(page);

        const id = pageIds[page - 1] ?? null;
        if (id !== shownId) {
            shownId = id;
            if (id) frame.src = `page/${id}`;
            else frame.removeAttribute("src");
        }
        document.title = pages[page - 1]?.title ?? "HTML Canvas";
    }

    const go = (page) => post("api/go", { page }).catch((err) => toast(err.message, true));
    $("back").onclick = () => go(state.page - 1);
    $("forward").onclick = () => go(state.page + 1);
    historySel.onchange = () => go(Number(historySel.value));
    $("reload").onclick = () => shownId && (frame.src = `page/${shownId}`);

    const events = new EventSource(`events?i=${encodeURIComponent(instanceId)}`);
    events.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
            state = msg;
            render();
        }
    };

    render();
})();

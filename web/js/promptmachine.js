import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const SECTIONS = ["quality","character","outfit","pose","environment","lighting","extra","negative"];
const OPTS = ["delimiter","seed","dedupe_tags","clean_whitespace","style_preset"];

function fetchApi(path, opts) {
  try { if (api && api.fetchApi) return api.fetchApi(path, opts); } catch (e) {}
  return fetch(path, opts);
}


// ---------------- side panel (snippets + autocomplete) ----------------
const P = { el: null, ta: null, node: null, section: null, items: [], sel: 0, snippets: {}, raf: 0, timer: null };

function el(tag, style, text) {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, style);
  if (text != null) e.textContent = text;
  return e;
}

function buildPanel() {
  if (P.el) return P.el;
  const p = el("div", { position: "fixed", zIndex: 100000, width: "280px", maxHeight: "70vh", display: "none",
    flexDirection: "column", background: "var(--comfy-menu-bg, #202020)", color: "var(--fg-color, #ddd)",
    border: "1px solid var(--border-color, #4e4e4e)", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,.6)",
    font: "12px sans-serif", overflow: "hidden" });
  const head = el("div", { display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px",
    background: "var(--comfy-input-bg, #2a2a2a)", borderBottom: "1px solid #444" });
  P.title = el("b", { flex: "1", textTransform: "capitalize" }, "");
  const save = el("button", { background: "#3a5a8a", color: "#fff", border: "none", borderRadius: "4px",
    padding: "3px 8px", cursor: "pointer", fontSize: "11px" }, "Save current");
  save.addEventListener("click", saveCurrent);
  head.append(P.title, save);
  P.search = el("input", { margin: "6px 8px", padding: "4px 6px", background: "#151515", color: "#ddd",
    border: "1px solid #444", borderRadius: "4px", fontSize: "12px" });
  P.search.placeholder = "Filter snippets...";
  P.search.addEventListener("input", renderSnippets);
  P.list = el("div", { overflowY: "auto", maxHeight: "35vh", padding: "0 4px" });
  P.sugHead = el("div", { padding: "4px 8px", opacity: ".6", borderTop: "1px solid #444", marginTop: "4px" }, "Tags");
  P.sug = el("div", { overflowY: "auto", maxHeight: "30vh", padding: "0 4px 4px" });
  p.append(head, P.search, P.list, P.sugHead, P.sug);
  // keep textarea focus when clicking panel (except the search box)
  p.addEventListener("mousedown", (e) => { if (e.target !== P.search) e.preventDefault(); });
  document.body.appendChild(p);
  document.addEventListener("mousedown", (e) => {
    try { if (P.el && P.el.style.display !== "none" && !P.el.contains(e.target) && e.target !== P.ta) closePanel(); } catch (err) {}
  }, true);
  P.el = p;
  return p;
}

function positionPanel() {
  try {
    if (!P.el || P.el.style.display === "none" || !P.ta) return;
    if (!document.body.contains(P.ta) || P.ta.offsetParent === null) return closePanel();
    const tr = P.ta.getBoundingClientRect();
    let left = tr.right + 12;
    try {
      const c = app.canvas, ds = c.ds, cr = c.canvas.getBoundingClientRect();
      left = (P.node.pos[0] + P.node.size[0] + ds.offset[0]) * ds.scale + cr.left + 12;
    } catch (e) {}
    const w = P.el.offsetWidth || 280;
    if (left + w > window.innerWidth - 4) left = Math.max(4, window.innerWidth - w - 4);
    let top = Math.max(4, Math.min(tr.top, window.innerHeight - 120));
    P.el.style.left = left + "px"; P.el.style.top = top + "px";
  } catch (e) {}
  P.raf = requestAnimationFrame(positionPanel);
}

async function openPanel(node, ta, section) {
  try {
    buildPanel();
    if (P.ta !== ta) { P.search.value = ""; P.items = []; }
    P.node = node; P.ta = ta; P.section = section;
    P.title.textContent = section;
    P.el.style.display = "flex";
    cancelAnimationFrame(P.raf); positionPanel();
    renderSuggestions();
    await loadSnippets();
  } catch (e) { console.warn("[PromptMachine] panel", e); }
}

function closePanel() {
  try { if (P.el) P.el.style.display = "none"; cancelAnimationFrame(P.raf); P.items = []; P.ta = null; } catch (e) {}
}

async function loadSnippets() {
  try {
    const r = await fetchApi("/promptmachine/snippets?section=" + encodeURIComponent(P.section));
    P.snippets = r.ok ? await r.json() : {};
  } catch (e) { P.snippets = {}; }
  renderSnippets();
}

function setTaValue(ta, v, caret) {
  ta.value = v;
  if (caret != null) ta.setSelectionRange(caret, caret);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderSnippets() {
  try {
    const f = (P.search.value || "").toLowerCase();
    P.list.innerHTML = "";
    const names = Object.keys(P.snippets || {}).sort((a, b) => a.localeCompare(b))
      .filter((n) => !f || n.toLowerCase().includes(f) || String(P.snippets[n]).toLowerCase().includes(f));
    if (!names.length) { P.list.append(el("div", { padding: "6px", opacity: ".5" }, "No saved snippets for this section")); return; }
    for (const n of names) {
      const txt = String(P.snippets[n] || "");
      const row = el("div", { display: "flex", gap: "6px", padding: "5px 6px", margin: "2px 0", borderRadius: "4px",
        cursor: "pointer", background: "#2b2b2b" });
      row.title = txt + "\n\nClick: append  |  Shift+Click: replace";
      const body = el("div", { flex: "1", minWidth: "0" });
      body.append(el("div", { fontWeight: "bold", color: "#9cf" }, n),
        el("div", { opacity: ".7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, txt));
      const x = el("span", { color: "#f77", padding: "0 4px", fontWeight: "bold" }, "\u00d7");
      x.title = "Delete";
      x.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          if (!confirm('Delete snippet "' + n + '"?')) return;
          await fetchApi("/promptmachine/snippets", { method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: P.section, name: n }) });
          await loadSnippets();
        } catch (err) {}
      });
      row.addEventListener("mouseenter", () => (row.style.background = "#3a3a3a"));
      row.addEventListener("mouseleave", () => (row.style.background = "#2b2b2b"));
      row.addEventListener("click", (e) => {
        try {
          const ta = P.ta; if (!ta) return;
          if (e.shiftKey || !ta.value.trim()) setTaValue(ta, txt, txt.length);
          else {
            const base = ta.value.replace(/[\s,]+$/, "");
            const v = base + ", " + txt; setTaValue(ta, v, v.length);
          }
          ta.focus();
        } catch (err) {}
      });
      row.append(body, x);
      P.list.append(row);
    }
  } catch (e) {}
}

async function saveCurrent() {
  try {
    const ta = P.ta; if (!ta) return;
    const name = prompt("Save " + P.section + " snippet as:"); if (!name) return;
    await fetchApi("/promptmachine/snippets", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: P.section, name, text: ta.value }) });
    await loadSnippets();
    ta.focus();
  } catch (e) { console.warn(e); }
}

function renderSuggestions() {
  try {
    P.sug.innerHTML = "";
    P.sugHead.style.display = P.items.length ? "block" : "none";
    P.items.forEach((it, i) => {
      const row = el("div", { padding: "3px 6px", cursor: "pointer", display: "flex", justifyContent: "space-between",
        gap: "10px", borderRadius: "3px", background: i === P.sel ? "#3a5a8a" : "transparent" });
      const cnt = it.wildcard ? "wildcard" : (it.count >= 1000 ? (it.count / 1000).toFixed(1) + "k" : String(it.count || ""));
      row.append(el("span", null, it.tag), el("span", { opacity: ".6" }, cnt));
      row.addEventListener("click", () => { P.sel = i; insertTag(); });
      P.sug.append(row);
      if (i === P.sel) try { row.scrollIntoView({ block: "nearest" }); } catch (e) {}
    });
  } catch (e) {}
}

function currentToken(ta) {
  const pos = ta.selectionStart, v = ta.value;
  let s = pos;
  while (s > 0 && !",\n".includes(v[s - 1])) s--;
  return { start: s, end: pos, text: v.slice(s, pos).replace(/^\s+/, "") };
}

function insertTag() {
  try {
    const ta = P.ta, it = P.items[P.sel]; if (!ta || !it) return;
    const t = currentToken(ta);
    const tag = it.wildcard ? it.tag : it.tag.replace(/_/g, " ").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const before = ta.value.slice(0, t.start), after = ta.value.slice(t.end);
    const lead = before && !/[\s\n]$/.test(before) ? " " : "";
    const ins = lead + tag + ", ";
    P.items = []; renderSuggestions();
    setTaValue(ta, before + ins + after, (before + ins).length);
    ta.focus();
  } catch (e) { console.warn("[PromptMachine]", e); }
}

function attachAutocomplete(ta, node, section) {
  if (!ta || ta.__pmAC) return;
  ta.__pmAC = true;
  try { if (!ta.placeholder) ta.placeholder = section; ta.title = section; } catch (e) {}
  ta.addEventListener("focus", () => openPanel(node, ta, section));
  ta.addEventListener("click", () => { if (P.ta !== ta || P.el.style.display === "none") openPanel(node, ta, section); });
  ta.addEventListener("input", (e) => {
    if (e && e.isTrusted === false) return;
    if (P.ta !== ta) openPanel(node, ta, section);
    clearTimeout(P.timer);
    P.timer = setTimeout(async () => {
      try {
        const q = currentToken(ta).text;
        if (q.length < 2) { P.items = []; return renderSuggestions(); }
        const r = await fetchApi("/promptmachine/autocomplete?q=" + encodeURIComponent(q));
        P.items = await r.json(); P.sel = 0; renderSuggestions();
      } catch (err) { P.items = []; renderSuggestions(); }
    }, 120);
  });
  ta.addEventListener("keydown", (e) => {
    try {
      if (P.ta !== ta) return;
      if (e.key === "Escape") { if (P.items.length) { P.items = []; renderSuggestions(); } else closePanel(); }
      else if (!P.items.length) return;
      else if (e.key === "ArrowDown") { P.sel = (P.sel + 1) % P.items.length; renderSuggestions(); }
      else if (e.key === "ArrowUp") { P.sel = (P.sel - 1 + P.items.length) % P.items.length; renderSuggestions(); }
      else if (e.key === "Enter" || e.key === "Tab") insertTag();
      else return;
      e.preventDefault(); e.stopPropagation();
    } catch (err) {}
  }, true);
}

function w(node, name) { return (node.widgets || []).find((x) => x.name === name); }
function setW(node, name, v) {
  const x = w(node, name); if (!x) return;
  x.value = v;
  try { if (x.inputEl) x.inputEl.value = v; } catch (e) {}
  try { x.callback && x.callback(v); } catch (e) {}
}
function collect(node) {
  const d = {};
  for (const n of SECTIONS.concat(OPTS)) { const x = w(node, n); if (x) d[n] = x.value; }
  return d;
}

function scanTextareas(node) {
  try {
    for (const x of node.widgets || []) {
      const e2 = x.inputEl || x.element;
      if (e2 && e2.tagName === "TEXTAREA" && x.name !== "preview") attachAutocomplete(e2, node, x.name);
    }
  } catch (e) {}
}

app.registerExtension({
  name: "PromptMachine.UI",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PromptMachine") return;
    const onCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onCreated ? onCreated.apply(this, arguments) : undefined;
      const node = this;
      try {
        let preview = null;
        try {
          const ComfyWidgets = window.comfyAPI?.widgets?.ComfyWidgets;
          if (ComfyWidgets) preview = ComfyWidgets.STRING(node, "preview", ["STRING", { multiline: true }], app).widget;
        } catch (e) {}
        if (preview) {
          preview.serialize = false;
          if (preview.options) preview.options.serialize = false;
          try { preview.inputEl.readOnly = true; preview.inputEl.style.opacity = 0.75; } catch (e) {}
        }
        const show = (t) => { if (preview) { preview.value = t; try { preview.inputEl.value = t; } catch (e) {} } else alert(t); };
        node.__pmShow = show;

        node.addWidget("button", "Preview", null, async () => {
          try {
            const res = await fetchApi("/promptmachine/preview", { method: "POST",
              headers: { "Content-Type": "application/json" }, body: JSON.stringify(collect(node)) });
            const j = await res.json();
            show("POSITIVE:\n" + j.positive + "\n\nNEGATIVE:\n" + j.negative);
          } catch (e) { show("Preview error: " + e); }
        }, { serialize: false });

        node.addWidget("button", "Save preset", null, async () => {
          try {
            const name = prompt("Preset name:"); if (!name) return;
            await fetchApi("/promptmachine/presets", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, data: collect(node) }) });
            await refresh();
          } catch (e) { console.warn(e); }
        }, { serialize: false });

        const combo = node.addWidget("combo", "preset", "(none)", () => {}, { values: ["(none)"], serialize: false });
        if (combo) combo.serialize = false;
        const refresh = async () => {
          try {
            const l = await (await fetchApi("/promptmachine/presets")).json();
            combo.options.values = ["(none)"].concat(l);
          } catch (e) {}
        };
        node.addWidget("button", "Load preset", null, async () => {
          try {
            await refresh();
            const name = combo.value; if (!name || name === "(none)") return;
            const d = await (await fetchApi("/promptmachine/presets/" + encodeURIComponent(name))).json();
            for (const k of Object.keys(d || {})) setW(node, k, d[k]);
            node.setDirtyCanvas && node.setDirtyCanvas(true, true);
          } catch (e) { console.warn(e); }
        }, { serialize: false });
        refresh();
        scanTextareas(node);
        setTimeout(() => scanTextareas(node), 500);
        setTimeout(() => scanTextareas(node), 2000);
      } catch (e) { console.warn("[PromptMachine] init", e); }
      return r;
    };
    const onExec = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (msg) {
      try { onExec && onExec.apply(this, arguments); } catch (e) {}
      try { if (msg && msg.text && this.__pmShow) this.__pmShow(String(msg.text[0])); } catch (e) {}
    };
  },
  nodeCreated(node) {
    try { if (node.comfyClass === "PromptMachine") setTimeout(() => scanTextareas(node), 100); } catch (e) {}
  },
});

// Fallback: attach to any textarea focused inside a PromptMachine DOM widget
try {
  document.addEventListener("focusin", (e) => {
    try {
      const t = e.target;
      if (!t || t.tagName !== "TEXTAREA" || t.__pmAC) return;
      const g = app.graph; if (!g) return;
      for (const n of g._nodes || g.nodes || []) {
        if (n.comfyClass !== "PromptMachine") continue;
        for (const x of n.widgets || []) if ((x.inputEl || x.element) === t && x.name !== "preview") { attachAutocomplete(t, n, x.name); openPanel(n, t, x.name); return; }
      }
    } catch (err) {}
  });
} catch (e) {}

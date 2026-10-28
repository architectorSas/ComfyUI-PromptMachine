"""Prompt processing core (no ComfyUI dependencies)."""
import os, re, json, random, csv

BASE = os.path.dirname(os.path.abspath(__file__))
WILDCARD_DIRS = [os.path.join(BASE, "wildcards"),
                 os.path.abspath(os.path.join(BASE, "..", "..", "wildcards"))]
PRESETS_DIR = os.path.join(BASE, "presets")
STYLES_FILE = os.path.join(PRESETS_DIR, "styles.json")
USER_PRESETS_FILE = os.path.join(PRESETS_DIR, "user_presets.json")
TAGS_FILE = os.path.join(BASE, "data", "danbooru.csv")
SECTIONS = ["quality", "character", "outfit", "pose", "environment", "lighting", "extra"]
MAX_DEPTH = 10

def strip_comments(text):
    return "\n".join(l for l in (text or "").splitlines() if not l.strip().startswith("#"))

def list_wildcards():
    names = set()
    for d in WILDCARD_DIRS:
        if not os.path.isdir(d):
            continue
        for root, _, files in os.walk(d):
            for f in files:
                if f.lower().endswith(".txt"):
                    rel = os.path.relpath(os.path.join(root, f), d)[:-4]
                    names.add(rel.replace("\\", "/"))
    return sorted(names)

def _wildcard_lines(name):
    name = name.strip().replace("\\", "/")
    for d in WILDCARD_DIRS:
        p = os.path.join(d, *name.split("/")) + ".txt"
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8-sig", errors="replace") as fh:
                return [l.strip() for l in fh if l.strip() and not l.strip().startswith("#")]
    return None

WC_RE = re.compile(r"__([\w\-./\\ ]+?)__")

def _split_top(s, sep="|"):
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch == "{": depth += 1
        elif ch == "}": depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += ch
    parts.append(cur)
    return parts

def _choose(body, rng):
    opts, weights = [], []
    for o in _split_top(body):
        m = re.match(r"^\s*(\d+(?:\.\d+)?)::(.*)$", o, re.S)
        if m:
            weights.append(float(m.group(1))); opts.append(m.group(2))
        else:
            weights.append(1.0); opts.append(o)
    if sum(weights) <= 0:
        weights = [1.0] * len(opts)
    return rng.choices(opts, weights=weights, k=1)[0].strip()

def _expand_braces(text, rng):
    # innermost-first is wrong for weights; process outermost pairs left to right
    out, i = "", 0
    while i < len(text):
        if text[i] == "{":
            depth, j = 0, i
            while j < len(text):
                if text[j] == "{": depth += 1
                elif text[j] == "}":
                    depth -= 1
                    if depth == 0: break
                j += 1
            if j >= len(text):  # unbalanced
                out += text[i:]; break
            out += _choose(text[i + 1:j], rng)
            i = j + 1
        else:
            out += text[i]; i += 1
    return out

def resolve(text, rng, depth=0):
    text = strip_comments(text)
    for _ in range(MAX_DEPTH):
        changed = False
        def wc(m):
            nonlocal changed
            lines = _wildcard_lines(m.group(1))
            if lines is None:
                return m.group(0)
            changed = True
            return rng.choice(lines) if lines else ""
        new = WC_RE.sub(wc, text)
        if "{" in new and "}" in new:
            new2 = _expand_braces(new, rng)
            if new2 != new: changed = True
            new = new2
        text = new
        if not changed:
            break
    return text

def _tag_key(tag):
    t = tag.strip().lower()
    m = re.match(r"^[\(\[]+(.*?)(?::[\d.]+)?[\)\]]+$", t)
    if m: t = m.group(1)
    return re.sub(r"[\s_]+", " ", t).strip()

def split_tags(text):
    parts, depth, cur = [], 0, ""
    for ch in text.replace("\n", ","):
        if ch in "([": depth += 1
        elif ch in ")]": depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += ch
    parts.append(cur)
    return parts

def clean(text, delimiter=", ", dedupe=True, clean_ws=True):
    tags = split_tags(text)
    if clean_ws:
        tags = [re.sub(r"\s+", " ", t).strip() for t in tags]
    tags = [t for t in tags if t.strip()]
    if dedupe:
        seen, out = set(), []
        for t in tags:
            k = _tag_key(t)
            if k in seen: continue
            seen.add(k); out.append(t)
        tags = out
    return delimiter.join(t.strip() if clean_ws else t for t in tags)

def load_styles():
    try:
        with open(STYLES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def style_names():
    return ["none"] + [k for k in load_styles().keys() if k != "none"]

def apply_style(name, pos, neg):
    st = load_styles().get(name)
    if not st:
        return pos, neg
    p = st.get("positive", "{prompt}")
    p = p.replace("{prompt}", pos) if "{prompt}" in p else (p + ", " + pos)
    n = st.get("negative", "")
    n = n.replace("{prompt}", neg) if "{prompt}" in n else ", ".join(x for x in (neg, n) if x)
    return p, n

def build(sections, negative="", prefix="", suffix="", delimiter=", ", seed=0,
          dedupe=True, clean_whitespace=True, style="none"):
    rng = random.Random(int(seed))
    parts = [prefix or ""] + [sections.get(k, "") or "" for k in SECTIONS] + [suffix or ""]
    resolved = [resolve(p, rng) for p in parts]
    pos = delimiter.join(x for x in (clean(r, delimiter, False, clean_whitespace) for r in resolved) if x)
    neg = resolve(negative or "", rng)
    if style and style != "none":
        pos, neg = apply_style(style, pos, neg)
    return clean(pos, delimiter, dedupe, clean_whitespace), clean(neg, delimiter, dedupe, clean_whitespace)

# ---------- user presets ----------
def load_user_presets():
    try:
        with open(USER_PRESETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_user_preset(name, data):
    p = load_user_presets(); p[name] = data
    with open(USER_PRESETS_FILE, "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False, indent=2)

# ---------- autocomplete ----------
_TAGS = None
def load_tags():
    global _TAGS
    if _TAGS is None:
        _TAGS = []
        try:
            with open(TAGS_FILE, "r", encoding="utf-8", errors="replace") as f:
                for row in csv.reader(f):
                    if not row: continue
                    try: cnt = int(row[2]) if len(row) > 2 and row[2] else 0
                    except ValueError: cnt = 0
                    _TAGS.append((row[0], cnt, row[3] if len(row) > 3 else ""))
            _TAGS.sort(key=lambda t: -t[1])
        except Exception as e:
            print("[PromptMachine] tag list not loaded:", e)
    return _TAGS

def autocomplete(q, limit=15):
    q = (q or "").strip().lower()
    if not q: return []
    if q.startswith("__"):
        k = q.strip("_")
        return [{"tag": "__%s__" % w, "count": 0, "wildcard": True}
                for w in list_wildcards() if k in w.lower()][:limit]
    qq = q.replace(" ", "_")
    pre, con = [], []
    for tag, cnt, al in load_tags():
        tl = tag.lower()
        if tl.startswith(qq): pre.append((tag, cnt))
        elif qq in tl or (al and qq in al.lower()): con.append((tag, cnt))
        if len(pre) >= limit: break
    res = (pre + con)[:limit]
    return [{"tag": t, "count": c} for t, c in res]

# ---------- per-section snippets ----------
SNIPPETS_FILE = os.path.join(PRESETS_DIR, "snippets.json")
SNIPPET_SECTIONS = SECTIONS + ["negative", "style"]

def _norm_section(s):
    s = (s or "").strip().lower()
    if s not in SNIPPET_SECTIONS:
        raise ValueError("unknown section: %s" % s)
    return s

def load_snippets():
    try:
        with open(SNIPPETS_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
            return d if isinstance(d, dict) else {}
    except Exception:
        return {}

def _write_snippets(d):
    tmp = SNIPPETS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    os.replace(tmp, SNIPPETS_FILE)

def get_snippets(section=None):
    d = load_snippets()
    if not section:
        return d
    return d.get(_norm_section(section), {})

def save_snippet(section, name, text):
    section = _norm_section(section); name = (name or "").strip()
    if not name:
        raise ValueError("name required")
    d = load_snippets(); d.setdefault(section, {})[name] = text or ""
    _write_snippets(d)

def delete_snippet(section, name):
    section = _norm_section(section)
    d = load_snippets()
    ok = d.get(section, {}).pop(name, None) is not None
    if ok:
        _write_snippets(d)
    return ok

from aiohttp import web
from server import PromptServer
from . import pm_core as core

R = PromptServer.instance.routes

@R.get("/promptmachine/autocomplete")
async def _ac(req):
    return web.json_response(core.autocomplete(req.query.get("q", ""), int(req.query.get("limit", 15))))

@R.get("/promptmachine/wildcards")
async def _wc(req):
    return web.json_response(core.list_wildcards())

@R.get("/promptmachine/styles")
async def _st(req):
    return web.json_response(core.style_names())

@R.get("/promptmachine/presets")
async def _pl(req):
    return web.json_response(sorted(core.load_user_presets().keys()))

@R.get("/promptmachine/presets/{name}")
async def _pg(req):
    p = core.load_user_presets().get(req.match_info["name"])
    return web.json_response(p) if p is not None else web.json_response({"error": "not found"}, status=404)

@R.post("/promptmachine/presets")
async def _ps(req):
    d = await req.json()
    name = (d.get("name") or "").strip()
    if not name:
        return web.json_response({"error": "name required"}, status=400)
    core.save_user_preset(name, d.get("data", {}))
    return web.json_response({"ok": True})

@R.post("/promptmachine/preview")
async def _pv(req):
    d = await req.json()
    pos, neg = core.build({s: d.get(s, "") for s in core.SECTIONS}, d.get("negative", ""), "", "",
                          d.get("delimiter", ", "), int(d.get("seed", 0) or 0),
                          bool(d.get("dedupe_tags", True)), bool(d.get("clean_whitespace", True)),
                          d.get("style_preset", "none"))
    return web.json_response({"positive": pos, "negative": neg})

@R.get("/promptmachine/snippets")
async def _sn_get(req):
    try:
        return web.json_response(core.get_snippets(req.query.get("section")))
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)

@R.post("/promptmachine/snippets")
async def _sn_post(req):
    try:
        d = await req.json()
        core.save_snippet(d.get("section"), d.get("name"), d.get("text", ""))
        return web.json_response({"ok": True})
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)

@R.delete("/promptmachine/snippets")
async def _sn_del(req):
    try:
        d = await req.json()
        return web.json_response({"ok": core.delete_snippet(d.get("section"), d.get("name"))})
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)

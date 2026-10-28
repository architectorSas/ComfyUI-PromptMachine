from . import pm_core as core

class PromptMachine:
    @classmethod
    def INPUT_TYPES(cls):
        ml = lambda: ("STRING", {"multiline": True, "default": ""})
        req = {s: ml() for s in core.SECTIONS}
        req["quality"] = ("STRING", {"multiline": True, "default": "masterpiece, best quality, amazing quality, absurdres"})
        req["negative"] = ("STRING", {"multiline": True, "default": "lazyneg, lazyhand"})
        req["delimiter"] = ("STRING", {"default": ", "})
        req["seed"] = ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "control_after_generate": True})
        req["dedupe_tags"] = ("BOOLEAN", {"default": True})
        req["clean_whitespace"] = ("BOOLEAN", {"default": True})
        req["style_preset"] = (core.style_names(), {"default": "none"})
        return {"required": req,
                "optional": {"clip": ("CLIP",),
                             "prefix": ("STRING", {"forceInput": True}),
                             "suffix": ("STRING", {"forceInput": True})}}

    RETURN_TYPES = ("STRING", "STRING", "CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("positive", "negative", "positive_cond", "negative_cond")
    FUNCTION = "run"
    CATEGORY = "PromptMachine"

    @classmethod
    def IS_CHANGED(cls, seed=0, **kw):
        import hashlib, json
        h = hashlib.sha256(json.dumps({k: str(v) for k, v in kw.items() if k != "clip"}, sort_keys=True).encode()).hexdigest()
        return "%s-%s-%d" % (seed, h, len(core.list_wildcards()))

    @staticmethod
    def _encode(clip, text):
        tokens = clip.tokenize(text)
        if hasattr(clip, "encode_from_tokens_scheduled"):
            return clip.encode_from_tokens_scheduled(tokens)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        return [[cond, {"pooled_output": pooled}]]

    def run(self, negative, delimiter, seed, dedupe_tags, clean_whitespace, style_preset,
            clip=None, prefix="", suffix="", **sections):
        pos, neg = core.build(sections, negative, prefix, suffix, delimiter, seed,
                              dedupe_tags, clean_whitespace, style_preset)
        pc = nc = None
        if clip is not None:
            pc, nc = self._encode(clip, pos), self._encode(clip, neg)
        return {"ui": {"text": [pos]}, "result": (pos, neg, pc, nc)}

NODE_CLASS_MAPPINGS = {"PromptMachine": PromptMachine}
NODE_DISPLAY_NAME_MAPPINGS = {"PromptMachine": "Prompt Machine"}

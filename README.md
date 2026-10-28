# ComfyUI-PromptMachine

All-in-one prompt builder node for ComfyUI (SDXL / Illustrious / Pony, Danbooru-style tags).

## Features
- Section fields: quality, character, outfit, pose, environment, lighting, extra, negative
- Wildcards: `__character/2b__` -> random line from `wildcards/character/2b.txt` (nested, seeded)
- Dynamic prompts: `{gothic bedroom|dark castle}`, nested, weighted `{3::a|b}`
- Tag autocomplete (~140k Danbooru tags with post counts) in a side panel
- Per-section snippet library: save / insert / delete pieces (pose, outfit, ...) from the side panel
- Full presets (all fields) + 10 built-in style presets
- Preview button, tag dedupe (`1girl` == `(1Girl:1.2)`), whitespace/comma cleanup
- Optional `clip` input -> positive / negative CONDITIONING outputs directly

## Install
```
cd ComfyUI/custom_nodes
git clone https://github.com/architectorSas/ComfyUI-PromptMachine
```
Restart ComfyUI and add the node **Prompt Machine** (category `PromptMachine`).

Russian guide: [README_RU.md](README_RU.md)

## Credits
Tag list `data/danbooru.csv` from [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) by DominikDoom.

## License
MIT
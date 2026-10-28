from .prompt_machine import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
WEB_DIRECTORY = "./web"
try:
    from . import routes  # noqa: F401
except Exception as e:
    print("[PromptMachine] routes not loaded:", e)
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

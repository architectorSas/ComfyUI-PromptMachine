# ComfyUI-PromptMachine

Всё-в-одном нода **Prompt Machine** (категория `PromptMachine`) — заменяет связку из нескольких `Text Multiline` + `Text Concatenate` + `CLIP Text Encode`.

## Входы и виджеты
- Секции (многострочные): `quality`, `character`, `outfit`, `pose`, `environment`, `lighting`, `extra` и `negative`.
- `prefix` / `suffix` (необязательные STRING-входы) — для цепочки нескольких нод.
- `delimiter` — разделитель секций (по умолчанию `, `).
- `seed` — сид для случайного выбора (wildcards, `{a|b}`). Тот же сид = тот же результат.
- `dedupe_tags` — убирать повторяющиеся теги (без учёта регистра, `(tag:1.2)` и `tag` считаются одним тегом, остаётся первый).
- `clean_whitespace` — чистка лишних пробелов и запятых.
- `style_preset` — готовый стиль из `presets/styles.json`.
- `clip` (необязательно) — если подключить CLIP, нода сразу выдаёт `positive_cond` / `negative_cond` (CONDITIONING) — CLIP Text Encode не нужен.

Выходы: `positive`, `negative` (STRING), `positive_cond`, `negative_cond`.

## Синтаксис
- `__character/2b__` — wildcard: случайная строка из `wildcards/character/2b.txt` (вложенные wildcards до 10 уровней).
- `{gothic bedroom|dark castle|library}` — случайный вариант; вложенность: `{a|{b|c}}`.
- Веса: `{2::часто|редко}` — первый вариант выбирается в 2 раза чаще.
- Строки, начинающиеся с `#`, — комментарии и удаляются.
- Веса тегов `(tag:1.2)` сохраняются как есть.

## Кнопки
- **Preview** — показывает итоговый промпт с текущим сидом (поле `preview`, только чтение).
- **Save preset** — сохранить все секции под именем (в `presets/user_presets.json`).
- **preset** + **Load preset** — выбрать и загрузить сохранённый пресет.

## Автодополнение
Начните печатать тег (от 2 символов) в любом поле ноды — появится список тегов Danbooru с количеством постов.
Стрелки — выбор, Enter/Tab — вставка (подчёркивания заменяются пробелами, скобки экранируются, добавляется `, `), Esc — закрыть.
Если начать с `__`, подсказываются имена wildcards.

## Как добавить wildcards
1. Создайте файл `.txt` в `custom_nodes/ComfyUI-PromptMachine/wildcards/` (можно в подпапках), например `wildcards/outfit/gothic.txt`.
2. Каждая строка — один вариант. Строки с `#` игнорируются.
3. В промпте пишите `__outfit/gothic__`. Перезапуск не нужен.
Также читается папка `ComfyUI/wildcards`, если она существует.

## Свои стили
Отредактируйте `presets/styles.json`: `{"Имя": {"positive": "..., {prompt}", "negative": "{prompt}, ..."}}`. Нужен перезапуск ComfyUI, чтобы список обновился.

## API
`/promptmachine/autocomplete?q=`, `/promptmachine/wildcards`, `/promptmachine/styles`, `/promptmachine/presets` (GET список, POST сохранить), `/promptmachine/presets/{name}`, `/promptmachine/preview` (POST).

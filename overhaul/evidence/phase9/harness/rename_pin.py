#!/usr/bin/env python3
"""Rename the Phase 8 PIN wording and names back to "password".

Usage: rename_pin.py <dry|apply> <path> [<path> ...]

Identifiers first (PinPicker, hasPin, pinDraft, PIN_MIN_LENGTH, fg-pin-reveal ...), then the
word PIN / PINs, capitalised when it starts a string, a sentence or a line of text.
Files are rewritten in place; a summary is printed per file.
"""
import pathlib
import re
import sys

IDENT_RULES = [
    (re.compile(r"\bPIN_NUDGE_HINT_ID\b"), "PASSWORD_NUDGE_HINT_ID"),
    (re.compile(r"\bPIN_MIN_LENGTH\b"), "PASSWORD_MIN_LENGTH"),
    (re.compile(r"\bPIN_MAX_LENGTH\b"), "PASSWORD_MAX_LENGTH"),
    (re.compile(r"\bPin(?=[A-Z])"), "Password"),
    (re.compile(r"(?<=[a-z0-9])Pin(?=[A-Z]|\b)"), "Password"),
    (re.compile(r"\bpin(?=[A-Z])"), "password"),
    (re.compile(r"\bpin\b"), "password"),
]

WORD = re.compile(r"\bPIN(s?)\b")


def starts_text(text: str, start: int) -> bool:
    """True when the word at `start` begins a string, a sentence, a comment or a line of text."""
    line_start = text.rfind("\n", 0, start) + 1
    before = text[line_start:start]
    stripped = before.rstrip()
    if stripped == "":
        # First thing on its line: does the previous non-blank line end a sentence or a tag?
        lines = text[:line_start].split("\n")
        while lines and lines[-1].strip() == "":
            lines.pop()
        prev_line = lines[-1].rstrip() if lines else ""
        if prev_line == "":
            return True
        if prev_line[-1] in ".!?>":
            return True
        if prev_line.strip() in ("/**", "/*", "*", "//"):
            return True
        return False
    last = stripped[-1]
    if last in "\"'`":
        return True
    if last == ">" and not stripped.endswith("=>"):
        return True
    if last in ".!?":
        return True
    if re.fullmatch(r"\s*(//|/\*\*?|\*)", stripped):
        return True
    return False


def word_pass(text: str) -> str:
    out = []
    last = 0
    for match in WORD.finditer(text):
        out.append(text[last:match.start()])
        plural = match.group(1)
        cap = starts_text(text, match.start())
        word = ("Password" if cap else "password") + ("s" if plural else "")
        out.append(word)
        last = match.end()
    out.append(text[last:])
    return "".join(out)


def convert(text: str) -> str:
    for pattern, replacement in IDENT_RULES:
        text = pattern.sub(replacement, text)
    return word_pass(text)


def main() -> None:
    mode = sys.argv[1]
    paths = [pathlib.Path(p) for p in sys.argv[2:]]
    files = []
    for path in paths:
        if path.is_dir():
            files.extend(
                sorted(
                    p
                    for p in path.rglob("*")
                    if p.is_file() and p.suffix in {".ts", ".tsx", ".css", ".cjs", ".mjs", ".js"}
                )
            )
        else:
            files.append(path)
    total = 0
    for file in files:
        original = file.read_text(encoding="utf-8")
        changed = convert(original)
        if changed != original:
            count = sum(1 for a, b in zip(original.splitlines(), changed.splitlines()) if a != b)
            total += count
            print(f"{count:4d} lines  {file}")
            if mode == "apply":
                file.write_text(changed, encoding="utf-8")
    print(f"{total} lines changed in {mode} mode")


if __name__ == "__main__":
    main()

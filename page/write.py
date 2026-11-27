"""Write page/data.js — what the setup page holds — from a published release of the engine.

    python3.12 page/write.py --release <checkout of grafyla/releases at a tag>

memory-engine, docs/DESIGN_PHASE3.md §5a: the page is written from a published release, as the template
is — the one text, the rows of the platform table, the lines the user's part is built from, the grammar
lines, the messages — each taken from that release's own files, by importing the release's
`engine.setup.setup`. The page's script builds the user's part as `setup.build` does: a second
implementation, held to the first byte for byte by page/test/parity.py.

What the release does not hold, this writes too, from the Python that runs it:
- the Unicode tables `setup.name_ok` and C5's `text_check.mixed_words` read — letters, marks, word
  characters, the names that start with LATIN or CYRILLIC — so the page tells a name apart exactly as
  that Python does. Run it with the Python the full way's `setup` runs on: GitHub's ubuntu-24.04 runner,
  Python 3.12 (Unicode 15.0.0); the version is written into the data and the tests compare it;
- the time zones `setup` accepts (`zoneinfo`, names with a slash, as long as `setup` allows), without
  `Etc/`: «Etc/GMT-3» means three hours ahead, a trap on a phone;
- the languages the page offers (LANGUAGES below): a list, so that no answer the page takes can put a
  number into the user's part — page/test/parity.py runs every one through `setup.build`;
- the countries: the counter's list (counter/src/countries.js), one list for both.
Standard library only.
"""
from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
import unicodedata
import zoneinfo
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "data.js"
COUNTRIES_JS = ROOT / "counter" / "src" / "countries.js"

# The languages the page offers: BCP 47 codes `setup` takes (LANGUAGE_RE, at most LANGUAGE_MAX), with no
# digit, each with a primary part the counter keeps (counter/src/languages.js). The page names each in the
# reader's language by the browser's own list (Intl.DisplayNames).
LANGUAGES = (
    "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et",
    "eu", "fa", "fi", "fil", "fr", "ga", "gl", "gu", "ha", "he", "hi", "hr", "hu", "hy", "id", "ig", "is",
    "it", "ja", "ka", "kk", "km", "kn", "ko", "ky", "lo", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt",
    "my", "nb", "ne", "nl", "pa", "pl", "ps", "pt", "pt-BR", "ro", "ru", "si", "sk", "sl", "so", "sq", "sr",
    "sv", "sw", "ta", "te", "tg", "th", "tk", "tr", "uk", "ur", "uz", "vi", "xh", "yi", "yo", "zh-Hans",
    "zh-Hant", "zu",
)
ZONES_LEFT_OUT = ("Etc/",)
WORD_RE = re.compile(r"[^\W\d_]")          # C5's word character, as engine/checks/text_check.py has it


def ranges(test) -> list[list[int]]:
    """[[first, last], …] of the code points for which test(chr(cp)) holds, surrogates aside."""
    out: list[list[int]] = []
    for cp in range(0x110000):
        if 0xD800 <= cp <= 0xDFFF or not test(chr(cp)):
            continue
        if out and out[-1][1] == cp - 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return out


def unicode_tables() -> dict:
    name = lambda ch: unicodedata.name(ch, "")
    return {
        "version": unicodedata.unidata_version,
        "letters": ranges(lambda ch: unicodedata.category(ch).startswith("L")),
        "marks": ranges(lambda ch: unicodedata.category(ch) in ("Mn", "Mc")),
        "word": ranges(lambda ch: WORD_RE.match(ch) is not None),
        "latin": ranges(lambda ch: name(ch).startswith("LATIN")),
        "cyrillic": ranges(lambda ch: name(ch).startswith("CYRILLIC")),
    }


def zones(setup) -> list[str]:
    out = []
    for zone in sorted(zoneinfo.available_timezones()):
        if "/" not in zone or len(zone) > setup.TIMEZONE_MAX or zone.startswith(ZONES_LEFT_OUT):
            continue
        zoneinfo.ZoneInfo(zone)                 # as setup._check: a zone it cannot load is no answer
        out.append(zone)
    return out


def countries() -> list[str]:
    codes = re.findall(r'"([A-Z]{2})"', COUNTRIES_JS.read_text(encoding="utf-8"))
    if len(codes) != len(set(codes)) or not codes:
        raise SystemExit(f"{COUNTRIES_JS}: no list of distinct codes")
    return codes


def data(release: Path) -> dict:
    manifest = json.loads((release / "release-manifest.json").read_text(encoding="utf-8"))
    files = (release / "files").resolve()
    sys.path.insert(0, str(files))
    setup = importlib.import_module("engine.setup.setup")
    if Path(setup.__file__).resolve().parents[2] != files:
        raise SystemExit(f"engine.setup.setup came from {setup.__file__}, not from the release at {files}")
    table, floor = setup.platforms(), setup._floor()
    platforms = {}
    for key, row in table.items():
        if row.get("status") not in setup.INSTALLABLE:
            continue
        platforms[key] = {
            "title": row["title"], "plan": row["plan"], "status": row["status"], "notion": row["notion"],
            "schedule": row["schedule"], "field": row["field"], "field_all": row.get("field_all", ""),
            "unknown": row.get("unknown", ""), "limit": setup.field_limit(row, floor), "works": setup._works(row),
            # the one text's addendum, set before its mark on this platform (setup.field_text, from text mark 8)
            "addendum": row.get("addendum") is True,
        }
    for key, row in platforms.items():
        field = setup.field_text(row=table[key])
        if len(field.encode("utf-16-le")) // 2 > row["limit"]:
            raise SystemExit(f"the text does not fit {key}'s field: setup.prepare would refuse it")
    for code in LANGUAGES:
        if len(code) > setup.LANGUAGE_MAX or not re.fullmatch(r"[a-z]{2,3}(-[A-Za-z]{2,8})*", code):
            raise SystemExit(f"LANGUAGES: {code!r} is not a code without digits that setup takes")
    return {
        "release": manifest["release"],
        "source": manifest["source"],
        "manifests": setup._toml(setup.DEFAULTS)["release"]["manifests"],
        "python": sys.version.split()[0],
        "fixed": setup.FIXED.read_bytes().decode("utf-8"),
        "addendum": setup.ADDENDUM.read_bytes().decode("utf-8"),
        "platforms": platforms,
        "grammar": dict(setup.GRAMMAR),
        "messages": {"first": setup.FIRST_MESSAGE, "settings": setup.SETTINGS_MESSAGE, "part": setup.PART_MESSAGE},
        "map_key": setup.MAP_KEY,
        "limits": {
            "name": setup.NAME_MAX, "words": setup.WORDS_MAX, "marks": setup.MARKS_MAX,
            "stop_after": setup.STOP_AFTER_MAX, "language": setup.LANGUAGE_MAX,
            "work_languages": setup.WORK_LANGUAGES_MAX, "timezone": setup.TIMEZONE_MAX,
        },
        "invisible": {"marks": [list(pair) for pair in setup.INVISIBLE_MARKS],
                      "letters": sorted(ord(ch) for ch in setup.INVISIBLE_LETTERS)},
        "genders": list(setup.GENDERS),
        "languages": list(LANGUAGES),
        "countries": countries(),
        "timezones": zones(setup),
        "unicode": unicode_tables(),
    }


def render(found: dict) -> str:
    head = ("// Written by page/write.py from the release named below — do not edit by hand: run it again.\n"
            "// memory-engine, docs/DESIGN_PHASE3.md §5a.\n")
    return head + "export const DATA = " + json.dumps(found, ensure_ascii=False, separators=(",", ":")) + ";\n"


def read(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    start = text.index("export const DATA = ") + len("export const DATA = ")
    return json.loads(text[start:].rstrip().rstrip(";"))


def check(found: dict, path: Path) -> int:
    """The data on disk against what this release writes here. Two keys depend on the machine, not the
    release: `python` — its exact version is only a note — and `timezones` — the machine's tzdata: there
    each zone on disk must be one `setup` accepts here, and a zone this machine has more is a note."""
    held = read(path)
    wrong = [key for key in sorted(set(found) | set(held))
             if key not in ("python", "timezones") and found.get(key) != held.get(key)]
    setup = importlib.import_module("engine.setup.setup")     # the release's, imported by data()
    refused = [z for z in held.get("timezones", []) if z not in found["timezones"]
               and not (("/" in z) and len(z) <= setup.TIMEZONE_MAX and _loads(z))]
    for key in wrong:
        print(f"DATA {key}: not what this release writes — run page/write.py again")
    for zone in refused:
        print(f"DATA timezones: {zone} is no time zone setup accepts on this machine")
    more = sorted(set(found["timezones"]) - set(held.get("timezones", [])))
    if more:
        print(f"DATA NOTE this machine's tzdata has {len(more)} zone(s) the page does not offer: {', '.join(more[:5])}")
    if held.get("python") != found["python"]:
        print(f"DATA NOTE written by Python {held.get('python')}, checked by {found['python']}")
    if not wrong and not refused:
        print(f"DATA same as release {found['release']} writes it")
    return 1 if wrong or refused else 0


def _loads(zone: str) -> bool:
    try:
        zoneinfo.ZoneInfo(zone)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--release", type=Path, required=True,
                    help="a checkout of grafyla/releases at a release tag")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--check", action="store_true", help="compare with --out instead of writing it")
    args = ap.parse_args(argv)
    found = data(args.release)
    if args.check:
        return check(found, args.out)
    args.out.write_text(render(found), encoding="utf-8")
    print(f"DATA written: {args.out} from {args.release}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

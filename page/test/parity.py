"""The engine's side of the page's parity test (page/test/parity.test.js): what `setup` builds from the same
answers, from the release the page's data was written from.

    python3.12 page/test/parity.py --release <checkout of memory-engine-releases at that tag> --answers in.json

Prints JSON: for each set of answers, whether `setup.build` takes it and, if so, the user's part and the
messages `setup.first_message` makes of it; for each name, whether `setup` takes it as a name. With
`--sweep`, instead: every answer the page can give from its lists, through `setup.build`, so that no list
value is one setup refuses and none puts a number C4 knows into the user's part — the page does not
port C4's patterns (DESIGN_PHASE3 §5a names them), and this is why it need not: a name holds no digit,
and what else goes into the part comes from these lists. Standard library only.
"""
from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_JS = HERE.parent / "data.js"


def engine(release: Path):
    sys.path.insert(0, str((release / "files").resolve()))
    setup = importlib.import_module("engine.setup.setup")
    checks = importlib.import_module("engine.checks.text_check")
    limits = importlib.import_module("engine.checks.limits_check")
    global field_issue
    field_issue = importlib.import_module("engine.checks.field_issue")
    return setup, checks, limits


def data() -> dict:
    text = DATA_JS.read_text(encoding="utf-8")
    start = text.index("export const DATA = ") + len("export const DATA = ")
    return json.loads(text[start:].rstrip().rstrip(";"))


def built(setup, answers: dict) -> dict:
    try:
        files = setup.build(platform=answers["platform"], language=answers["language"], country=answers["country"],
                            timezone=answers["timezone"], name=answers["name"], gender=answers["gender"],
                            work_languages=tuple(answers["work_languages"]))
    except setup.SetupError as exc:
        return {"ok": False, "why": str(exc)}
    part = files[setup.PART]
    table = setup.platforms()
    field = setup.field_text()
    manifests = setup._toml(setup.DEFAULTS)["release"]["manifests"]
    return {"ok": True, "part": part, "first": setup.first_message(part),
            "settings": setup.first_message(part, setup.SETTINGS_MESSAGE),
            # as setup_run.open_issue ends the Issue: the text's and her part's fingerprints
            "marker": field_issue.marker(field, part.strip(chr(10))),
            # the Issue of the full way for these answers: the page's English words are held to it
            "issue": setup.issue(table[answers["platform"]], field, part, manifests)}


def sweep(setup, found: dict) -> list[str]:
    """Every list value the page offers, through setup.build: none refused."""
    countries = [*setup_countries(), "NL"]            # each country with a table of its own, and one without
    base = dict(platform=next(iter(found["platforms"])), language="en", country="IL", timezone="Europe/Berlin",
                name="Anna", gender="female", work_languages=())
    problems = []
    trials = 0
    for country in countries:
        for zone in found["timezones"]:
            trials += 1
            if not built(setup, {**base, "country": country, "timezone": zone})["ok"]:
                problems.append(f"{country} {zone}")
        for lang in found["languages"]:
            trials += 1
            work = () if lang == "en" else ("en",)
            if not built(setup, {**base, "country": country, "language": lang, "work_languages": work})["ok"]:
                problems.append(f"{country} {lang}")
            if lang != "en":
                trials += 1
                if not built(setup, {**base, "country": country, "work_languages": (lang,)})["ok"]:
                    problems.append(f"{country} work {lang}")
    for country in found["countries"]:
        trials += 1
        if not built(setup, {**base, "country": country})["ok"]:
            problems.append(f"country {country}")
    for platform in found["platforms"]:
        for gender in found["genders"]:
            trials += 1
            if not built(setup, {**base, "platform": platform, "gender": gender})["ok"]:
                problems.append(f"{platform} {gender}")
    print(f"SWEEP {trials} answers through setup.build, refused {len(problems)}", file=sys.stderr)
    return problems


def setup_countries() -> list[str]:
    checks = importlib.import_module("engine.checks.numbers_check")
    return sorted(checks.BY_COUNTRY)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--release", type=Path, required=True)
    ap.add_argument("--answers", type=Path, help="JSON: {\"answers\": [...], \"names\": [...]}")
    ap.add_argument("--sweep", action="store_true")
    args = ap.parse_args(argv)
    setup, text_check, limits_check = engine(args.release)
    found = data()
    if args.sweep:
        print(json.dumps({"refused": sweep(setup, found)}, ensure_ascii=False))
        return 0
    asked = json.loads(args.answers.read_text(encoding="utf-8"))
    out = {
        "release": found["release"],
        "field": setup.field_text(),
        "messages": {"first": setup.FIRST_MESSAGE, "settings": setup.SETTINGS_MESSAGE},
        "answers": [built(setup, a) for a in asked["answers"]],
        "names": [{"name_ok": setup.name_ok(n), "length": limits_check.length(n),
                   "mixed": text_check.mixed_words(n)} for n in asked["names"]],
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
package_skill.py — Package a skill folder into an installable .zip.

Single source of truth for skill packaging across the ecosystem.
write-a-skill OWNS this script; ameliore-un-skill DELEGATES to it (no recoding).

Three guarantees, in order:
  1. EXHAUSTIVE — walks the real folder tree and zips every file (scripts/,
     references/, anything). Never a hand-maintained file list, so nothing
     is ever left out.
  2. VALID — gates on the canonical validators (description, structure,
     review 6/6) AND on the claude.ai/API upload constraints (name <= 64,
     lowercase/digits/hyphens, no reserved words, description <= 1024).
     Refuses to package a non-conformant skill unless --force.
  3. INSTALLABLE — emits a .zip with the skill folder at the archive root
     (skill-name/SKILL.md, ...), the shape Settings > Skills expects.

Deterministic. No LLM calls. Stdlib only.

Usage:
    python package_skill.py                          # embedded sample: dry-run on write-a-skill itself
    python package_skill.py path/to/skill/           # gate + write <name>.zip in cwd
    python package_skill.py path/to/skill/ --out dist/my.zip
    python package_skill.py path/to/skill/ --dry-run # gate + manifest, no file written
    python package_skill.py path/to/skill/ --force   # package even if the gate fails
    python package_skill.py path/to/skill/ --output json
"""

import argparse
import json
import os
import re
import subprocess
import sys
import zipfile

RESERVED_NAMES = {"anthropic", "claude"}
NAME_RE = re.compile(r"^[a-z0-9-]{1,64}$")
EXCLUDE_DIRS = {"__pycache__", ".git", ".pytest_cache", ".mypy_cache", "node_modules"}
EXCLUDE_FILES_SUFFIX = (".pyc", ".pyo")
EXCLUDE_FILES_EXACT = {".DS_Store", "Thumbs.db"}

# (key, script, takes_file): the description validator wants the SKILL.md path,
# the other two want the folder.
VALIDATORS = [
    ("description", "skill_description_validator.py", True),
    ("structure", "skill_structure_validator.py", False),
    ("checklist_6_6", "skill_review_checklist_runner.py", False),
]


# ---- frontmatter (minimal, stdlib only — handles inline and folded `>`) -----

def read_frontmatter(skill_md: str) -> dict:
    with open(skill_md, encoding="utf-8") as fh:
        text = fh.read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return {}
    block = m.group(1)
    meta, key, folded = {}, None, []

    def flush():
        if key is not None:
            meta[key] = " ".join(p.strip() for p in folded).strip()

    for line in block.splitlines():
        top = re.match(r"^([A-Za-z0-9_]+):\s?(.*)$", line)
        if top and not line.startswith(" "):
            flush()
            key, val = top.group(1), top.group(2).strip()
            if val in (">", "|", ">-", "|-"):
                folded = []
            else:
                meta[key] = val.strip().strip('"').strip("'")
                key, folded = None, []
        elif key is not None and (line.startswith(" ") or line.strip()):
            folded.append(line)
    flush()
    return meta


# ---- gate: canonical validators (delegated, never recoded) ------------------

def run_validator(script_dir: str, script: str, target: str) -> dict:
    path = os.path.join(script_dir, script)
    if not os.path.isfile(path):
        return {"ran": False, "passed": False, "error": f"validator absent: {script}"}
    try:
        proc = subprocess.run(
            [sys.executable, path, target, "--output", "json"],
            capture_output=True, text=True, timeout=60,
        )
    except Exception as exc:  # noqa: BLE001
        return {"ran": False, "passed": False, "error": str(exc)}
    return {"ran": True, "passed": proc.returncode == 0, "exit": proc.returncode}


def check_upload_constraints(meta: dict) -> list:
    """claude.ai / API hard limits, returned as a list of failure strings."""
    fails = []
    name = meta.get("name", "")
    desc = meta.get("description", "")
    if not name:
        fails.append("name: absent du frontmatter")
    elif not NAME_RE.match(name):
        fails.append(f"name: '{name}' invalide (attendu: 1-64 car., [a-z0-9-])")
    if name.lower() in RESERVED_NAMES:
        fails.append(f"name: '{name}' est un mot réservé")
    if not desc:
        fails.append("description: absente")
    elif len(desc) > 1024:
        fails.append(f"description: {len(desc)} car. > 1024")
    return fails


# ---- exhaustive walk --------------------------------------------------------

def collect_files(folder: str) -> list:
    out = []
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in sorted(files):
            if f in EXCLUDE_FILES_EXACT or f.endswith(EXCLUDE_FILES_SUFFIX):
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, folder)
            out.append((full, rel))
    return sorted(out, key=lambda t: t[1])


# ---- main -------------------------------------------------------------------

def package(folder: str, out_path: str, dry_run: bool, force: bool) -> dict:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    folder = os.path.abspath(folder)
    result = {"folder": folder, "ok": False, "gate": {}, "manifest": [],
              "constraints": [], "zip": None, "skipped_gate": force}

    skill_md = os.path.join(folder, "SKILL.md")
    if not os.path.isfile(skill_md):
        result["error"] = "SKILL.md absent — ce n'est pas un dossier de skill"
        return result

    meta = read_frontmatter(skill_md)
    skill_name = meta.get("name") or os.path.basename(folder)

    # gate: validators + upload constraints
    gate = {}
    for name, script, takes_file in VALIDATORS:
        target = skill_md if takes_file else folder
        gate[name] = run_validator(script_dir, script, target)
    constraints = check_upload_constraints(meta)
    result["gate"] = {k: v["passed"] for k, v in gate.items()}
    result["constraints"] = constraints
    gate_pass = all(v["passed"] for v in gate.values()) and not constraints

    files = collect_files(folder)
    result["manifest"] = [rel for _, rel in files]
    result["file_count"] = len(files)
    result["skill_name"] = skill_name

    if not gate_pass and not force:
        result["error"] = "gate FAIL — skill non conforme (utiliser --force pour outrepasser)"
        result["gate_detail"] = {k: v for k, v in gate.items() if not v["passed"]}
        return result

    if dry_run:
        result["ok"] = gate_pass
        result["dry_run"] = True
        return result

    # write the zip with the skill folder at the archive root
    out_path = out_path or os.path.join(os.getcwd(), f"{skill_name}.zip")
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for full, rel in files:
            zf.write(full, arcname=os.path.join(skill_name, rel))

    result["zip"] = os.path.abspath(out_path)
    result["ok"] = True
    return result


def render_text(r: dict) -> str:
    lines = ["=" * 72, "SKILL PACKAGER", f"Folder: {r['folder']}", "=" * 72, ""]
    if r.get("error") and not r.get("manifest"):
        lines.append(f"[ERREUR] {r['error']}")
        return "\n".join(lines)
    lines.append(f"Skill: {r.get('skill_name','?')}  ({r.get('file_count',0)} fichiers)")
    lines.append("")
    lines.append("Gate de conformité (validators canoniques délégués) :")
    for k, ok in r["gate"].items():
        lines.append(f"  [{'PASS' if ok else 'FAIL'}] {k}")
    if r["constraints"]:
        lines.append("  Contraintes d'upload :")
        for c in r["constraints"]:
            lines.append(f"    [FAIL] {c}")
    else:
        lines.append("  [PASS] contraintes d'upload (name/description)")
    lines.append("")
    lines.append("Manifest (walk exhaustif) :")
    for rel in r["manifest"]:
        lines.append(f"  + {rel}")
    lines.append("")
    if r.get("error"):
        lines.append(f"[BLOQUÉ] {r['error']}")
    elif r.get("dry_run"):
        lines.append("[DRY-RUN] aucun fichier écrit.")
    elif r.get("zip"):
        note = "  (gate outrepassé via --force)" if r.get("skipped_gate") else ""
        lines.append(f"[OK] zip écrit : {r['zip']}{note}")
    lines.append("-" * 72)
    lines.append(f"Verdict : {'PASS' if r['ok'] else 'FAIL'}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Package a skill folder into an installable .zip")
    ap.add_argument("folder", nargs="?", default=None, help="skill folder (default: write-a-skill itself)")
    ap.add_argument("--out", default=None, help="output zip path (default: <name>.zip in cwd)")
    ap.add_argument("--dry-run", action="store_true", help="gate + manifest, write nothing")
    ap.add_argument("--force", action="store_true", help="package even if the gate fails")
    ap.add_argument("--output", choices=["text", "json"], default="text")
    args = ap.parse_args()

    # embedded sample: no path -> dry-run on the owning skill folder
    sample = args.folder is None
    folder = args.folder or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dry = args.dry_run or sample

    r = package(folder, args.out, dry, args.force)
    if args.output == "json":
        print(json.dumps(r, indent=2, ensure_ascii=False))
    else:
        print(render_text(r))
    return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

"""Recette à double sens de trouver_skill.py — mêmes cas que trouver-skill.test.mjs (25/11/2026).

    python test_trouver_skill.py      exit 0 si tous les cas tiennent
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from trouver_skill import candidats, dossier_skill, racine_du_parc, trouver_fichier, trouver_skill  # noqa: E402

ok, echecs = 0, []


def cas(nom, fn):
    global ok
    try:
        fn()
        ok += 1
        print(f"  [PASS] {nom}")
    except AssertionError as e:
        echecs.append(nom)
        print(f"  [FAIL] {nom} — {e}")


def skill(d: Path, *fichiers):
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text("---\nname: x\n---\n", encoding="utf-8")
    for f in fichiers:
        (d / f).parent.mkdir(parents=True, exist_ok=True)
        (d / f).write_text("x", encoding="utf-8")


base = Path(tempfile.mkdtemp(prefix="trouver-skill-py-")).resolve()
try:
    parc, config, variable = base / "parc", base / "config", base / "variable"
    skill(parc / "factory-forge-agents" / ".claude" / "skills" / "quality-oracles", "scripts/oracle-a11y.py")
    skill(parc / "factory-forge-design" / "skills" / "systeme-de-marque")
    (parc / "factory-forge-agents" / ".claude" / "skills" / "sans-skill-md").mkdir(parents=True)
    skill(parc / "autre-depot" / ".claude" / "skills" / "hors-forge")
    v1 = config / "plugins" / "cache" / "factory" / "factory-socle" / "aaa111" / "skills" / "factory-page-html"
    v2 = config / "plugins" / "cache" / "factory" / "factory-socle" / "bbb222" / "skills" / "factory-page-html"
    skill(v1, "scripts/render_page.py")
    skill(v2, "scripts/render_page.py")
    os.utime(v1, (1767225600, 1767225600))
    os.utime(v2, (1793491200, 1793491200))
    skill(config / "skills" / "ancien-skill")
    skill(variable / "quality-oracles")
    env = {"FORGE_ROOT": str(parc), "CLAUDE_CONFIG_DIR": str(config)}

    def t1():
        r = trouver_skill("quality-oracles", env)
        assert r and r[0] == "forge" and r[1] == parc / "factory-forge-agents" / ".claude" / "skills" / "quality-oracles", r
    cas("VERT — un skill d'une forge se trouve dans ses SOURCES", t1)

    def t2():
        r = trouver_skill("systeme-de-marque", env)
        assert r and r[0] == "forge" and r[1].parts[-3:] == ("factory-forge-design", "skills", "systeme-de-marque"), r
    cas("VERT — un skill rangé sous skills/ (forge-design) se trouve aussi", t2)

    def t3():
        r = trouver_skill("quality-oracles", {**env, "FORGE_SKILLS_INSTALLES": str(variable)})
        assert r and r[0] == "variable", r
    cas("ROUGE → VERT — FORGE_SKILLS_INSTALLES prime sur les sources", t3)

    def t4():
        r = trouver_skill("factory-page-html", env)
        assert r and r[0] == "plugin" and r[1] == v2, r
    cas("VERT — un skill absent des forges vient du PLUGIN le plus récent", t4)

    def t5():
        r = trouver_skill("ancien-skill", env)
        assert r and r[0] == "historique", r
        ordre = [v for v, _ in candidats("quality-oracles", env)]
        assert ordre[-1] == "historique", ordre
    cas("VERT — l'adresse historique ne sert qu'en dernier recours", t5)

    cas("ROUGE — un dossier sans SKILL.md n'est pas un skill", lambda: (_ for _ in ()).throw(AssertionError("trouvé")) if trouver_skill("sans-skill-md", env) else None)
    cas("ROUGE — un dépôt qui n'est pas une forge n'est pas fouillé", lambda: (_ for _ in ()).throw(AssertionError("trouvé")) if trouver_skill("hors-forge", env) else None)
    cas("ROUGE — un skill introuvable rend None", lambda: (_ for _ in ()).throw(AssertionError("trouvé")) if trouver_skill("n-existe-pas", env) else None)

    def t9():
        f = trouver_fichier("factory-page-html", "scripts", "render_page.py", env=env)
        assert f == v2 / "scripts" / "render_page.py", f
        assert trouver_fichier("quality-oracles", "scripts", "absent.mjs", env=env) is None
    cas("VERT — trouver_fichier rend le fichier du premier skill qui le porte", t9)

    def t11():
        assert dossier_skill("quality-oracles", env) == parc / "factory-forge-agents" / ".claude" / "skills" / "quality-oracles"
        assert dossier_skill("n-existe-pas", env) == config / "skills" / "n-existe-pas"
    cas("VERT — dossier_skill rend le skill trouvé, sinon son adresse historique (message d'absence lisible)", t11)

    def t10():
        depot = parc / "factory-forge-agents"
        (depot / ".git").mkdir(parents=True, exist_ok=True)
        r = racine_du_parc({}, depuis=depot / ".claude" / "skills" / "quality-oracles" / "scripts" / "lib")
        assert r == parc, r
    cas("VERT — sans FORGE_ROOT, la racine est le parent du dépôt appelant", t10)
finally:
    shutil.rmtree(base, ignore_errors=True)

print(f"trouver_skill (Python) : {ok} PASS, {len(echecs)} FAIL")
sys.exit(1 if echecs else 0)

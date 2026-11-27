"""trouver_skill.py — où est le dossier d'un skill du parc, sans rien installer dans la configuration Claude (25/11/2026).

Équivalent Python de `trouver-skill.mjs` (même ordre, mêmes règles ; la version de référence est le fichier .mjs voisin) :
  1. FORGE_SKILLS_INSTALLES/<nom>            — la variable des recettes, qui prime sur tout ;
  2. les SOURCES des forges du parc          — <racine>/factory-forge-*/{.claude/skills,skills}/<nom>, racine = FORGE_ROOT,
                                               sinon le parent du dépôt qui porte le fichier appelant ;
  3. les PLUGINS installés                   — <config>/plugins/cache/<marketplace>/<plugin>/<version>/skills/<nom>, la plus
                                               récente (<config> = CLAUDE_CONFIG_DIR, sinon ~/.claude) ;
  4. l'adresse HISTORIQUE                    — <config>/skills/<nom>.
Un skill n'est trouvé que si son dossier porte un SKILL.md ; introuvable : None.

Copie partagée : des copies identiques vivent dans les forges qui en ont besoin ; une copie qui diverge est un défaut.
"""
from __future__ import annotations

import os
from pathlib import Path


def _depot_de(dossier: Path) -> Path | None:
    # Remontée pas à pas, un parent à la fois : la garde TF-2523 de forge-tests refuse la liste des ancêtres d un chemin absolu.
    p = dossier.resolve()
    while True:
        if (p / ".git").exists():
            return p
        if p.parent == p:
            return None
        p = p.parent


def racine_du_parc(env=None, depuis: str | os.PathLike | None = None) -> Path | None:
    env = os.environ if env is None else env
    if (env.get("FORGE_ROOT") or "").strip():
        return Path(env["FORGE_ROOT"].strip()).resolve()
    depot = _depot_de(Path(depuis) if depuis else Path(__file__).parent)
    return depot.parent if depot else None


def config_claude(env=None) -> Path | None:
    env = os.environ if env is None else env
    if (env.get("CLAUDE_CONFIG_DIR") or "").strip():
        return Path(env["CLAUDE_CONFIG_DIR"].strip()).resolve()
    try:
        return Path.home() / ".claude"
    except RuntimeError:
        return None


def _sous_dossiers(d: Path) -> list[str]:
    try:
        return sorted(e.name for e in d.iterdir() if e.is_dir())
    except OSError:
        return []


def candidats(nom: str, env=None, depuis=None) -> list[tuple[str, Path]]:
    env = os.environ if env is None else env
    liste: list[tuple[str, Path]] = []
    if (env.get("FORGE_SKILLS_INSTALLES") or "").strip():
        liste.append(("variable", Path(env["FORGE_SKILLS_INSTALLES"].strip()).resolve() / nom))
    racine = racine_du_parc(env, depuis)
    if racine:
        for depot in (n for n in _sous_dossiers(racine) if n.startswith("factory-forge-")):
            for sous in (Path(".claude") / "skills", Path("skills")):
                liste.append(("forge", racine / depot / sous / nom))
    config = config_claude(env)
    if config:
        cache = config / "plugins" / "cache"
        versions = []
        for m in _sous_dossiers(cache):
            for p in _sous_dossiers(cache / m):
                for v in _sous_dossiers(cache / m / p):
                    c = cache / m / p / v / "skills" / nom
                    if (c / "SKILL.md").exists():
                        try:
                            t = c.stat().st_mtime
                        except OSError:
                            t = 0.0
                        versions.append((t, c))
        liste.extend(("plugin", c) for _, c in sorted(versions, key=lambda x: -x[0]))
        liste.append(("historique", config / "skills" / nom))
    return liste


def trouver_skill(nom: str, env=None, depuis=None) -> tuple[str, Path] | None:
    """(voie, chemin) du skill `nom`, ou None."""
    for voie, chemin in candidats(nom, env, depuis):
        if (chemin / "SKILL.md").exists():
            return voie, chemin
    return None


def trouver_fichier(nom: str, *relatif: str, env=None, depuis=None) -> Path | None:
    """Un fichier d'un skill, ou None."""
    for _, chemin in candidats(nom, env, depuis):
        if (chemin / "SKILL.md").exists() and (chemin.joinpath(*relatif)).exists():
            return chemin.joinpath(*relatif)
    return None


def chemin_attendu(nom: str, *relatif: str) -> Path:
    """L'adresse où le skill serait cherché en premier, pour un message lisible quand rien n'est trouvé."""
    c = candidats(nom)
    return (c[0][1] if c else Path("~") / ".claude" / "skills" / nom).joinpath(*relatif)


def dossier_skill(nom: str, env=None, depuis=None) -> Path:
    """Le dossier du skill `nom` s'il est trouvé, sinon son adresse historique (~/.claude/skills/<nom>), que les messages
    d'absence nomment : un appelant qui faisait `Path.home() / ".claude" / "skills" / nom` garde le même comportement quand
    rien n'est trouvé, et lit les sources des forges ou les plugins quand ils existent (25/11/2026)."""
    r = trouver_skill(nom, env, depuis)
    if r:
        return r[1]
    config = config_claude(env)
    return (config if config else Path.home() / ".claude") / "skills" / nom

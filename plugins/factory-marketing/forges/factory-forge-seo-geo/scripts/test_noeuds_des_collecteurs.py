"""Preuve a double sens : un collecteur nomme les noeuds que la grille porte sous ces numeros.

Le 26/08/2026, l'evolution 6245d81445b9 -> 27e2527398eb a deplace 29 en 30, 31 en 32 et
58 en 59 (referentiel/correspondances-grille.json). agents_ia.py et crux.py ont garde les
anciens numeros jusqu'au 02/11/2026 : leurs verdicts « non mesurable » citaient le renvoi
« Indexation », le noeud « Canonical » et « Presence dans les reponses IA » a la place de
« Logs Serveur », « Performance » et « Acces & Directives IA ».

  VERT  : chaque constante NOEUDS designe, dans referentiel/grille-noeuds.md, le noeud dont
          le titre porte le sujet du collecteur.
  ROUGE : les anciens numeros sont refuses, en nommant le titre trouve a leur place.

Usage :
    python scripts/test_noeuds_des_collecteurs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import agents_ia  # noqa: E402
import crux  # noqa: E402
import oracle_redirections  # noqa: E402

GRILLE = ICI.parent / "referentiel" / "grille-noeuds.md"

# Le sujet de chaque collecteur, lu dans le titre du noeud : jamais un numero.
ATTENDU = {
    "agents_ia": (agents_ia.NOEUDS, ["Logs Serveur", "Accès & Directives IA"]),
    "crux": (crux.NOEUDS, ["Performance"]),
    "oracle_redirections": (oracle_redirections.NOEUDS, ["Crawl"]),
}


def titres(texte: str) -> dict[int, str]:
    """Le titre de chaque noeud : les lignes « | <numero> | <titre> | » de la grille."""
    return {int(m[1]): m[2].strip() for m in re.finditer(r"^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|", texte, re.M)}


def ecarts(noeuds: list[int], sujets: list[str], table: dict[int, str]) -> list[str]:
    """Les sujets qu'aucun noeud declare ne porte, avec le titre trouve sous chaque numero."""
    trouves = [table.get(n, "<absent>") for n in noeuds]
    return [f"« {s} » absent de {list(zip(noeuds, trouves))}" for s in sujets if not any(s in t for t in trouves)]


def main() -> int:
    table = titres(GRILLE.read_text(encoding="utf-8"))
    echecs: list[str] = []
    total = 1
    if len(table) < 80:
        echecs.append(f"grille illisible : {len(table)} noeuds lus")
    for nom, (noeuds, sujets) in ATTENDU.items():
        total += 1
        if ecarts(noeuds, sujets, table):
            echecs.append(f"vert {nom} : {ecarts(noeuds, sujets, table)}")
    rouges = {"agents_ia d'avant le 26/08": ([29, 58], ATTENDU["agents_ia"][1]), "crux d'avant le 26/08": ([31], ATTENDU["crux"][1])}
    for nom, (noeuds, sujets) in rouges.items():
        total += 1
        if not ecarts(noeuds, sujets, table):
            echecs.append(f"rouge {nom} : les anciens numeros passent")
    for e in echecs:
        print(f"  ECHEC {e}".encode("ascii", "replace").decode("ascii"))
    print(f"\n{total - len(echecs)}/{total} cas conformes")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())

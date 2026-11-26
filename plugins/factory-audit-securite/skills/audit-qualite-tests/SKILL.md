---
name: audit-qualite-tests
description: Audite la qualité vérifiable d'un projet avec forge-tests — couverture des exigences par les tests, accessibilité, contraste, sécurité, rendu visuel, dette de tests, non-testables qualifiés — et rend un rapport lisible ou JSON avec ses findings bloquants, puis la boucle de fermeture bornée. Use when / déclencher quand l'utilisateur veut savoir si un projet est testé, auditer ses tests, mesurer la traçabilité exigences→tests, ou fermer les findings d'un audit précédent. Ne pas déclencher pour la sécurité du site (→ securite-web), un audit de gouvernance (→ audit-applicatif) ni pour écrire les exigences (→ redige-les-exigences).
version: 1.0.0
---

# Audit qualité des tests (forge-tests)

Enveloppe de **forge-tests**. Elle lance le noyau de la forge sur le projet et rend son rapport ;
la méthode (pans, seuils, dette, boucle de fermeture) est dans le README de la forge.

## 1. Trouver la forge (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-tests"
test -f "$F/pyproject.toml" && echo "forge présente : $F" || echo "forge absente"
command -v uv >/dev/null || echo "uv absent : https://docs.astral.sh/uv/"
```

Forge ou `uv` absent : le dire, proposer la phrase d'usage de la Factory
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Aucun verdict inventé.

## 2. Auditer

```bash
uv run --project "$F" python -m forge_tests <projet>                  # rapport lisible
uv run --project "$F" python -m forge_tests <projet> --json --sortie rapport-1.json
# boucle de fermeture : rejouer en reprenant le rapport précédent
uv run --project "$F" python -m forge_tests <projet> --reprendre rapport-1.json --json --sortie rapport-2.json
```

Les pans navigateur (accessibilité, contraste, visuel) demandent Playwright et Chromium ; sans
eux, ils se déclarent non mesurés, jamais verts.

## 3. Règles

- Le rapport se rend avec ses **findings bloquants nommés** et sa part non jugée.
- **Boucle de fermeture bornée : 5 cycles au plus.** Au-delà, on s'arrête et on rend l'état.
- Le rapport se range hors des sources du projet ; il ne modifie pas le projet audité.
- Une correction se fait dans le projet, sur accord humain, puis l'audit se rejoue.

Détail, pans et seuils : `$F/README.md`.

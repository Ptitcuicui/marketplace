---
name: veille-derive
description: Surveille dans le temps ce qu'un audit ponctuel ne voit pas, avec forge-observability — un plan d'observation déclare les mesures (qualité de données, tests, visibilité et citation par les IA…), chaque passage ajoute un relevé daté au journal du projet, et le calcul de dérive compare les relevés pour signaler une dégradation. Observe et alerte, ne corrige jamais. Use when / déclencher quand l'utilisateur veut suivre un indicateur entre deux runs, détecter une régression ou une baisse de visibilité dans la durée, ou mettre en place une veille récurrente sur un produit en production. Ne pas déclencher pour un audit ponctuel (→ audit-qualite-tests, discipline-data, audit-seo-geo).
version: 1.0.0
---

# Veille de dérive (forge-observability)

Enveloppe de **forge-observability**. Elle relève, compare et alerte ; une dérive détectée est un
constat rendu à l'humain, jamais une correction.

## 1. Trouver la forge (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-observability"
test -f "$F/README.md" && echo "forge présente : $F" || echo "forge absente"
```

Forge absente : le dire, proposer la phrase d'usage de la Factory
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Aucun relevé inventé.

## 2. Observer, puis comparer

1. Écrire le **plan d'observation** du projet en partant de `$F/fixtures/plan-exemple.json` :
   quelles mesures, sur quelle cible, à quel rythme.
2. Relever (un passage = une ligne datée ajoutée au journal) :
   ```bash
   node "$F/scripts/observer.mjs" <plan.json> forge/snapshots.jsonl
   ```
3. Calculer la dérive entre les relevés :
   ```bash
   node "$F/scripts/derive.mjs" <plan.json> forge/snapshots.jsonl
   ```

Le journal `forge/snapshots.jsonl` est **ajouté, jamais réécrit** : une ligne fausse se
rectifie par une ligne de plus.

## 3. Règles

- Aucun service tiers payant ; une mesure qui demande un accès absent se déclare « non
  mesurable », datée, jamais devinée.
- La forge ne tourne pas d'elle-même en continu : chaque passage est lancé (par l'humain ou par
  un run du pilot).
- Un service se déclare prouvé ou non selon le catalogue de la forge : ne jamais présenter un
  service non prouvé comme fiable.

Détail du catalogue des services et de leurs limites : `$F/README.md`.

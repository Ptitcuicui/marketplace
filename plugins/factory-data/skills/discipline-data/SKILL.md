---
name: discipline-data
description: Applique la discipline de la donnée de forge-data — profiler (assertions de qualité exécutables), tracer (lineage déclaré, niveau OpenLineage), restituer (chiffres ancrés à leur source), contractualiser (data contract, niveau ODCS), modéliser une couche Gold, réconcilier, qualifier une migration de rapport (Power BI), importer un brouillon d'assertions depuis un schéma SQL, anonymiser un extrait de production. Chaque verbe est jugé par son oracle. Use when / déclencher dès qu'il faut cadrer la qualité d'un jeu de données, documenter un lineage, écrire un data contract, vérifier qu'un rapport chiffré cite ses sources, migrer un rapport BI ou masquer un extrait avant usage. Ne pas déclencher pour profiler un fichier de données brut (→ data-quality-auditor) ni pour surveiller une dérive dans le temps (→ veille-derive).
version: 1.0.0
---

# Discipline de la donnée (forge-data)

Enveloppe de **forge-data**. La forge vérifie la **forme de la discipline** ; le profiling d'un
dataset reste au skill `data-quality-auditor`, jamais réécrit ici.

## 1. Trouver la forge (jamais simuler)

Dans cet ordre : la forge du poste (`$FORGE_ROOT`, sinon `~/factory`), puis la copie livrée
avec la mallette `factory-data`.

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-data"
[ -f "$F/README.md" ] || F="${CLAUDE_PLUGIN_ROOT}/forges/factory-forge-data"
test -f "$F/README.md" && echo "forge présente : $F" || echo "forge absente"
```

Hors Claude Code, quand `${CLAUDE_PLUGIN_ROOT}` n'est pas remplacé, la copie livrée est dans
`../../forges/factory-forge-data` à partir du dossier de ce skill : la chercher là avant de
conclure à son absence.

Forge absente : le dire, proposer la phrase d'usage de la Factory
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Aucun verdict inventé.

## 2. Choisir le verbe

| Verbe | Artefact produit chez le projet | Oracle |
| --- | --- | --- |
| Profiler | assertions de qualité (JSON) | `node "$F/oracles/oracle-profiler.mjs" <assertions.json>` |
| Tracer | lineage déclaré (JSON) | `node "$F/oracles/oracle-tracer.mjs" <lineage.json>` |
| Restituer | rapport chiffré (Markdown) | `node "$F/oracles/oracle-restituer.mjs" <rapport.md>` |
| Contractualiser | data contract (JSON) | `node "$F/oracles/oracle-contractualiser.mjs" <contrat.json>` |
| Modéliser | modèle dimensionnel Gold | `node "$F/oracles/oracle-modeliser.mjs" <modele.json>` |
| Réconcilier | Gold ↔ modèle sémantique | `node "$F/oracles/oracle-reconcilier.mjs" <reconciliation.json>` |
| Qualifier une migration de rapport | qualification | `node "$F/oracles/oracle-qualifier.mjs" <qualification.json>` |

Les formats attendus sont ceux des fixtures vertes de la forge (`$F/fixtures/*-verte*`) : partir
d'elles, jamais d'un format deviné.

Générateurs (pas des oracles) :

```bash
node "$F/scripts/importer.mjs" <schema.sql> --sortie-dir <dossier>      # brouillon d'assertions et de contrat
node "$F/scripts/anonymiser.mjs" --masquage <masquage.json> --source <extrait> --sortie <dossier-neuf>
node "$F/oracles/oracle-anonymiser.mjs" <dossier-neuf> --source <extrait>   # AVANT de détruire la source
```

L'anonymisation n'est jamais une pseudonymisation (clé, hachage même salé, table de
correspondance) : l'oracle la refuse (AN4).

## 3. Règles

- **Jamais de donnée client dans la forge.** Les artefacts vivent chez le projet.
- **Anonymiser avant tout usage hors production**, aux seuils de la forge (k ≥ 5, l ≥ 2,
  jointure 0 par défaut) ; le rapport `anonymisation.json` se rend avec l'extrait.
- Un chiffre restitué cite sa source ; un oracle en FAIL se rend tel quel, avec sa règle.

Détail des règles de chaque oracle : `$F/README.md`.

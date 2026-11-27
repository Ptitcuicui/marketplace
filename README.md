# Factory — marketplace des mallettes

Marketplace de plugins Claude des consultants Factory. Un plugin = une mallette.

| Plugin | Contenu |
|---|---|
| `factory-socle` | Contrôles qualité (oracles), pages HTML chartées, communication, système de marque, prompts, contre-expertise, pilotage de mission, run de mandat, boussole, accueil de la factory, agents de la flotte. Requis par toutes les mallettes. |
| `factory-avant-vente` | Propales et revue, appels d'offres, PowerPoint, Word et PDF chartés, schémas, revue de CV, plan d'amélioration, qualification des entrants. |
| `factory-produit` | Run complet et run de version, surface fonctionnelle, exigences et vues, critique et amélioration du design, direction artistique, intégration de modèles d'IA, déploiement et restauration sous GO humain. |
| `factory-audit-securite` | Audit applicatif et fiche sécurité, sécurité du site livré, sécurité des agents IA, audit qualité des tests. Chaque audit part sur commande explicite. |
| `factory-data` | Profilage d'un jeu de données, discipline de la donnée (assertions, lineage, restitution sourcée, data contract, modèle Gold, migration de rapport, anonymisation), veille de dérive. |
| `factory-marketing` | Étude SEO et GEO d'un site (sur commande explicite), animation de réseaux sociaux avec accord humain par lot, clip de présentation. |

Les skills qui enveloppent une forge la cherchent sous `$FORGE_ROOT`, sinon `~/factory`, puis dans
la copie que leur mallette embarque. Forge absente : ils le disent et proposent la phrase d'usage de
la Factory, sans jamais simuler un verdict.

## Forges embarquées

Une mallette peut livrer ses forges avec ses skills : le consultant n'a rien à cloner, et la forge
se met à jour avec la marketplace. `outils/mallettes.json` les déclare dans `forges` ;
`construire.mjs` les copie sous `plugins/<mallette>/forges/<forge>/`, sans leurs `skills/`,
`.claude/`, `.github/` ni réglages git (sauf ce que `garder` réclame), et joint les paquets npm de
production verrouillés quand la forge déclare `dependances_npm`.

| Mallette | Forges embarquées |
|---|---|
| `factory-socle` | `factory-pilot`, partie outil seulement (doctrine, oracles, gabarits, scripts, agents hérités) |
| `factory-produit` | `factory-forge-ops` (le pilot qu'elle lit vient du socle) |
| `factory-data` | `factory-forge-data`, `factory-forge-observability` |
| `factory-audit-securite` | `factory-forge-agents-security`, `factory-forge-websec`, `factory-forge-audit` (avec `ajv` et `js-yaml`), `factory-forge-tests` |
| `factory-marketing` | `factory-forge-seo-geo` (sans ses `input/` ni `output/`) |

Ce qui reste à installer sur le poste, sur accord : `uv` pour forge-tests (ses paquets Python
viennent de `uv.lock`), Chromium pour ses pans accessibilité et visuel, et Playwright pour le rendu
JS de forge-seo-geo. Sans eux, ces pans se déclarent non jugés, jamais verts ; le reste se joue.

### Pilot embarqué (mode consultant)

Le socle livre la partie outil du pilot, sans son état : ni `input/` (pas même l'index des anciens
retours), ni `output/`, ni les données de `todo/` (TODO, décisions, registres), ni `runs/`. Seuls les
fichiers suivis par git sont assemblés : ce qu'un poste a généré ou ignoré ne part jamais. La copie porte `EMBARQUE.json` : `bootstrap.mjs` n'y
clone ni n'y tire rien.

Sur un poste sans parc (ni `FORGE_ROOT`, ni `~/factory`), le hook d'ouverture du socle pose
`~/.factory-forge` : le pilot embarqué et les forges que livrent les mallettes installées, copiés
seulement quand une mallette change de version. Il exporte `FORGE_ROOT` vers les commandes de la
session. Ce que le poste écrit dans le pilot (TODO, retours, ledger) n'est jamais écrasé par une mise
à jour, et ne remonte pas au pilot central : un consultant qui a accès à `Ptitcuicui/factory-retours`
y ouvre une issue. Un parc complet sur le poste prime toujours, et alors le hook n'écrit rien.
Dans le chat claude.ai, aucun hook ne tourne : pas de pilot.

Pas embarquées, parce qu'aucune mallette n'en livre de skill : `factory-forge-conception`,
`factory-forge-design`, `factory-forge-development`, `factory-forge-organization` et
`factory-forge-agents` (ses skills sont dans le socle et les mallettes, ses outils restent au parc).

## Installer (Claude Code)

```
/plugin marketplace add Ptitcuicui/marketplace
/plugin install factory-avant-vente@factory
/plugin install factory-produit@factory
/plugin install factory-audit-securite@factory
/plugin install factory-data@factory
/plugin install factory-marketing@factory
```

Installer seulement les mallettes utiles. Le socle s'installe tout seul : chaque mallette en
dépend.

## Maintenir

**Ne modifiez jamais `plugins/` à la main.** Ce dossier est assemblé depuis les forges :

1. Corriger le skill ou la forge dans son dépôt (`factory-forge-*`), sous ses règles.
2. Depuis la racine des dépôts : `node factory-marketplace/outils/construire.mjs`.
3. `claude plugin validate .`, puis commit et push.

La liste des skills par plugin vit dans `outils/mallettes.json`. `PROVENANCE.json` de chaque
plugin dit de quel dépôt et de quel commit vient chaque skill. `outils/rapport-construction.json`
liste ce qui ne se résout pas encore dans un plugin (chemins en dur, dépendances au pilot).

Règles : zéro donnée client, zéro secret, aucun champ `version`, aucun dossier `bin/`.

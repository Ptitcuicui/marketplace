# factory-forge-observability

Forge **observabilité continue** de l'écosystème Factory — née de **TF-0112** (décision
humaine du 12/08/2026, synthèse convergente de quatre rapports d'état de l'art). Constat
fondateur : tout l'écosystème forge vérifie **one-shot** (audit forge-tests ponctuel,
healthcheck instantané, assertions data à l'instant T) alors qu'une dérive — data qui se
dégrade, régression de tests, chute de visibilité IA — ne se découvre sinon qu'au run
suivant, parfois des semaines plus tard sur un produit déjà en production.

## Utilisation

Cette forge ne se lance pas seule : la Factory la mobilise quand votre demande en a besoin.
Ouvrez une session Claude Code dans le dossier de votre projet et collez cette phrase, la même
pour tous les cas d'usage :

```
Utilise https://github.com/Ptitcuicui/factory pour ce projet
```

La Factory installe ce qui manque, cette forge comprise, puis vous demande ce que vous voulez
obtenir. Détail : [README de la Factory](https://github.com/Ptitcuicui/factory#utiliser-la-factory--une-seule-phrase).

## Catalogue de services

> Section proposée par la campagne « catalogues » du pilot (2026-08-13) — générée depuis
> la source unique `catalogues/catalogue.jsonl` du pilot (v1.6.0, challengée état de
> l'art le 12/08/2026). **prouvé** = preuve exécutée ; *déclaré* = méthode documentée seulement.

| Service | Intention (« je veux… ») | Point d'entrée | Statut |
|---|---|---|---|
| **Observer (plans → snapshots)** | surveiller entre les runs ce que l'écosystème ne vérifie qu'en one-shot | `node scripts\observer.mjs <plan.json>` | prouvé (experimental) |
| **Détecter la dérive** | être alerté quand quelque chose a changé depuis le dernier passage | `node scripts\derive.mjs <snapshots.jsonl>` | prouvé (experimental) |
| **Veille citation IA** | suivre la présence d'un domaine dans les réponses génératives | `veille-ia\METHODE.md (méthode manuelle documentée)` | déclaré (experimental) |

Le catalogue consolidé des dix forges vit chez le pilot :
[factory-pilot/catalogues/CATALOGUES.md](https://github.com/Ptitcuicui/factory/blob/main/catalogues/CATALOGUES.md).

## Doctrine

**Elle observe et alerte, ne corrige jamais.** Une dérive constatée est un signal, jamais
un geste automatique. Invocation par le pilot (ou une tâche planifiée externe) ; zéro API
tierce payante ; zéro donnée client (fixtures synthétiques uniquement, dépôt public).

## Catalogue v0

> `prouvé` = self-test exécuté, fixtures rouge/verte à l'appui · `déclaré` = méthode
> documentée, aucune automatisation revendiquée.

| Service | Intention (« je veux… ») | Point d'entrée | Statut |
|---|---|---|---|
| **Socle de récurrence** | déclarer des sondes à surveiller et en capturer un instantané horodaté | `node scripts/observer.mjs <plan.json> <snapshots.jsonl>` | **prouvé** |
| **Détection de dérive** | savoir si quelque chose a changé entre deux relevés (ou plus) | `node scripts/derive.mjs <plan.json> <snapshots.jsonl> [--index N]` | **prouvé** |
| **Sonde `commande`** | surveiller toute métrique exposée par une commande (JSON sur stdout) | type `commande` d'un plan | **prouvé** |
| **Sonde `oracle_externe`** | surveiller la dérive de verdict/compteurs d'un oracle tiers à contrat JSON | type `oracle_externe` d'un plan | **prouvé** |
| **Sonde `rapport_json`** | surveiller des compteurs dans un rapport JSON existant (ex. forge-tests) | type `rapport_json` d'un plan | **prouvé** |
| **Sonde `manuel`** | transporter une valeur consignée par un humain dans le même format snapshot | type `manuel` d'un plan | **prouvé** (transport) |
| **Sonde `job_planifie`** | savoir qu'un job planifié est muet ou en échec, ou que l'indicateur qu'il alimente est vide sur une population non vide | type `job_planifie` d'un plan | **prouvé** |
| **Veille citation IA** | savoir si ma marque est citée dans les réponses génératives | `veille-ia/METHODE.md` + sonde `manuel` | *déclaré* |

## Quick start

```bash
# Un plan déclare des sondes nommées (exemple : fixtures/plan-exemple.json)
node scripts/observer.mjs fixtures/plan-exemple.json forge/snapshots.jsonl
# → {"verbe":"observer","verdict":"OK",...} + une ligne appendue à forge/snapshots.jsonl

# Rejouer plus tard (après un déploiement, un jour de plus, un nouveau commit...)
node scripts/observer.mjs fixtures/plan-exemple.json forge/snapshots.jsonl

# Comparer le dernier snapshot au précédent : y a-t-il une dérive ?
node scripts/derive.mjs fixtures/plan-exemple.json forge/snapshots.jsonl
# → {"oracle":"derive","verdict":"PASS"|"FAIL","findings":[...]}  · exit 0/1/2

# Preuve par le geste : cycles observer→derive réels, rouge et vert, sur scénarios isolés
node oracles/self-test.mjs
```

## Format déclaratif `forge-observability/plan@1`

```json
{
  "format": "forge-observability/plan@1",
  "nom": "exemple-demo",
  "sondes": [
    { "nom": "cpu-service-x", "type": "commande", "cadence": "horaire",
      "commande": ["node", "chemin/vers/script.mjs", "arg"],
      "champ_valeur": "valeur", "seuils": { "max": 90 } },

    { "nom": "qualite-data-clients", "type": "oracle_externe", "cadence": "quotidienne",
      "commande": ["node", "<CHEMIN PARAMÉTRÉ, jamais codé en dur>", "assertions.json", "--json-only"] },

    { "nom": "mutants-forge-tests", "type": "rapport_json", "cadence": "par_commit",
      "fichier": "chemin/vers/rapport.json",
      "champs": ["resume.mutants_survivants", "resume.couverture_pct"],
      "seuils": { "resume.mutants_survivants": { "max_delta": 3 }, "resume.couverture_pct": { "min": 70 } } },

    { "nom": "citations-ia-marque", "type": "manuel", "cadence": "hebdomadaire",
      "fichier": "chemin/vers/consignation-manuelle.json", "champ_valeur": "mentions" }
  ]
}
```

- **`cadence`** est une annotation **documentaire** en v0 : `observer.mjs` exécute une
  fois, au déclenchement — aucun ordonnanceur interne. La récurrence réelle vient de qui
  invoque le script (le pilot, un cron externe, un hook de commit...).
- **`seuils`** : `{ "max": N }` (dépassement haut), `{ "min": N }` (dépassement bas),
  `{ "max_delta": N }` (régression au-delà d'un écart entre deux relevés) — combinables.
  Pour `rapport_json`, les seuils se déclarent par chemin de champ.
- Aucun défaut implicite : un plan au mauvais format, sans sonde, à type inconnu ou à noms
  dupliqués est **refusé** par `observer.mjs` (rien n'est appendu au ledger de snapshots).

## Les cinq types de sonde

| Type | Ce qu'il exécute | Ce qu'il capture |
|---|---|---|
| `commande` | une commande arbitraire qui rend un JSON sur stdout | une valeur scalaire (`champ_valeur`, chemin en pointillés) |
| `oracle_externe` | un oracle tiers à contrat JSON (`{verdict, findings,...}`) — chemin **paramétré** dans le plan, jamais codé en dur dans cette forge | le `verdict` et le compte de `findings` par sévérité |
| `rapport_json` | rien (lecture seule) — un fichier JSON déjà produit par ailleurs (ex. rapport forge-tests) | plusieurs valeurs, une par chemin déclaré dans `champs` |
| `manuel` | rien — lit une valeur qu'un **humain** a consignée dans un fichier JSON | une valeur scalaire, transportée fidèlement, jamais devinée |
| `job_planifie` | une commande (JSON sur stdout) **ou** la lecture d'un fichier d'état que le job écrit | le dernier passage, l'erreur, l'indicateur alimenté par le job et la population qu'il devrait couvrir |

### Un job planifié expose son passage (TF-2767)

Le fait : chez un produit, le job quotidien qui classe les brouillons n'avait enregistré aucune
issue pour 182 brouillons, dont 88 au-delà du délai, pendant 14 jours. Son échec ne s'écrivait
qu'au journal en base, et la page affichait un état vide neutre. Rien ne le disait.

La discipline : tout job planifié d'un produit expose, en JSON lisible par une commande ou dans
un fichier, son **dernier passage** (heure ISO 8601), son **erreur** (`null` si sain), l'**indicateur**
qu'il alimente et la **population** qui devrait en avoir un. Le plan déclare la sonde ; aucun
défaut implicite, y compris pour l'ancienneté maximale du passage :

```json
{ "nom": "classement-brouillons", "type": "job_planifie", "cadence": "quotidienne",
  "commande": ["curl", "-s", "<URL de l'état du job, paramétrée>"],
  "champs": { "dernier_passage": "job.dernier_passage", "erreur": "job.erreur",
              "indicateur": "stats.classes", "population": "stats.brouillons_hors_delai" },
  "max_age_heures": 36 }
```

`derive.mjs` juge l'état du dernier relevé (pas un écart avec le précédent) et rend un finding
**bloquant** dans quatre cas : `job-non-lisible` (le job n'expose pas un des quatre champs, ou ils
ont le mauvais type), `job-en-echec` (erreur non vide), `job-muet` (aucun passage, date illisible,
ou plus vieux que `max_age_heures`), `indicateur-vide` (indicateur à 0 ou `null` alors que la
population est supérieure à 0). Le choix de `population` appartient au plan : un chemin qui compte
les éléments déjà dus (« hors délai ») évite d'alerter sur ce qui n'a pas encore à être classé.

## Ledger de snapshots (contrat append-only)

```
<snapshots>.jsonl
{"seq":1,"ts":"2026-08-12T09:00:00.000Z","plan":"exemple-demo","sondes":[...]}
{"seq":2,"ts":"2026-08-12T10:00:00.000Z","plan":"exemple-demo","sondes":[...]}
```

`seq` strictement croissant depuis 1 (même contrat que `journal.jsonl` de forge-ops).
`derive.mjs` refuse (`donnees_insuffisantes`, exit 2) un ledger dont le `seq` régresse ou
saute, ou qui compte moins de deux entrées.

## Classes de dérive détectées par `derive.mjs`

| Classe | Déclenchement | Sévérité |
|---|---|---|
| Franchissement de seuil | valeur (ou delta) hors des `seuils` déclarés dans le plan | bloquant |
| Régression de verdict | sonde `oracle_externe` : `PASS` → autre chose | bloquant |
| Hausse de compteur | sonde `oracle_externe` : findings bloquant/majeur en hausse | majeur |
| Disparition | sonde présente au relevé précédent, absente du dernier | **bloquant** — une sonde qui cesse silencieusement de tourner est exactement l'angle mort que cette forge existe pour combler |
| Sonde cassée | sonde passée de `ok:true` à `ok:false` entre deux relevés | bloquant |
| Apparition | nouvelle sonde présente au dernier relevé, absente avant | info (non bloquant) ; une sonde `job_planifie` est de plus jugée dès son apparition |
| Job illisible, en échec, muet | sonde `job_planifie` : `job-non-lisible`, `job-en-echec`, `job-muet` (voir « Un job planifié expose son passage ») | bloquant |
| Indicateur vide | sonde `job_planifie` : indicateur à 0 ou `null` sur une population > 0 | bloquant |

`non_juge` déclaré par chaque script : cause de la dérive, correction (jamais automatique),
pertinence métier des seuils, exhaustivité des sondes déclarées, ordonnancement réel des
cadences (v0 sans scheduler).

## Volet veille citation IA — statut `déclaré`

Aucune fausse automatisation : interroger des IA génératives tierces en continu suppose
une API payante (hors périmètre, zéro API tierce payante) et un protocole d'échantillonnage
qu'une v0 ne peut pas garantir fiable. La méthode complète (requêtage daté, consignation
manuelle dans un format snapshot-compatible via la sonde `manuel`) est documentée dans
[`veille-ia/METHODE.md`](veille-ia/METHODE.md).

## Limites de la v0 (honnêtes, pas cachées)

- Aucun scheduler interne : la cadence déclarée dans un plan est documentaire, l'exécution
  réelle vient de qui invoque `observer.mjs`.
- Pas de notification/alerting (Slack, mail...) : le verdict `FAIL` de `derive.mjs` est le
  signal ; le relayer vers un canal humain est hors périmètre v0.
- `derive.mjs` exige deux relevés au moins, y compris pour une sonde `job_planifie` : un job
  vide dès le premier relevé n'est jugé qu'au deuxième. La sonde lit ce que le job déclare ;
  elle ne juge ni l'exactitude de son bilan ni la proportion d'éléments renseignés quand
  l'indicateur n'est pas vide.
- Comparaison sonde à sonde par **nom** : renommer une sonde entre deux révisions du plan
  se lit comme une disparition + une apparition, pas comme un renommage.
- La sonde `oracle_externe` fait confiance au contrat JSON de l'oracle exécuté ; un oracle
  tiers qui ne respecte pas `{verdict, findings}` produit une sonde en erreur, pas un
  verdict silencieusement faux.

## Structure

```
scripts/observer.mjs   # exécute les sondes d'un plan, APPEND un snapshot (ledger)
scripts/derive.mjs     # compare deux snapshots, rend les dérives (PASS/FAIL/donnees_insuffisantes)
oracles/self-test.mjs  # preuve par le geste — double sens, scénarios isolés
fixtures/              # sondes de fixture (commande-metrique.mjs, faux-oracle-data.mjs) + plan d'exemple
veille-ia/METHODE.md   # méthode déclarée, volet 4
```

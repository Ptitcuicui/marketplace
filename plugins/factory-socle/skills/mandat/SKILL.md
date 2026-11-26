---
name: mandat
description: Conduit un run de mandat transverse de la Factory, quand le livrable est un document ou un verdict et non un logiciel — analyse de mapping, audit de gouvernance, étude SEO, reconstruction de rapport. Socle du run et hooks installés avant la première écriture, mandat reformulé en une phrase au ledger, preuve cadrée avant de produire (quels oracles jugeront), production sous oracles, jugement borné, clôture avec page HTML autoportante. Use when / déclencher quand l'utilisateur confie une mission dont le résultat est un rapport, une analyse, un audit ou une recommandation, à mener selon la doctrine de la Factory. Ne pas déclencher pour construire ou faire évoluer un produit (→ run-complet, run-version), ni pour une simple question.
version: 1.0.0
---

# Mandat (livrable document ou verdict)

Enveloppe du **run de mandat** du pilot. Un mandat n'a ni conception à quatre verbes, ni design,
ni development, ni MEP ; il garde le socle du run. Le mode opératoire fait foi :
`<pilot>/references/RUN-MANDAT.md`.

## 1. Prérequis (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; P="$R/factory-pilot"
test -f "$P/references/RUN-MANDAT.md" && echo "pilot présent : $P" || echo "pilot absent"
```

Pilot absent : le dire, et proposer la phrase d'usage dans le dossier du projet
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Sans pilot, pas de mandat
selon la doctrine : on le dit au lieu de l'imiter.

## 2. La séquence

1. **Ouvrir** — socle du run, git local, **héritage installé et hooks câblés avant la première
   écriture** (`node "$P/scripts/recopier-heritage.mjs" .`), oracle de conformité PASS ; le
   mandat reformulé en une phrase au ledger : qui demande quoi, sur quel périmètre, avec quelle
   preuve attendue.
2. **Cadrer la preuve** — avant de produire : quels oracles jugeront le livrable (forge-data,
   forge-audit, `check_html.py` et `render_page.py` pour une page). Un mandat qui livre un
   mapping, un modèle ou une reconstruction livre aussi **sa recette exécutée**.
3. **Produire sous oracles** — éditions chirurgicales, chaque chiffre tracé à sa source ; les
   bases connectées se lisent en lecture seule, requêtes archivées.
4. **Juger** — tous les oracles cadrés exécutés, verdicts au ledger ; un FAIL se corrige ou se
   déclare, boucle bornée à 3 cycles, jamais d'assouplissement.
5. **Clore** — livrable nommé selon la règle de nommage dans `output/` ; toute proposition remise
   à un humain l'est **aussi** en page HTML autoportante (`factory-page-html`).

## 3. Invariants

- Projet existant : « qui est un existant » se mesure (premier commit antérieur au `run_open`),
  jamais ne se déclare.
- Aucune écriture hors du projet ; aucune publication sur un service hébergé sans GO humain.
- Question bloquante : suspendre, jamais inventer.

Détail : `$P/references/RUN-MANDAT.md`.

---
name: audit-seo-geo
description: "Conduit une étude SEO et GEO d'un site en ligne avec forge-seo-geo — grille de 89 nœuds, crawl (sitemap puis liens, rendu JS en option), données de terrain, agents IA dans les journaux, redirections, fiches d'analyse, actions scorées gain × confiance / effort, rapport client HTML vérifié. L'étude vit dans le dossier du projet hôte. Lancé uniquement sur commande explicite : un audit engage un livrable facturé. Use when / déclencher quand l'utilisateur tape la commande de ce skill pour ouvrir, poursuivre ou rendre une étude de visibilité (moteurs de recherche et moteurs génératifs). Ne pas déclencher sur une simple question de référencement, ni pour suivre la visibilité dans la durée (→ veille-derive)."
disable-model-invocation: true
version: 1.0.0
---

# Audit SEO et GEO (forge-seo-geo)

Enveloppe de **forge-seo-geo**. La forge porte la méthode (grille, barème, garde-fous) ; l'objet
audité est un **site en ligne**, et l'étude s'accumule dans le dossier du projet hôte
(`<projet>/seo/`).

## 1. Trouver la forge (jamais simuler)

Dans cet ordre : la forge du poste (`$FORGE_ROOT`, sinon `~/factory`), puis la copie livrée
avec la mallette `factory-marketing`.

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-seo-geo"
[ -f "$F/scripts/new_mission.py" ] || F="${CLAUDE_PLUGIN_ROOT}/forges/factory-forge-seo-geo"
test -f "$F/scripts/new_mission.py" && echo "forge présente : $F" || echo "forge absente"
```

Hors Claude Code, quand `${CLAUDE_PLUGIN_ROOT}` n'est pas remplacé, la copie livrée est dans
`../../forges/factory-forge-seo-geo` à partir du dossier de ce skill : la chercher là avant de
conclure à son absence. Le pipeline ne demande que Python ; seul `--rendu-js` (site SPA) demande
Playwright et Chromium, à installer sur accord.

Forge absente : le dire, proposer la phrase d'usage de la Factory
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`). Aucun constat inventé.

## 2. Dérouler l'étude (depuis le dossier hôte)

```bash
python "$F/scripts/new_mission.py" --projet . --client "<Client>" --domaine <domaine> --modele <modele>
# remplir seo/cadrage.md, déposer les exports dans seo/donnees/{gsc,ga,crm,logs}/
python "$F/scripts/crawler.py" --projet . --url https://<domaine>     # --rendu-js pour un site SPA
python "$F/scripts/agents_ia.py" --projet . [--logs seo/donnees/logs/access.log]
python "$F/scripts/oracle_redirections.py" --sonder https://<ancien-domaine>
# constater et interpréter dans seo/analyse/ (part humaine, voir seo/METHODE.md)
python "$F/scripts/livrables.py" --projet .
python "$F/scripts/scorer_actions.py" --projet . --contenu seo/actions.json
python "$F/scripts/rapport_html.py" --projet . --verifier
python "$F/scripts/validate.py" --mission .
```

## 3. Règles

- **Rien ne part tout seul** : chaque étape se lance sur demande ; le cadrage est validé par
  l'humain avant le crawl.
- Une mesure sans accès (journaux absents, clé CrUX absente) rend un verdict « non mesurable »
  écrit et daté, jamais un chiffre deviné.
- Le rapport client n'est remis que si `rapport_html.py --verifier` et `validate.py` passent.
- Aucune publication sur un service hébergé sans GO humain.

Détail du pipeline, des options et de la grille : `$F/README.md` et `seo/METHODE.md`.

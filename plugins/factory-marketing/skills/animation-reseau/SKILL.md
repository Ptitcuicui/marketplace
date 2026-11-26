---
name: animation-reseau
description: Tient l'animation de réseaux sociaux d'un émetteur (société de conseil, commerce de proximité) selon le run d'animation de réseau de la Factory — fiche émetteur et réseaux, objectifs à trois indicateurs, personas, ligne éditoriale et voix vérifiable, calendrier et lot de publications de la semaine, accord humain par lot, contrôle hebdomadaire, mesures et revue mensuelle. Aucune publication automatique : l'humain programme dans l'outil gratuit de la plateforme. Use when / déclencher quand l'utilisateur veut animer un compte LinkedIn ou un autre réseau dans la durée, préparer les publications de la semaine ou faire la revue mensuelle d'une présence en ligne. Ne pas déclencher pour rédiger un seul message isolé (→ factory-communication).
version: 1.0.0
---

# Animation de réseau

Enveloppe du **run d'animation de réseau** du pilot. Ce run est **récurrent** : il s'ouvre une
fois, tourne chaque semaine et ne vaut que par son rendez-vous. Le mode opératoire fait foi :
`<pilot>/references/RUN-RESEAU.md`.

## 1. Prérequis (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; P="$R/factory-pilot"
test -f "$P/references/RUN-RESEAU.md" && echo "pilot présent : $P" || echo "pilot absent"
```

Pilot absent : le dire, et proposer la phrase d'usage dans le dossier du projet
(`Utilise https://github.com/Ptitcuicui/factory pour ce projet`).

## 2. La séquence

0. **Ouvrir, une fois par émetteur** : `emetteur.json` (type d'émetteur, réseaux, un modèle de
   publication par réseau, gouvernance des comptes **par rôles, jamais d'identifiant ni de mot
   de passe**), puis les objectifs (un objectif, trois indicateurs au plus avec un seuil chacun),
   les personas (tirés d'entrants réels, sinon marqués hypothèse), la ligne éditoriale et
   `voix.json`, l'état de départ et le temps humain hebdomadaire actuel. **Gate humain** :
   validation de la fiche, des objectifs et des personas.
1. **Chaque semaine** : calendrier, publications rédigées avec `factory-communication`, contrôle
   de la semaine :
   ```bash
   node "$P/oracles/oracle-run-reseau.mjs" <dossier-semaine>
   ```
   puis **accord humain du lot**, qui nomme chaque publication. L'humain programme lui-même dans
   l'outil gratuit de la plateforme.
2. **Chaque mois** : mesures exportées, **revue mensuelle** humaine, qui décide de poursuivre ou
   de suspendre.

## 3. Invariants

- **Aucun script, robot ni extension de publication**, jamais : sur LinkedIn, le contrat de la
  plateforme l'interdit ; ailleurs, c'est la règle de la Factory.
- Jamais de persona, de chiffre ni de réponse inventés ; une question bloquante suspend.
- Le run ne se clôt pas sur un livrable : il se poursuit ou se suspend à chaque revue, par
  décision humaine consignée.

Détail : `$P/references/RUN-RESEAU.md`.

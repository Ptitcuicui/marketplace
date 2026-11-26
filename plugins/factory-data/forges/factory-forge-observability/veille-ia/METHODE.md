# Veille citation IA — statut v0 : **déclaré** (pas automatisé)

Volet 4 du mandat TF-0112. Contexte : le trafic de crawlers IA (ChatGPT, Perplexity,
Google AI Overviews...) croît fortement (+42,8 %/an, source Cloudflare Radar citée par le
mandat) — savoir si une marque est **citée** dans les réponses génératives est un signal
de visibilité distinct du SEO classique (GEO/AEO). Ce volet documente la méthode ; il ne
prétend pas l'automatiser. Prétendre le contraire serait une fausse affordance (loi
transverse du pilot : « toute affordance est câblée ou n'existe pas »).

## Pourquoi c'est déclaré, pas outillé, en v0

Interroger des IA génératives tierces à des fins de veille récurrente pose trois obstacles
qu'une v0 zéro-dépendance et zéro-API-payante ne peut pas lever proprement :

1. **Coût** : les API des principaux moteurs génératifs (hors modèles Claude via le
   harnais, seuls licites ici) sont payantes — hors périmètre de cette forge.
2. **Absence de contrat stable** : le rendu d'une réponse générative n'est pas un JSON
   stable et versionné (contrairement à un oracle ou un rapport de tests) — parser une
   réponse en langage naturel pour en extraire une « citation » de façon fiable est un
   problème à part entière (NLP), pas une sonde de quelques lignes.
3. **Non-reproductibilité** : deux requêtes identiques à un moment différent peuvent
   rendre des réponses différentes (température, personnalisation, mise à jour du modèle)
   — la valeur d'une automatisation serait trompeuse sans un protocole d'échantillonnage
   que cette v0 ne fournit pas.

Automatiser malgré cela produirait une sonde qui *a l'air* de mesurer quelque chose sans
mesurer quoi que ce soit de fiable — pire qu'une absence de sonde.

## Méthode recommandée (consignation manuelle)

1. **Requêtage daté** : formuler, à intervalle régulier (ex. hebdomadaire), un jeu de
   requêtes représentatives de l'intention client (« meilleurs cabinets de conseil IA en
   France », « qui fait du forge-tests automatisé », etc.) auprès des moteurs génératifs
   ciblés (interface humaine — chat web, jamais d'API tierce payante).
2. **Lecture humaine** : constater si la marque/le produit apparaît dans la réponse, sous
   quelle forme (citation directe, lien, mention indirecte) et à quel rang perçu.
3. **Consignation** dans un fichier JSON au format **snapshot-compatible** avec cette
   forge — afin que le même outillage (`derive.mjs`) serve à suivre l'évolution dans le
   temps, une fois les valeurs saisies par un humain :

   ```json
   {
     "mentions": 3,
     "date_releve": "2026-08-12",
     "requetes": ["meilleurs cabinets de conseil IA en France"],
     "moteurs": ["ChatGPT", "Perplexity"],
     "methode": "requêtage daté manuel + consignation humaine (v0 déclarée)"
   }
   ```

4. **Sonde `manuel`** : un plan d'observation référence ce fichier via une sonde
   `{"type": "manuel", "fichier": "...", "champ_valeur": "mentions"}` — `observer.mjs`
   transporte fidèlement la valeur consignée (aucune requête n'est faite par le code),
   et `derive.mjs` détecte la même façon toute chute ou hausse du compteur `mentions`
   entre deux relevés successifs si un seuil est déclaré dans le plan.

## Ce que la sonde `manuel` NE fait PAS (non_juge assumé)

- Elle n'interroge aucune IA générative.
- Elle ne vérifie pas la véracité de la valeur consignée par l'humain.
- Elle ne devine aucune cadence : le relevé suivant n'a lieu que si un humain le fait.

Passer ce volet à un statut **prouvé** exigerait un protocole d'échantillonnage validé et,
le cas échéant, un accès (payant, hors périmètre) à une API stable de mesure de citation.
C'est une amélioration future explicitement notée, pas une lacune cachée.

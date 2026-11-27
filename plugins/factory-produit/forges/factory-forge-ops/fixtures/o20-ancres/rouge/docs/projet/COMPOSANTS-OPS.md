---
role: composants déployés — fixture ROUGE O-20, ancres YAML (TF-2657), valeurs inventées
sources_de_verite: ["compose.yaml"]
verifie_le: 2026-11-16
authentification: aucune
---

# Composants Ops — produit d'exemple

## Composants à état

| Composant | Image | Données de travail | Volume | Commande de création |
|---|---|---|---|---|
| base | postgres:16 | /var/lib/postgresql/data | base-donnees | `docker compose up -d base` |
| cache | redis:7 | /data | cache-donnees | `docker compose up -d cache` |

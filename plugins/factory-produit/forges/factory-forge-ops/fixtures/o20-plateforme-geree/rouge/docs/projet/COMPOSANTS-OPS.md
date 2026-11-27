---
role: composants déployés — fixture ROUGE O-20, plateforme gérée (TF-2657), valeurs inventées
sources_de_verite: ["deploy/railway/deployer.py"]
verifie_le: 2026-11-16
authentification: aucune
---

# Composants Ops — produit d'exemple hébergé sur une plateforme gérée

## Composants à état

| Composant | Image | Données de travail | Volume | Commande de création |
|---|---|---|---|---|
| base-recette | postgres:16 | /var/lib/postgresql/data | volume Railway `base-volume` | `python deploy/railway/absent.py --client recette` |
| cache-local | redis:7 | /data | cache-donnees | `python scripts/creer-cache.py` |
| file-recette | mongo:7 | /data/db | volume Railway `file-volume` | à la main, dans la console de la plateforme |

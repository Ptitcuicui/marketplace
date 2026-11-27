---
role: composants déployés — fixture VERTE O-20, plateforme gérée (TF-2657), valeurs inventées
sources_de_verite: ["deploy/railway/deployer.py"]
verifie_le: 2026-11-16
authentification: aucune
---

# Composants Ops — produit d'exemple hébergé sur une plateforme gérée

## Composants à état

Les volumes de la recette sont créés par l'API de la plateforme, au travers d'un script du produit ou de la CLI de la plateforme.

| Composant | Image | Données de travail | Volume | Commande de création |
|---|---|---|---|---|
| base-recette | postgres:16 | /var/lib/postgresql/data | volume Railway `base-volume`, monté sur `/var/lib/postgresql/data` | `python deploy/railway/deployer.py --client recette` |
| cache-recette | redis:7 | /data | volume Railway `cache-volume`, monté sur `/data` | `railway volume add --mount-path /data` |

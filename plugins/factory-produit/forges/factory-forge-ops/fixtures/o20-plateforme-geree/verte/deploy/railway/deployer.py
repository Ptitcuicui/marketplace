# Fixture VERTE O-20 (TF-2657) : le script qui crée les volumes de la recette par l'API de la plateforme.
# Aucune commande Docker ici : la plateforme gérée crée le volume, la table le déclare.
def creer_volumes(client):
    return ["base-volume", "cache-volume"]

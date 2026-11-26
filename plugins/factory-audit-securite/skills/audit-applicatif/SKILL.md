---
name: audit-applicatif
description: Conduit un audit applicatif et de gouvernance avec AuditCore (forge-audit) — espace de travail d'audit par tenant, packs technologiques (Azure, Databricks, Power BI, Supabase, Cloudflare, GitHub…), fiche sécurité HTML et PDF jugée par sa porte bloquante, plan de remédiation transmis à forge-development. Lancé uniquement sur mandat explicite, jamais de lui-même. Use when / déclencher quand l'utilisateur tape la commande de ce skill pour ouvrir un audit, produire une fiche sécurité ou préparer une remédiation. Ne pas déclencher pour la sécurité du site livré (→ securite-web), des agents (→ securite-agentique), ni pour un audit de tests (→ audit-qualite-tests).
disable-model-invocation: true
version: 1.0.0
---

# Audit applicatif (AuditCore)

Enveloppe de la forge **forge-audit** (produit AuditCore). Le skill ne recode rien : il ouvre la
forge, joue ses outils et ses oracles, et rend leurs verdicts. La méthode complète est dans le
README de la forge, qui fait foi.

## 1. Trouver la forge (jamais simuler)

```bash
R="${FORGE_ROOT:-$HOME/factory}"; F="$R/factory-forge-audit"
test -f "$F/README.md" && echo "forge présente : $F" || echo "forge absente"
```

Forge absente : le dire tel quel, et proposer la phrase d'usage de la Factory dans le dossier du
projet (`Utilise https://github.com/Ptitcuicui/factory pour ce projet`), qui installe le parc.
Aucun verdict n'est inventé sans la forge.

## 2. Cadrer le mandat

Un audit engage un livrable facturé : il ne commence que sur demande explicite. Avant tout
outil, obtenir de l'humain :

- le **tenant** (client) et son overlay `config/tenants/<tenant>/` — `exemple` (ACME, fictif)
  sert de base d'onboarding, jamais de vrai client ;
- les **packs** concernés (dossier `profiles/` de la forge) ;
- le **dossier hôte** de l'étude, chez le projet (jamais dans la forge).

Le nom réel du client ne s'écrit que dans le dépôt de l'engagement, jamais dans la forge.

## 3. Dérouler

```bash
node "$F/tools/validate-config.mjs" "$F/config/tenants/<tenant>/tenant.yaml"
node "$F/tools/merge-packs.mjs"     "$F/config/tenants/<tenant>/tenant.yaml"
node "$F/tools/init-audit-workspace.mjs" <dossier-hote> --tenant <tenant>
# constats, puis la fiche sécurité : HTML ET PDF dans la même passe
node "$F/tools/build-fiche.mjs" "$F/config/tenants/<tenant>/tenant.yaml" --produit <racine-du-produit>
node "$F/oracles/verifier-fiche-securite.mjs" <fiche.html>
# remédiation : actions vers la forge development
node "$F/tools/forge-adapter.mjs" <actions.yaml> --out <repo-cible>
```

## 4. Règles

- **La fiche n'est diffusable que si `verifier-fiche-securite` sort en 0.** Un SKIP (navigateur
  absent, Node < 22) se rend comme tel, jamais comme un PASS.
- Le PDF est **imprimé** depuis le HTML, jamais capturé (`tools/fiche-en-pdf.mjs`).
- Aucune publication sur un service hébergé sans GO humain ; le livrable est un fichier chez le
  projet.
- Rendre les verdicts d'oracle tels qu'ils sortent : ce qui n'a pas été jugé est nommé.

Détail, options et limites : `$F/README.md` (sections « Démarrage » et suivantes).

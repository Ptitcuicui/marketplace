#!/usr/bin/env node
// self-test.mjs — preuve par le geste, double sens : rejoue des cycles observer→derive
// réels sur des scénarios isolés (un dossier tmp par scénario, comme forge-ops), puis
// prouve que chaque classe de dérive est détectée et que chaque défaut de plan est refusé.
// Exit 0 si tous les contrôles passent, 1 sinon. À rejouer après toute modification.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const observer = path.join(ici, "..", "scripts", "observer.mjs");
const derive = path.join(ici, "..", "scripts", "derive.mjs");
const fxScript = f => path.join(ici, "..", "fixtures", f);

let pass = 0, echec = 0;
const ok = (b, m) => { console.log(`  [${b ? "PASS" : "FAIL"}] ${m}`); b ? pass++ : echec++; };

const run = (script, args) => execFileSync(process.execPath, [script, ...args], { encoding: "utf8" });
function mustFail(script, args, motif) {
  try { execFileSync(process.execPath, [script, ...args], { encoding: "utf8", stdio: "pipe" }); }
  catch (e) {
    const sortie = String(e.stdout || e.stderr || "");
    return !motif || sortie.includes(motif) ? true : (console.log(`        motif « ${motif} » absent : ${sortie.slice(0, 200)}`), false);
  }
  return false;
}
function sortieJSON(script, args) {
  try { return JSON.parse(run(script, args)); }
  catch (e) { try { return JSON.parse(String(e.stdout)); } catch { return { verdict: "ILLISIBLE" }; } }
}

const base = fs.mkdtempSync(path.join(tmpdir(), "forge-observability-selftest-"));

console.log("SELF-TEST forge-observability — cycles observer→derive réels, isolés par scénario\n");

// ── construction d'un scénario : dossier tmp avec ses propres fichiers d'état,
// mutables sans effet sur les autres scénarios (même esprit que les « cible-* » isolées
// de forge-ops).
function creerScenario(nom, { avecCpu = true, avecOracle = true, avecRapport = true, avecManuel = true } = {}) {
  const dir = path.join(base, nom);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "cpu.json"), JSON.stringify({ valeur: 42 }), "utf8");
  fs.writeFileSync(path.join(dir, "oracle.json"), JSON.stringify({ verdict: "PASS" }), "utf8");
  fs.writeFileSync(path.join(dir, "rapport.json"), JSON.stringify({ resume: { mutants_survivants: 2, couverture_pct: 82 } }), "utf8");
  fs.writeFileSync(path.join(dir, "veille.json"), JSON.stringify({ mentions: 3 }), "utf8");

  const sondes = [];
  if (avecCpu) sondes.push({ nom: "cpu-service-x", type: "commande", cadence: "horaire",
    commande: ["node", fxScript("commande-metrique.mjs"), path.join(dir, "cpu.json")],
    champ_valeur: "valeur", seuils: { max: 90 } });
  if (avecOracle) sondes.push({ nom: "qualite-data", type: "oracle_externe", cadence: "quotidienne",
    commande: ["node", fxScript("faux-oracle-data.mjs"), path.join(dir, "oracle.json"), "--json-only"] });
  if (avecRapport) sondes.push({ nom: "mutants-tests", type: "rapport_json", cadence: "par_commit",
    fichier: path.join(dir, "rapport.json"), champs: ["resume.mutants_survivants", "resume.couverture_pct"],
    seuils: { "resume.mutants_survivants": { max_delta: 3 }, "resume.couverture_pct": { min: 70 } } });
  if (avecManuel) sondes.push({ nom: "citations-ia", type: "manuel", cadence: "hebdomadaire",
    fichier: path.join(dir, "veille.json"), champ_valeur: "mentions" });

  const plan = { format: "forge-observability/plan@1", nom, sondes };
  const planPath = path.join(dir, "plan.json");
  fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
  return { dir, planPath, snapPath: path.join(dir, "snapshots.jsonl") };
}
const snapshotsDe = f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));

// ── VERTE · cycle nominal : deux observations identiques → aucune dérive ───────────
const nominal = creerScenario("nominal");
const o1 = sortieJSON(observer, [nominal.planPath, nominal.snapPath, "--json-only"]);
ok(o1.verbe === "observer" && o1.verdict === "OK", "observer : première exécution, verdict OK");
const o2 = sortieJSON(observer, [nominal.planPath, nominal.snapPath, "--json-only"]);
ok(o2.verdict === "OK", "observer : seconde exécution (état inchangé), verdict OK");
ok(snapshotsDe(nominal.snapPath).length === 2, "deux snapshots appendus, append-only");
ok(snapshotsDe(nominal.snapPath).every((s, i) => s.seq === i + 1), "seq strictement croissant depuis 1");
const dNominal = sortieJSON(derive, [nominal.planPath, nominal.snapPath, "--json-only"]);
ok(dNominal.oracle === "derive" && dNominal.verdict === "PASS", "derive : aucune dérive entre deux observations identiques → PASS");

// ── ROUGE · volet data : régression de verdict PASS → FAIL (oracle_externe) ────────
console.log("");
const dataDerive = creerScenario("data-derive");
run(observer, [dataDerive.planPath, dataDerive.snapPath]);
fs.writeFileSync(path.join(dataDerive.dir, "oracle.json"), JSON.stringify({ verdict: "FAIL" }), "utf8");
run(observer, [dataDerive.planPath, dataDerive.snapPath]);
const dData = sortieJSON(derive, [dataDerive.planPath, dataDerive.snapPath, "--json-only"]);
ok(dData.verdict === "FAIL", "derive : oracle de données passé PASS → FAIL → FAIL");
ok(dData.findings.some(f => f.regle === "verdict" && f.sev === "bloquant"), "finding bloquant « verdict » localisant la sonde qualite-data");

// ── ROUGE · volet tests : régression d'un compteur au-delà du seuil du plan ────────
console.log("");
const testsDerive = creerScenario("tests-derive");
run(observer, [testsDerive.planPath, testsDerive.snapPath]);
fs.writeFileSync(path.join(testsDerive.dir, "rapport.json"), JSON.stringify({ resume: { mutants_survivants: 9, couverture_pct: 82 } }), "utf8");
run(observer, [testsDerive.planPath, testsDerive.snapPath]);
const dTests = sortieJSON(derive, [testsDerive.planPath, testsDerive.snapPath, "--json-only"]);
ok(dTests.verdict === "FAIL", "derive : mutants survivants 2 → 9 (delta 7 > max_delta 3) → FAIL");
ok(dTests.findings.some(f => f.regle === "seuil" && f.where.includes("mutants_survivants")), "finding « seuil » localise le champ mutants_survivants");

// ── VERTE · volet tests : régression sous le seuil → pas de dérive ─────────────────
const testsOk = creerScenario("tests-ok");
run(observer, [testsOk.planPath, testsOk.snapPath]);
fs.writeFileSync(path.join(testsOk.dir, "rapport.json"), JSON.stringify({ resume: { mutants_survivants: 4, couverture_pct: 75 } }), "utf8");
run(observer, [testsOk.planPath, testsOk.snapPath]);
const dTestsOk = sortieJSON(derive, [testsOk.planPath, testsOk.snapPath, "--json-only"]);
ok(dTestsOk.verdict === "PASS", "derive : mutants 2 → 4 (delta 2 ≤ max_delta 3), couverture 82 → 75 (≥ min 70) → PASS");

// ── ROUGE · sonde « commande » : franchissement de seuil ───────────────────────────
console.log("");
const cpuDerive = creerScenario("cpu-derive");
run(observer, [cpuDerive.planPath, cpuDerive.snapPath]);
fs.writeFileSync(path.join(cpuDerive.dir, "cpu.json"), JSON.stringify({ valeur: 95 }), "utf8");
run(observer, [cpuDerive.planPath, cpuDerive.snapPath]);
const dCpu = sortieJSON(derive, [cpuDerive.planPath, cpuDerive.snapPath, "--json-only"]);
ok(dCpu.verdict === "FAIL", "derive : cpu-service-x 42 → 95 (> max 90) → FAIL");
ok(dCpu.findings.some(f => f.regle === "seuil" && f.where === "cpu-service-x"), "finding « seuil » localise cpu-service-x");

// ── ROUGE · disparition d'une sonde entre deux révisions du plan ───────────────────
console.log("");
const dispar = creerScenario("disparition");
run(observer, [dispar.planPath, dispar.snapPath]); // seq 1 : 4 sondes
const planReduit = JSON.parse(fs.readFileSync(dispar.planPath, "utf8"));
planReduit.sondes = planReduit.sondes.filter(s => s.nom !== "cpu-service-x");
const planReduitPath = path.join(dispar.dir, "plan-reduit.json");
fs.writeFileSync(planReduitPath, JSON.stringify(planReduit), "utf8");
run(observer, [planReduitPath, dispar.snapPath]); // seq 2 : 3 sondes (cpu-service-x oubliée)
const dDispar = sortieJSON(derive, [dispar.planPath, dispar.snapPath, "--json-only"]);
ok(dDispar.verdict === "FAIL", "derive : sonde disparue entre deux révisions du plan → FAIL");
ok(dDispar.findings.some(f => f.regle === "cycle-de-vie" && f.sev === "bloquant" && f.msg.includes("disparue")),
  "finding bloquant « cycle-de-vie » signale la disparition (silence sinon indétectable)");

// ── VERTE · apparition d'une sonde : signalée mais non bloquante ───────────────────
const apparait = creerScenario("apparition");
const planReduit2 = JSON.parse(fs.readFileSync(apparait.planPath, "utf8"));
const sondeCpu = planReduit2.sondes.find(s => s.nom === "cpu-service-x");
planReduit2.sondes = planReduit2.sondes.filter(s => s.nom !== "cpu-service-x");
const planReduit2Path = path.join(apparait.dir, "plan-reduit.json");
fs.writeFileSync(planReduit2Path, JSON.stringify(planReduit2), "utf8");
run(observer, [planReduit2Path, apparait.snapPath]); // seq 1 : sans cpu-service-x
run(observer, [apparait.planPath, apparait.snapPath]); // seq 2 : avec cpu-service-x (nouvelle)
const dApparait = sortieJSON(derive, [apparait.planPath, apparait.snapPath, "--json-only"]);
ok(dApparait.verdict === "PASS", "derive : apparition d'une nouvelle sonde saine → PASS (info, non bloquant)");
ok(dApparait.findings.some(f => f.regle === "cycle-de-vie" && f.sev === "info" && f.msg.includes("apparue")),
  "finding info « cycle-de-vie » trace tout de même l'apparition");

// ── ROUGE · une sonde qui se met à échouer entre deux observations ─────────────────
console.log("");
const casse = creerScenario("execution-cassee");
run(observer, [casse.planPath, casse.snapPath]);
const planCasse = JSON.parse(fs.readFileSync(casse.planPath, "utf8"));
planCasse.sondes.find(s => s.nom === "cpu-service-x").commande[2] = path.join(casse.dir, "cpu-inexistant.json");
const planCassePath = path.join(casse.dir, "plan-casse.json");
fs.writeFileSync(planCassePath, JSON.stringify(planCasse), "utf8");
const oCasse = sortieJSON(observer, [planCassePath, casse.snapPath, "--json-only"]);
ok(oCasse.verdict === "PARTIEL", "observer : sonde en erreur d'exécution → verdict PARTIEL (le snapshot est quand même appendu)");
const dCasse = sortieJSON(derive, [casse.planPath, casse.snapPath, "--json-only"]);
ok(dCasse.verdict === "FAIL", "derive : sonde passée de ok:true à ok:false → FAIL");
ok(dCasse.findings.some(f => f.regle === "exécution" && f.sev === "bloquant"), "finding bloquant « exécution » signale la casse");

// ── ROUGE · sonde de type manuel : valeur transportée fidèlement, pas d'invention ──
console.log("");
const manuel = creerScenario("manuel-fidelite");
run(observer, [manuel.planPath, manuel.snapPath]);
const snap1 = snapshotsDe(manuel.snapPath)[0];
ok(snap1.sondes.find(s => s.nom === "citations-ia").valeur === 3, "sonde manuelle : valeur consignée (3) transportée sans altération");

// ── ROUGES · plan invalide refusé par observer.mjs (aucun n'appende de snapshot) ───
console.log("");
const plansInvalides = path.join(base, "plans-invalides");
fs.mkdirSync(plansInvalides, { recursive: true });
const snapJamais = path.join(plansInvalides, "jamais-ecrit.jsonl");

const pFormat = path.join(plansInvalides, "mauvais-format.json");
fs.writeFileSync(pFormat, JSON.stringify({ format: "autre-chose@1", sondes: [{ nom: "x", type: "commande", commande: ["node", "x.mjs"] }] }), "utf8");
ok(mustFail(observer, [pFormat, snapJamais], "format"), "plan à mauvais format → refus");
ok(!fs.existsSync(snapJamais), "aucun snapshot appendu sur plan refusé");

const pVide = path.join(plansInvalides, "sans-sondes.json");
fs.writeFileSync(pVide, JSON.stringify({ format: "forge-observability/plan@1", sondes: [] }), "utf8");
ok(mustFail(observer, [pVide, snapJamais], "sondes"), "plan sans sonde → refus");

const pTypeInconnu = path.join(plansInvalides, "type-inconnu.json");
fs.writeFileSync(pTypeInconnu, JSON.stringify({ format: "forge-observability/plan@1", sondes: [{ nom: "x", type: "magie" }] }), "utf8");
ok(mustFail(observer, [pTypeInconnu, snapJamais], "type"), "type de sonde hors du jeu connu → refus");

const pDupliquee = path.join(plansInvalides, "nom-duplique.json");
fs.writeFileSync(pDupliquee, JSON.stringify({ format: "forge-observability/plan@1", sondes: [
  { nom: "x", type: "manuel", fichier: path.join(base, "nominal", "veille.json"), champ_valeur: "mentions" },
  { nom: "x", type: "manuel", fichier: path.join(base, "nominal", "veille.json"), champ_valeur: "mentions" },
] }), "utf8");
ok(mustFail(observer, [pDupliquee, snapJamais], "dupliqué"), "noms de sonde dupliqués → refus");

// ── TF-2767 · sonde job_planifie : un indicateur vide et un job en échec ne restent pas muets ──
console.log("");
const ilYaHeures = h => new Date(Date.now() - h * 3600000).toISOString();
const etatJob = (surcharge = {}) => ({ job: { dernier_passage: ilYaHeures(2), erreur: null, bilan: "182 brouillons vus" },
  stats: { classes: 150, brouillons: 182 }, ...surcharge });
const champsJob = { dernier_passage: "job.dernier_passage", erreur: "job.erreur", indicateur: "stats.classes", population: "stats.brouillons" };
// scénario isolé : l'état du job vit dans etat-job.json ; `source` = « fichier » (lecture) ou « commande » (sonde exécutée)
function creerJob(nom, etat, { source = "fichier", maxAge = 36 } = {}) {
  const dir = path.join(base, nom);
  fs.mkdirSync(dir, { recursive: true });
  const etatPath = path.join(dir, "etat-job.json");
  fs.writeFileSync(etatPath, JSON.stringify(etat), "utf8");
  const sonde = { nom: "classement-brouillons", type: "job_planifie", cadence: "quotidienne", champs: champsJob, max_age_heures: maxAge,
    ...(source === "fichier" ? { fichier: etatPath } : { commande: ["node", fxScript("commande-metrique.mjs"), etatPath] }) };
  const planPath = path.join(dir, "plan.json");
  fs.writeFileSync(planPath, JSON.stringify({ format: "forge-observability/plan@1", nom, sondes: [sonde] }), "utf8");
  return { dir, etatPath, planPath, snapPath: path.join(dir, "snapshots.jsonl") };
}
function jugerJob(sc) {
  run(observer, [sc.planPath, sc.snapPath]);
  run(observer, [sc.planPath, sc.snapPath]);
  return sortieJSON(derive, [sc.planPath, sc.snapPath, "--json-only"]);
}

const jobSain = creerJob("job-sain", etatJob());
const dJobSain = jugerJob(jobSain);
ok(dJobSain.verdict === "PASS", "VERT · job passé il y a 2 h, sans erreur, 150 issues sur 182 brouillons → PASS");
const jobSainCmd = creerJob("job-sain-commande", etatJob(), { source: "commande" });
ok(jugerJob(jobSainCmd).verdict === "PASS", "VERT · même état lu par une commande (source « commande ») → PASS");
const jobPopVide = creerJob("job-population-vide", etatJob({ stats: { classes: 0, brouillons: 0 } }));
ok(jugerJob(jobPopVide).verdict === "PASS", "VERT · indicateur à 0 sur une population de 0 : rien à classer, pas d'alerte");

const jobVide = creerJob("job-indicateur-vide", etatJob({ stats: { classes: 0, brouillons: 182 } }));
const dJobVide = jugerJob(jobVide);
ok(dJobVide.verdict === "FAIL", "ROUGE · indicateur à 0 sur 182 brouillons (cas de TF-2767), job pourtant passé et sans erreur → FAIL");
ok(dJobVide.findings.some(f => f.regle === "indicateur-vide" && f.sev === "bloquant" && f.where === "classement-brouillons" && f.msg.includes("182")),
  "finding bloquant « indicateur-vide » localise la sonde et cite la population (182)");
const jobVideNull = creerJob("job-indicateur-null", etatJob({ stats: { classes: null, brouillons: 182 } }));
ok(jugerJob(jobVideNull).findings.some(f => f.regle === "indicateur-vide"), "ROUGE · indicateur null sur 182 brouillons → « indicateur-vide »");

const jobEchec = creerJob("job-en-echec", etatJob({ job: { dernier_passage: ilYaHeures(2), erreur: "délai dépassé à la connexion à la base" } }));
const dJobEchec = jugerJob(jobEchec);
ok(dJobEchec.verdict === "FAIL" && dJobEchec.findings.some(f => f.regle === "job-en-echec" && f.sev === "bloquant" && f.msg.includes("délai dépassé")),
  "ROUGE · erreur au dernier passage du job → FAIL, finding « job-en-echec » qui cite l'erreur");

const jobMuet = creerJob("job-muet", etatJob({ job: { dernier_passage: ilYaHeures(100), erreur: null } }));
ok(jugerJob(jobMuet).findings.some(f => f.regle === "job-muet" && f.sev === "bloquant" && f.msg.includes("max_age_heures 36")),
  "ROUGE · dernier passage il y a 100 h pour un maximum de 36 h → « job-muet »");
const jobJamais = creerJob("job-jamais-passe", etatJob({ job: { dernier_passage: null, erreur: null } }));
ok(jugerJob(jobJamais).findings.some(f => f.regle === "job-muet" && f.msg.includes("aucun passage")),
  "ROUGE · dernier_passage vide (le job n'a jamais tourné) → « job-muet »");

const jobOpaque = creerJob("job-n-expose-rien", { stats: { classes: 150, brouillons: 182 } });
const oOpaque = sortieJSON(observer, [jobOpaque.planPath, jobOpaque.snapPath, "--json-only"]);
ok(oOpaque.verdict === "PARTIEL", "ROUGE · un job qui n'expose ni passage ni erreur : observer rend PARTIEL");
sortieJSON(observer, [jobOpaque.planPath, jobOpaque.snapPath, "--json-only"]); // PARTIEL (exit 1) : le second relevé s'appende quand même
const dOpaque = sortieJSON(derive, [jobOpaque.planPath, jobOpaque.snapPath, "--json-only"]);
ok(dOpaque.verdict === "FAIL" && dOpaque.findings.some(f => f.regle === "job-non-lisible" && f.msg.includes("dernier_passage")),
  "ROUGE · même illisible aux deux relevés, derive FAIL « job-non-lisible » (le silence stable n'est pas absous)");

const jobNeuf = creerJob("job-sonde-apparue", etatJob({ stats: { classes: 0, brouillons: 182 } }));
const planSansJob = path.join(jobNeuf.dir, "plan-sans-job.json");
fs.writeFileSync(planSansJob, JSON.stringify({ format: "forge-observability/plan@1", nom: "job-sonde-apparue", sondes: [
  { nom: "citations-ia", type: "manuel", fichier: path.join(base, "nominal", "veille.json"), champ_valeur: "mentions" }] }), "utf8");
run(observer, [planSansJob, jobNeuf.snapPath]);
run(observer, [jobNeuf.planPath, jobNeuf.snapPath]);
ok(sortieJSON(derive, [jobNeuf.planPath, jobNeuf.snapPath, "--json-only"]).findings.some(f => f.regle === "indicateur-vide"),
  "ROUGE · sonde job_planifie apparue sur un indicateur déjà vide : jugée dès l'apparition, pas au relevé suivant");

// le remède recommandé par les messages (le job corrige son indicateur et passe) doit ramener au vert
fs.writeFileSync(jobVide.etatPath, JSON.stringify(etatJob()), "utf8");
run(observer, [jobVide.planPath, jobVide.snapPath]);
ok(sortieJSON(derive, [jobVide.planPath, jobVide.snapPath, "--json-only"]).verdict === "PASS",
  "VERT · après correction (indicateur 150 sur 182, passage récent), la sonde repasse au vert");

const planJobInvalide = (nom, modif) => {
  const p = JSON.parse(fs.readFileSync(jobSain.planPath, "utf8"));
  modif(p.sondes[0]);
  const f = path.join(plansInvalides, nom);
  fs.writeFileSync(f, JSON.stringify(p), "utf8");
  return f;
};
ok(mustFail(observer, [planJobInvalide("job-sans-delai.json", s => { delete s.max_age_heures; }), snapJamais], "max_age_heures"),
  "ROUGE · plan job_planifie sans max_age_heures (aucun délai par défaut) → refus");
ok(mustFail(observer, [planJobInvalide("job-sans-erreur.json", s => { delete s.champs.erreur; }), snapJamais], "erreur"),
  "ROUGE · plan job_planifie sans chemin d'erreur déclaré → refus");
ok(mustFail(observer, [planJobInvalide("job-deux-sources.json", s => { s.commande = ["node", "x.mjs"]; }), snapJamais], "un seul des deux"),
  "ROUGE · plan job_planifie avec commande ET fichier → refus");
ok(!fs.existsSync(snapJamais), "aucun snapshot appendu sur un plan job_planifie refusé");

// ── ROUGES · intégrité du ledger de snapshots (contrat append-only) ────────────────
console.log("");
const ledgerCasse = path.join(base, "ledger-casse.jsonl");
fs.writeFileSync(ledgerCasse, JSON.stringify({ seq: 1, ts: "2026-01-01T00:00:00Z", plan: "x", sondes: [] }) + "\n"
  + JSON.stringify({ seq: 3, ts: "2026-01-01T00:00:01Z", plan: "x", sondes: [] }) + "\n", "utf8");
const dLedger = sortieJSON(derive, [nominal.planPath, ledgerCasse, "--json-only"]);
ok(dLedger.verdict === "donnees_insuffisantes", "derive : seq non strictement croissant (1 → 3) → donnees_insuffisantes");
ok(dLedger.findings.some(f => f.regle === "ledger"), "finding « ledger » signale la rupture append-only");

const ledgerUnique = path.join(base, "ledger-un-seul.jsonl");
fs.writeFileSync(ledgerUnique, JSON.stringify({ seq: 1, ts: "2026-01-01T00:00:00Z", plan: "x", sondes: [] }) + "\n", "utf8");
const dUnique = sortieJSON(derive, [nominal.planPath, ledgerUnique, "--json-only"]);
ok(dUnique.verdict === "donnees_insuffisantes", "derive : un seul snapshot disponible → donnees_insuffisantes (pas de dérive forcée)");

ok(mustFail(derive, [nominal.planPath, path.join(base, "n-existe-pas.jsonl"), "--json-only"]), "derive : fichier de snapshots introuvable → refus");
ok(mustFail(observer, [path.join(base, "n-existe-pas.json"), path.join(base, "x.jsonl")]), "observer : plan introuvable → refus");

fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log(`\nSelf-test forge-observability : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);

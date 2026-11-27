/**
 * lib-sante.mjs — lire la fin d'un contrat de santé (`sante.mjs`) : sain, en échec, ou PLANTÉ (TF-2699).
 *
 * LE DÉFAUT. Un `sante.mjs` qui appelle `process.exit()` juste après un `fetch` peut faire tomber node
 * lui-même sous Windows : « Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c,
 * line 76 », exit 3221226505 (0xC0000409), alors que le même contrat, lancé seul, rend exit 0. `ops.mjs`
 * lisait ce code comme « healthcheck exit 3221226505 », donc comme une santé en échec : une release saine
 * refusée, un diagnostic et un redéploiement (le 15/11/2026, run forge-site-20261114a).
 *
 * CE QUE FAIT CE FICHIER. Il sépare le plantage de l'outil (code d'exception Windows, signal d'effondrement,
 * assertion de libuv sur la sortie d'erreur) du refus que le contrat prononce lui-même (exit non nul
 * ordinaire). Les deux restent refusés : un contrat qui n'a pas pu s'exprimer ne prouve pas la santé, et
 * « jamais de bascule sur release malade » ne se desserre pas. Ce qui change, c'est le message : il dit
 * que la release n'est PAS jugée malade et nomme le remède.
 *
 * Fonction pure sur le résultat de `spawnSync` : aucune exécution, testable par des résultats fabriqués.
 */

// NTSTATUS : un code de fin >= 0xC0000000 est une exception du système (0xC0000409 = STATUS_STACK_BUFFER_OVERRUN,
// le code de l'abandon de libuv sous Windows ; 0xC0000005 = violation d'accès).
const SEUIL_EXCEPTION_WINDOWS = 0xC0000000;
const SIGNAUX_D_EFFONDREMENT = ["SIGABRT", "SIGSEGV", "SIGBUS", "SIGILL", "SIGFPE"];
// Sortie d'erreur d'une assertion C (libuv, V8, node) : « Assertion failed: <condition>, file <f>, line <n> ».
const MOTIF_ASSERTION = /Assertion failed:[^\n]*\bfile\b[^\n]*\bline \d+/i;

export const REMEDE_PLANTAGE = "dans sante.mjs, poser process.exitCode puis laisser la boucle d'événements se vider ; "
  + "jamais process.exit() juste après une requête (fetch)";

/** @param {{status:number|null, signal?:string|null, stderr?:string|null, error?:Error}} r résultat de spawnSync */
export function jugerSante(r) {
  if (r.status === 0) return { ok: true };
  const stderr = String(r.stderr || "");
  const code = typeof r.status === "number" ? r.status >>> 0 : null;
  const exception = code !== null && code >= SEUIL_EXCEPTION_WINDOWS;
  const signal = SIGNAUX_D_EFFONDREMENT.includes(r.signal) ? r.signal : null;
  const assertion = (stderr.match(MOTIF_ASSERTION) || [])[0] || null;
  if (exception || signal || assertion) {
    const trace = [
      exception ? `exit ${code} = 0x${code.toString(16).toUpperCase()}` : null,
      signal ? `signal ${signal}` : null,
      assertion ? `« ${assertion.trim().slice(0, 120)} »` : null,
    ].filter(Boolean).join(", ");
    return {
      ok: false, plantage: true,
      raison: `contrat de santé PLANTÉ (${trace}) — le processus de sante.mjs s'est effondré, ce n'est PAS une santé `
        + `en échec : la release n'est pas jugée malade, sa santé n'est pas prouvée. Remède : ${REMEDE_PLANTAGE}`,
    };
  }
  return { ok: false, plantage: false, raison: `healthcheck exit ${r.status}${stderr ? " — " + stderr.trim().slice(0, 120) : ""}` };
}

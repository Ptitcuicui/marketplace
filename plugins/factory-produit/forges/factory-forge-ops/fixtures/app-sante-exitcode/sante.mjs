// Fixture verte TF-2699 : le remède que le message de plantage prescrit. Le contrat fait une vraie requête (vers un
// serveur local qu'il ouvre lui-même), pose process.exitCode et laisse la boucle d'événements se vider : jamais
// process.exit() juste après le fetch.
import http from "node:http";
import fs from "node:fs";
const html = fs.existsSync("index.html") ? fs.readFileSync("index.html", "utf8") : "";
const srv = http.createServer((q, s) => s.end(html));
await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
const r = await fetch(`http://127.0.0.1:${srv.address().port}/sante`);
const corps = await r.text();
srv.close();
process.exitCode = r.ok && corps.includes('data-sante="ok"') ? 0 : 1;

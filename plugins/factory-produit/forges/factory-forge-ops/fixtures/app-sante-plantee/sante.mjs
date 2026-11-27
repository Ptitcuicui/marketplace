// Fixture rouge TF-2699 : une release SAINE (index.html intact) dont le contrat de santé PLANTE au lieu de répondre.
// Reproduit ce que voit ops.mjs quand un sante.mjs appelle process.exit() juste après un fetch sous Windows :
// l'assertion de libuv sur la sortie d'erreur et le code d'exception 3221226505 (0xC0000409), alors que le même
// contrat lancé seul rend exit 0. Le plantage réel dépend de la version de node : il est simulé, pas provoqué.
console.error("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\win\\async.c, line 76");
process.exit(3221226505);

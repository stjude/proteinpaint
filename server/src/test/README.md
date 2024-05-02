To run all unit tests on your local:

~/dev/sjpp/proteinpaint/server % npm run test:unit

Requires "server/test/serverconfig.json" to be copied to "server/"
The "test:unit" command is defined in "server/package.json"


To run one script:

~/dev/sjpp/proteinpaint/server % npx tsx src/test/termdb.filter.unit.spec.js

(running in different dir doesn't work)

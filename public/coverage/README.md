# Coverage Reports

This public/coverage directory will hold generated reports, html, json
and other static artifacts from test coverage runs.

To generate reports:
- from pp dir, `npm run client:coverage`: will generate combined unit and integration
test of client code
- from pp dir, `npm run combined:coverage`: will generate combined unit and integration
test of client and server code
- you may edit `client:coverage` patternslist option in pp/package.json scripts to 
narrow down the tests to run, for example `"client:coverage": "cd client && ./test.sh *.spec.* dir=filter*"`


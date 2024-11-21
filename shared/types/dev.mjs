import { execSync } from 'child_process'

// - in dev: tsx will be used to run server code and automatically
// 					 transpile imported dist/*.ts files
//           (no need to generate dist/*.js files, but copy over checkers/index.js to dist/);
//
// - in prod build: esbuild will be required to generate static dist/*.js files
//

console.log(execSync(`npx typia generate --input ./checkers --output ./dist`).toString())
// typia does not emit js files, must manually copy index.js
// which is referenced as package.json:exports."./checkers" subpath alias
console.log(execSync(`cp ./checkers/index.js ./dist`).toString())

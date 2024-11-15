import { execSync } from 'child_process'

// - in dev: tsx will be used to run server code and automatically
// 					 transpile imported dist/*.ts files;
//
// - in prod build: esbuild will be required to generate static dist/*.js files
//
execSync(`npx typia generate --input ./checkers --output ./dist`)

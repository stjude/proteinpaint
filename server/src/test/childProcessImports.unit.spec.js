import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/*
Specs for which runtime files import child_process.

The goal is a server process that does not start child processes, so the list below of files that
import child_process must only shrink. A file that is no longer on the list must not import it again.

Scanned:
- server/src, except the test dirs and the bundled app.js
- server/routes, server/genome, server/dataset
- the R, python and rust wrapper modules, which the server imports to run scripts and binaries

A .js file next to a .ts file of the same name is generated from it, and is not scanned.

test sections:
- child_process imports
*/

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const scanDirs = ['server/src', 'server/routes', 'server/genome', 'server/dataset']
const scanFiles = ['R/index.js', 'python/index.js', 'rust/index.js']

// files that still import child_process, with what each one starts
const allowed = new Map([
	['R/index.js', 'Rscript for run_R()'],
	['python/index.js', 'python for run_python()'],
	['rust/index.js', 'rust binaries for run_rust()'],
	['server/genome/copyDataFilesFromRepo2Tp.js', 'test genome data setup'],
	['server/src/tools/index.ts', 'the tools of the specs in server/src/tools, see runTool()'],
	['server/src/utils.js', 'bcftools reads, see spawnTool() and get_lines_bigfile()']
])

tape('child_process imports', test => {
	const found = getImportingFiles()
	test.deepEqual(
		found.filter(f => !allowed.has(f)),
		[],
		'no other file should import child_process'
	)
	test.deepEqual(
		[...allowed.keys()].filter(f => !found.includes(f)),
		[],
		'each listed file should still import child_process, otherwise remove it from the list'
	)
	test.end()
})

function getImportingFiles() {
	const files = [...scanFiles]
	for (const dir of scanDirs) walk(path.join(repoDir, dir), files)
	return files.filter(importsChildProcess).sort()
}

function walk(dir, files) {
	for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
		const f = path.join(dir, d.name)
		if (d.isDirectory()) {
			if (d.name != 'test' && d.name != 'node_modules') walk(f, files)
			continue
		}
		if (!/\.(js|ts|mjs|cjs)$/.test(d.name)) continue
		const rel = path.relative(repoDir, f)
		if (rel == 'server/src/app.js') continue // the bundled server
		if (d.name.endsWith('.js') && fs.existsSync(f.replace(/\.js$/, '.ts'))) continue // generated from the .ts file
		files.push(rel)
	}
}

function importsChildProcess(rel) {
	const code = fs.readFileSync(path.join(repoDir, rel), 'utf8').replace(/^\s*\/\/.*$/gm, '') // skip commented-out code
	return /\b(from|require\s*\(|import\s*\()\s*['"](node:)?child_process['"]/.test(code)
}

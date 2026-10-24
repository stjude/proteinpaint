import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

/* run_rust() runs a wasm module in the node process when the permission model does not allow a child process.
The checks run in a node process with that permission model, see runChecks() below. The modules are built with the
command in wasm/Cargo.toml, and these tests are skipped without them. */

const rustDir = path.join(import.meta.dirname, '..')
const wasmDir = path.join(rustDir, 'target/wasm/wasm32-wasip1/release')
const hasModules = ['fisher', 'wilcoxon'].every(n => fs.existsSync(path.join(wasmDir, n + '.wasm')))

// runs the checks code in a node process without the child process permission; returns its exit status and output
function runChecks(checks, permissionFlags = ['--allow-wasi']) {
	const tmpdir = fs.realpathSync(os.tmpdir())
	const code = `
		import assert from 'node:assert/strict'
		import { Readable } from 'node:stream'
		import { run_rust } from ${JSON.stringify(path.join(rustDir, 'index.js'))}
		${checks}
		console.log('checks passed')`
	// no write path, since a module's stdin, stdout and stderr are in memory
	const args = ['--permission', `--allow-fs-read=${rustDir}`, `--allow-fs-read=${tmpdir}`]
	return spawnSync(process.execPath, [...args, ...permissionFlags, '--input-type=module', '-e', code], {
		encoding: 'utf8',
		env: { ...process.env, TMPDIR: tmpdir }
	})
}

tape(
	'run_rust runs a wasm module in the node process when a child process is not allowed',
	{ skip: !hasModules },
	test => {
		const result = runChecks(`
		const input = [
			{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895 },
			{ index: 1, n1: 1047, n2: 1351, n3: 1083, n4: 1572 }
		]
		const out = JSON.parse(await run_rust('fisher', JSON.stringify({ input })))
		assert.deepEqual(out.map(r => r.p_value), [0.12552895565046274, 0.04001628331711651])
		// a stream input
		assert.deepEqual(JSON.parse(await run_rust('fisher', Readable.from([JSON.stringify({ input })]))), out)
		const w = JSON.parse(await run_rust('wilcoxon', JSON.stringify([{
			group1_id: 'a', group1_values: [-1.1621, 0.2767, -1.5272, -0.4731, -0.5174, 2.0375, -0.1718, 1.4165, 0.7075, 0.7725],
			group2_id: 'b', group2_values: [0.3328, 0.1301, 0.4578, 0.3028, 0.7232, 0.7841, 0.6581, 0.0636, 0.0791, 0.8617]
		}])))
		// the R wilcox.test() p-value, see wilcoxonTest.unit.spec.js
		assert.equal(Math.round(w[0].pvalue * 1000) / 1000, 0.393)
		// a panic rejects with the panic message, and the process keeps running
		await assert.rejects(run_rust('fisher', '{"input":[{"index":0,"n1":"x"}]}'), /non-zero status[^]*panicked/)
		await assert.rejects(run_rust('DEanalysis', '{}'), /^this server build does not support this data computation request$/)
		await assert.rejects(run_rust('../fisher', '{}'), /invalid rust binary name/)
		// an abort stops a stream input that does not end, and destroys it
		const stalled = new Readable({ read() {} })
		stalled.push('{"input":')
		const controller = new AbortController()
		setTimeout(() => controller.abort(), 50)
		await assert.rejects(run_rust('fisher', stalled, [], { signal: controller.signal }), /run_rust\\('fisher'\\): aborted$/)
		assert.ok(stalled.destroyed, 'the stalled input is destroyed')`)
		test.equal(result.status, 0, result.stderr)
		test.ok(result.stdout.includes('checks passed'), 'the checks ran')
		test.end()
	}
)

tape(
	'a module that does not compile rejects before a stream input is read, and is compiled again by a later call',
	{ skip: !hasModules },
	test => {
		// a module name that no binary has, which the checks replace with a module that compiles
		const name = 'pp_test_invalid_module'
		const modpath = path.join(wasmDir, name + '.wasm')
		fs.writeFileSync(modpath, 'not a wasm module')
		try {
			const result = runChecks(
				`
			const stalled = new Readable({ read() {} })
			stalled.push('{"input":')
			await assert.rejects(run_rust('${name}', stalled), WebAssembly.CompileError)
			assert.equal(stalled.readableDidRead, false, 'the stream input is not read')
			const fs = await import('node:fs')
			fs.copyFileSync(${JSON.stringify(path.join(wasmDir, 'fisher.wasm'))}, ${JSON.stringify(modpath)})
			const input = [{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895 }]
			const out = JSON.parse(await run_rust('${name}', JSON.stringify({ input })))
			assert.deepEqual(out.map(r => r.p_value), [0.12552895565046274])`,
				['--allow-wasi', `--allow-fs-write=${wasmDir}`]
			)
			test.equal(result.status, 0, result.stderr)
			test.ok(result.stdout.includes('checks passed'), 'the checks ran')
		} finally {
			fs.rmSync(modpath, { force: true })
		}
		test.end()
	}
)

tape('a wasm module requires the --allow-wasi permission', { skip: !hasModules }, test => {
	const result = runChecks(
		`await assert.rejects(run_rust('fisher', '{"input":[]}'), { code: 'ERR_ACCESS_DENIED' })`,
		[]
	)
	test.equal(result.status, 0, result.stderr)
	test.end()
})

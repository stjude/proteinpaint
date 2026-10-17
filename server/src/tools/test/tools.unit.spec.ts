import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { runTool, getArgv, checkSpec, specs } from '#src/tools/index.ts'
import type { ToolSpec } from '#src/tools/index.ts'

/*
test sections:

hicstraw.query: argv of valid inputs
hicstraw.query: rejected inputs
runTool(): does not start the tool for a rejected input
runTool(): passes the argv of a valid input
checkSpec(): rejects malformed specs
specs are frozen
*/

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-tools-'))
const tp = path.resolve(serverconfig.tpmasterdir)
const op = 'hicstraw.query'
const spec = specs[op]

function valid(): Record<string, unknown> {
	return {
		matrixType: 'observed',
		normalization: 'NONE',
		file: path.join(tp, 'files/hg19/hic/a.hic'),
		pos1: 'chr1:0:1000000',
		pos2: 'chr2',
		unit: 'BP',
		resolution: 100000
	}
}

/** runs fn with serverconfig.features.ALLOW_remotefilefromurl set to allow, then restores it */
function withRemoteFile(allow: boolean, fn: () => void) {
	const prev = serverconfig.features.ALLOW_remotefilefromurl
	serverconfig.features.ALLOW_remotefilefromurl = allow
	try {
		fn()
	} finally {
		if (prev === undefined) delete serverconfig.features.ALLOW_remotefilefromurl
		else serverconfig.features.ALLOW_remotefilefromurl = prev
	}
}

/** each field with values that must be rejected, which include ones that would pass a looser check */
const badValues: Record<string, unknown[]> = {
	matrixType: ['norm', '-o', ' observed', 'observed\n', ['observed'], 1, null],
	normalization: ['kr', '-o', 'NONE;ls', 'NONE ', 'A'.repeat(33), '', 5, ['NONE']],
	file: [
		'',
		'-o',
		'../x.hic',
		'a/../../x.hic',
		'a\\..\\..\\x.hic',
		'/etc/passwd',
		path.dirname(tp) + '/x.hic',
		tp, // the root itself is not a file under it
		'a/x.hic\0',
		'file:///etc/passwd',
		'ftp://a.org/x.hic',
		['a.hic'],
		{ toString: () => 'a.hic' }
	],
	pos1: [
		'-o',
		'-chr1',
		'chr1:1',
		'chr1:1:2:3',
		'chr1:a:b',
		'chr1:-1:2',
		'chr1 :1:2',
		'chr1:1:2\n',
		'chr1:1:2;ls',
		'c'.repeat(101),
		'chr1:' + '1'.repeat(13) + ':2',
		'',
		5,
		['chr1']
	],
	unit: ['bp', 'FRAG ', '-o', true],
	resolution: ['5000', '1e5', 0, -1, 1.5, NaN, Infinity, 100_000_001, 2 ** 60, [5000], null]
}

tape('\n', test => {
	test.comment('-***- tools specs -***-')
	test.end()
})

tape('hicstraw.query: argv of valid inputs', test => {
	test.deepEqual(
		getArgv(op, spec, valid()),
		['observed', 'NONE', path.join(tp, 'files/hg19/hic/a.hic'), 'chr1:0:1000000', 'chr2', 'BP', '100000'],
		'should put each field value in its argv slot'
	)
	test.equal(
		getArgv(op, spec, { ...valid(), file: 'files/hg19/hic/a.hic' })[2],
		path.join(tp, 'files/hg19/hic/a.hic'),
		'should resolve a relative file path under tpmasterdir'
	)
	test.equal(
		getArgv(op, spec, { ...valid(), pos1: 'chr1:12.5:2000.25', unit: 'FRAG', resolution: 1 })[3],
		'chr1:12.5:2000.25',
		'should accept fractional coordinates'
	)
	withRemoteFile(true, () => {
		test.equal(
			getArgv(op, spec, { ...valid(), file: 'https://a.org/x.hic' })[2],
			'https://a.org/x.hic',
			'should accept an https url when remote files are allowed'
		)
	})
	test.end()
})

tape('hicstraw.query: rejected inputs', test => {
	const inputs: [string, unknown][] = [
		['undefined', undefined],
		['null', null],
		['a string', 'x'],
		['an array', []],
		['an object with no prototype', Object.create(null)],
		['a class instance', new (class A {})()]
	]
	for (const [label, input] of inputs)
		test.throws(() => getArgv(op, spec, input as any), /input must be a plain object/, `should reject ${label}`)
	for (const name of Object.keys(spec.fields)) {
		const input = valid()
		delete input[name]
		test.throws(
			() => getArgv(op, spec, input),
			new RegExp(`missing input field ${name}`),
			`should reject a missing ${name}`
		)
	}
	test.throws(
		() => getArgv(op, spec, { ...valid(), extra: 'x' }),
		/unexpected input field extra/,
		'should reject an extra field'
	)
	for (const [name, values] of Object.entries(badValues)) {
		for (const v of values) {
			test.throws(
				() => getArgv(op, spec, { ...valid(), [name]: v }),
				new RegExp(`invalid ${name}`),
				`should reject ${name}=${JSON.stringify(v)}`
			)
		}
	}
	withRemoteFile(false, () => {
		test.throws(
			() => getArgv(op, spec, { ...valid(), file: 'https://a.org/x.hic' }),
			/invalid file/,
			'should reject a url when remote files are not allowed'
		)
	})
	withRemoteFile(true, () => {
		for (const file of [
			'http://127.0.0.1/x.hic',
			'http://localhost/x.hic',
			'http://169.254.169.254/x',
			'https://a.org\\@127.0.0.1/x'
		])
			test.throws(() => getArgv(op, spec, { ...valid(), file }), /invalid file/, `should reject the url ${file}`)
	})
	test.throws(() => runTool('hicstraw.other', valid()), /unknown tool operation/, 'should reject an unknown operation')
	test.throws(() => runTool('toString', valid()), /unknown tool operation/, 'should reject an inherited property name')
	test.end()
})

tape('runTool(): does not start the tool for a rejected input', async test => {
	const marker = path.join(tmpdir, 'started')
	const bin = path.join(tmpdir, 'mark.sh')
	fs.writeFileSync(bin, `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 })
	const prev = serverconfig.hicstraw
	serverconfig.hicstraw = bin
	try {
		let count = 0
		const started: Promise<unknown>[] = []
		for (const [name, values] of Object.entries(badValues)) {
			for (const v of values) {
				try {
					const ps = runTool(op, { ...valid(), [name]: v })
					started.push(new Promise(r => ps.on('close', r)))
				} catch (_) {
					count++
				}
			}
		}
		const total = Object.values(badValues).flat().length
		test.equal(count, total, 'should throw for each rejected value')
		await Promise.all(started) // so that a started tool has created the marker before it is checked
		test.notOk(fs.existsSync(marker), 'should not start the tool')
		// the marker must be created by a valid input, or the check above would pass without detecting anything
		const ps = runTool(op, valid())
		await new Promise(r => ps.on('close', r))
		test.ok(fs.existsSync(marker), 'should start the tool for a valid input')
	} finally {
		serverconfig.hicstraw = prev
	}
	test.end()
})

tape('runTool(): passes the argv of a valid input', async test => {
	// a stand-in for straw that prints each argument on its own line
	const bin = path.join(tmpdir, 'echo.sh')
	fs.writeFileSync(bin, `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done\n`, { mode: 0o755 })
	const prev = serverconfig.hicstraw
	serverconfig.hicstraw = bin
	try {
		const ps = runTool(op, valid())
		const out: string[] = []
		ps.stdout.on('data', d => out.push(String(d)))
		const code = await new Promise(r => ps.on('close', r))
		test.equal(code, 0, 'should exit with 0')
		test.deepEqual(out.join('').trimEnd().split('\n'), getArgv(op, spec, valid()), 'should pass the argv unchanged')
	} finally {
		serverconfig.hicstraw = prev
	}
	test.end()
})

tape('checkSpec(): rejects malformed specs', test => {
	const base = (): ToolSpec => ({
		bin: () => 'x',
		fields: { a: { type: 'string', pattern: /^a$/, maxLength: 1 } },
		argv: ['-x', '$a']
	})
	test.doesNotThrow(() => checkSpec('t', base()), 'should accept a well-formed spec')
	const cases: [string, (s: any) => void, RegExp][] = [
		['an unanchored pattern', s => (s.fields.a.pattern = /a/), /must be anchored/],
		['a pattern with the g flag', s => (s.fields.a.pattern = /^a$/g), /must not have the g or y flag/],
		['a field that is not in argv', s => (s.argv = ['-x']), /is not used in argv/],
		['an argv item that is not a field', s => s.argv.push('$b'), /is not a field/],
		['a field that is used twice', s => s.argv.push('$a'), /more than once/],
		['an empty argv item', s => s.argv.push(''), /non-empty string/],
		['a maxLength over the limit', s => (s.fields.a.maxLength = 5000), /maxLength/],
		['an int with min > max', s => (s.fields.a = { type: 'int', min: 2, max: 1 }), /min <= max/],
		['an enum value starting with -', s => (s.fields.a = { type: 'enum', values: ['-o'] }), /safe arguments/],
		['an unknown field type', s => (s.fields.a = { type: 'any' }), /unknown type/],
		['a bin that is not a function', s => (s.bin = 'x'), /bin must be a function/]
	]
	for (const [label, change, re] of cases) {
		const s = base()
		change(s)
		test.throws(() => checkSpec('t', s), re, `should reject ${label}`)
	}
	test.end()
})

tape('specs are frozen', test => {
	test.ok(Object.isFrozen(specs) && Object.isFrozen(spec) && Object.isFrozen(spec.fields), 'should freeze each spec')
	test.ok(Object.isFrozen(spec.argv), 'should freeze argv')
	const pos1 = spec.fields.pos1 as { pattern: RegExp }
	test.throws(() => pos1.pattern.compile('.*'), TypeError, 'should not allow a pattern to be recompiled')
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})

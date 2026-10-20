import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { runTool, runToolOutput, getArgv, checkSpec, mergeSpecs, specs } from '#src/tools/index.ts'
import type { Field, ToolSpec } from '#src/tools/index.ts'

/*
test sections:

hicstraw.query: argv of valid inputs
hicstraw.query: rejected inputs
other ops: argv of valid inputs, and rejected values
every field has rejected values
every field rejects the hostile values of its type
file fields: roots and debugmodeAnyRoot
runTool(): does not start the tool for a rejected input
runTool(): passes the argv of a valid input
runToolOutput(): resolves with the exit code and output
getArgv(): list slots and prefixed slots
checkSpec(): rejects malformed specs
mergeSpecs(): rejects an op that is in more than one spec file
specs are frozen, and a recompiled pattern does not change the checks
*/

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-tools-'))
const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
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
		'a/x.hic;ls',
		'a/$(ls).hic',
		'a/`ls`.hic',
		"a/x'.hic",
		'a/x|y.hic',
		'a/*.hic',
		'file:///etc/passwd',
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
		'chr1:1.' + '1'.repeat(25) + ':2',
		'chr1:5e-7:1',
		'',
		5,
		['chr1']
	],
	pos2: ['-o', 'chr2:1', 'chr2:a:b', 'chr2 ', 'chr2;ls', '', 5, ['chr2']],
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
	for (const pos of [
		'chr1:142.85714285714286:10000',
		`chr1:${String(1 / 3)}:${String(2 ** 0.5)}`,
		'chr1:0.0000012345678901234567:1'
	]) {
		test.equal(getArgv(op, spec, { ...valid(), pos1: pos })[3], pos, `should accept a javascript number string, ${pos}`)
	}
	withRemoteFile(true, () => {
		test.equal(
			getArgv(op, spec, { ...valid(), file: 'https://a.org/x.hic' })[2],
			'https://a.org/x.hic',
			'should accept an https url when remote files are allowed'
		)
		test.equal(
			getArgv(op, spec, { ...valid(), file: 'ftp://a.org/x.hic' })[2],
			'ftp://a.org/x.hic',
			'should accept an ftp url, as fileurl() and cache_index() do'
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

/** for each op other than hicstraw.query: a valid input, its argv, and values that must be rejected */
const otherOps: Record<string, { input: Record<string, unknown>; argv: string[]; bad: Record<string, unknown[]> }> = {
	'fimo.scan': {
		input: { thresh: 1e-4, motifDb: 'anno/db/motif.meme', fasta: path.join(cache, '0.123') },
		argv: [
			'--parse-genomic-coord',
			'--verbosity',
			'1',
			'--text',
			'--thresh',
			'0.0001',
			path.join(tp, 'anno/db/motif.meme'),
			path.join(cache, '0.123')
		],
		bad: {
			thresh: ['1e-4', '-o', -0.1, 1.5, NaN, Infinity, null],
			motifDb: ['../x.meme', '/etc/passwd', path.join(cache, 'x.meme'), '-o', ''],
			fasta: [path.join(tp, 'x.fa'), '/tmp/x.fa', path.join(cache, '../x.fa'), path.join(cache, '-o'), cache]
		}
	},
	'gfClient.align': {
		input: {
			host: 'blat.a.org',
			port: 1234,
			seqDir: '/home/root/pp/tp/genomes/',
			queryFile: path.join(cache, 'q'),
			outFile: path.join(cache, 'q.out')
		},
		argv: [
			'blat.a.org',
			'1234',
			'/home/root/pp/tp/genomes/',
			path.join(cache, 'q'),
			path.join(cache, 'q.out'),
			'-q=dna',
			'-nohead',
			'-minScore=20',
			'-minIdentity=0',
			'-out=psl'
		],
		bad: {
			host: ['-o', 'a.org;ls', 'a org', '', 'a'.repeat(254), 1234],
			port: ['1234', 0, 65536, 1.5],
			seqDir: ['-o', '/a dir/', '/a;ls', '', '/a/\n'],
			queryFile: [path.join(tp, 'q'), '/etc/passwd', path.join(cache, '../q')],
			outFile: ['/tmp/q.out', path.join(cache, '-o')]
		}
	},
	'h5dump.dataset': {
		input: { dataset: '/meta/samples/names', file: 'files/hg38/a.h5' },
		argv: ['-d', '/meta/samples/names', path.join(tp, 'files/hg38/a.h5')],
		bad: {
			dataset: ['-o', '/meta//names', '/meta/../names', 'a b', 'a;ls', '/', '', 'a'.repeat(257), ['samples']],
			file: ['../a.h5', '/etc/passwd', path.join(cache, 'a.h5'), 'a/-o.h5']
		}
	},
	'Rscript.loadRData': {
		input: { file: path.join(tp, 'files/a.RData') },
		argv: ['--vanilla', '-e', 'load(commandArgs(trailingOnly = TRUE)[1])', path.join(tp, 'files/a.RData')],
		bad: { file: ["a'); system('ls'); ('", '/etc/passwd', path.join(tp, '../a.RData'), '-o'] }
	},
	vm_stat: { input: {}, argv: [], bad: {} },
	'samtools.version': { input: {}, argv: ['--version'], bad: {} },
	'bcftools.version': { input: {}, argv: ['-v'], bad: {} },
	'samtools.index': {
		input: { file: path.join(cache, 'gdcbam/a.bam') },
		argv: ['index', path.join(cache, 'gdcbam/a.bam')],
		bad: { file: [path.join(tp, 'a.bam'), '-o'] }
	},
	'bigBed.query': {
		input: { chr: 'chr1', start: 0, end: 1000, file: 'anno/a.bb' },
		argv: ['-chrom=chr1', '-start=0', '-end=1000', path.join(tp, 'anno/a.bb'), 'stdout'],
		bad: {
			chr: ['-o', 'chr1 ', 'chr1;ls'],
			start: [-1, '0', 1.5],
			end: ['1000', 1e15],
			file: ['/etc/passwd', '-o', path.join(cache, 'a.bb')]
		}
	},
	'bigBed.byName': {
		input: { file: 'anno/a.bb', name: 'rs123' },
		argv: [path.join(tp, 'anno/a.bb'), 'rs123', 'stdout'],
		bad: { file: ['/etc/passwd', path.join(cache, 'a.bb')], name: ['-o', 'rs1 rs2', 'rs1;ls', ''] }
	},
	'bigBed.info': {
		input: { file: 'anno/a.bb' },
		argv: [path.join(tp, 'anno/a.bb')],
		bad: { file: ['/etc/passwd', '-o', path.join(cache, 'a.bb')] }
	}
}

tape('other ops: argv of valid inputs, and rejected values', test => {
	// debugmode allows a dataset file outside tp, see the file fields section
	const prev = serverconfig.debugmode
	serverconfig.debugmode = false
	test.deepEqual(Object.keys(specs).sort(), [...Object.keys(otherOps), op].sort(), 'should test every op')
	for (const [o, { input, argv, bad }] of Object.entries(otherOps)) {
		test.deepEqual(getArgv(o, specs[o], input), argv, `${o}: should put each field value in its argv slot`)
		test.throws(
			() => getArgv(o, specs[o], { ...input, extra: 'x' }),
			/unexpected input field/,
			`${o}: should reject an extra field`
		)
		for (const [name, values] of Object.entries(bad)) {
			for (const v of values) {
				test.throws(
					() => getArgv(o, specs[o], { ...input, [name]: v }),
					new RegExp(`invalid ${name}`),
					`${o}: should reject ${name}=${JSON.stringify(v)}`
				)
			}
		}
	}
	serverconfig.debugmode = prev
	test.end()
})

/** the input and rejected values of every op, for the sections below */
const allOps = { [op]: { input: valid(), bad: badValues }, ...otherOps }

tape('every field has rejected values', test => {
	// so that a field cannot be added, or its check loosened, without a test of the values it must reject
	for (const [o, spec] of Object.entries(specs)) {
		test.ok(Object.hasOwn(allOps, o), `${o} should have test cases`)
		for (const name of Object.keys(spec.fields)) {
			test.ok(allOps[o]?.bad[name]?.length > 0, `${o}: ${name} should have rejected values`)
		}
	}
	test.end()
})

/** strings that no field of any type may accept: options, shell syntax, control and non-ascii characters, and an oversize value */
const hostileStrings = [
	'',
	'-o',
	'--x=1',
	'a;ls',
	'a&&ls',
	'a|ls',
	'$(ls)',
	'${IFS}',
	'`ls`',
	"a'b",
	'a"b',
	'a>b',
	'a<b',
	'a*',
	'a?b',
	'a\\b',
	'a\nb',
	'a\tb',
	'a\0b',
	'‮abc', // right-to-left override
	'аbc', // cyrillic a
	'x'.repeat(5000)
]
/** values of other types, which a string, enum, or file field must reject */
const nonStrings = [5, true, null, undefined, ['a'], {}]

/** the hostile values of a field, from its type, so that a loosened check is detected without a case per field */
function hostileValues(field: Field): unknown[] {
	switch (field.type) {
		case 'enum':
		case 'string':
			return [...hostileStrings, ...nonStrings]
		case 'file':
		case 'fileOrUrl':
			return [
				...hostileStrings,
				...nonStrings,
				'../x',
				'a/../../x',
				'/etc/passwd',
				'/',
				'file:///etc/passwd',
				'http://127.0.0.1/x',
				'http://169.254.169.254/x'
			]
		case 'int':
			return ['1', '-1', -1, 1.5, NaN, Infinity, -Infinity, field.min - 1, field.max + 1, 2 ** 53, null, [1], true]
		case 'number':
			return ['0.1', '-1', field.min - 1, NaN, Infinity, -Infinity, field.max * 2 + 1, null, [0.1], true]
		case 'list':
			// a list must be a non-empty array of at most maxItems, and each item rejects the hostile values of its type
			return [
				'a',
				5,
				null,
				{},
				[],
				Array(field.maxItems + 1).fill(hostileValues(field.item)[0]),
				...hostileValues(field.item).map(v => [v])
			]
	}
}

tape('every field rejects the hostile values of its type', test => {
	// debugmode allows a dataset file outside tp, which is tested in the file fields section
	const prev = serverconfig.debugmode
	serverconfig.debugmode = false
	try {
		withRemoteFile(true, () => {
			for (const [o, spec] of Object.entries(specs)) {
				for (const [name, field] of Object.entries(spec.fields)) {
					let missed = 0
					for (const v of hostileValues(field)) {
						try {
							getArgv(o, spec, { ...allOps[o].input, [name]: v })
							missed++
							test.fail(`${o}: ${name} should reject ${JSON.stringify(v)?.slice(0, 40)}`)
						} catch (e) {
							if (!String(e).includes(`invalid ${name}`)) test.fail(`${o}: ${name}: unexpected error ${e}`)
						}
					}
					if (!missed) test.pass(`${o}: ${name} should reject the hostile values of type ${field.type}`)
				}
			}
		})
	} finally {
		serverconfig.debugmode = prev
	}
	test.end()
})

tape('file fields: roots and debugmodeAnyRoot', test => {
	const s = specs['fimo.scan']
	const input = otherOps['fimo.scan'].input
	test.equal(
		getArgv('fimo.scan', s, { ...input, fasta: '0.123' })[7],
		path.join(cache, '0.123'),
		'should resolve a relative path under the root'
	)
	test.equal(
		getArgv('fimo.scan', s, { ...input, fasta: 'a b (1),v2=x@y~.fa' })[7],
		path.join(cache, 'a b (1),v2=x@y~.fa'),
		'should accept the space, parentheses, and other allowed characters of a file name'
	)
	const both: ToolSpec = { bin: () => 'x', fields: { f: { type: 'file', roots: ['tp', 'cache'] } }, argv: ['$f'] }
	test.equal(
		getArgv('t', both, { f: path.join(cache, 'a') })[0],
		path.join(cache, 'a'),
		'should accept an absolute path under the second root'
	)
	test.equal(
		getArgv('t', both, { f: 'a' })[0],
		path.join(tp, 'a'),
		'should resolve a relative path under the first root only'
	)
	const r = specs['Rscript.loadRData']
	const outside = path.join(path.dirname(tp), 'native/a.RData')
	const prev = serverconfig.debugmode
	try {
		serverconfig.debugmode = false
		test.throws(
			() => getArgv('Rscript.loadRData', r, { file: outside }),
			/invalid file/,
			'should reject a path outside tp when not in debugmode'
		)
		serverconfig.debugmode = true
		test.deepEqual(
			getArgv('Rscript.loadRData', r, { file: outside }).at(-1),
			outside,
			'should accept an absolute path outside tp in debugmode'
		)
		for (const file of ['a.RData', '/a/-o.RData', "/a'); system('ls'); ('"])
			if (file[0] != '/' || file.includes('-o'))
				test.throws(
					() => getArgv('Rscript.loadRData', r, { file }),
					/invalid file/,
					`should still reject ${file} in debugmode`
				)
	} finally {
		serverconfig.debugmode = prev
	}
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

tape('runToolOutput(): resolves with the exit code and output', async test => {
	const bin = path.join(tmpdir, 'out.sh')
	fs.writeFileSync(bin, `#!/bin/sh\nprintf '%s ' "$@"\nprintf 'warn' >&2\nexit 3\n`, { mode: 0o755 })
	const prev = serverconfig.fimo
	serverconfig.fimo = bin
	try {
		const { input, argv } = otherOps['fimo.scan']
		const out = await runToolOutput('fimo.scan', input)
		test.deepEqual(
			out,
			{ code: 3, stdout: argv.join(' ') + ' ', stderr: 'warn' },
			'should resolve with the code, stdout, and stderr'
		)
		serverconfig.fimo = path.join(tmpdir, 'missing')
		try {
			await runToolOutput('fimo.scan', input)
			test.fail('should reject when the tool cannot be started')
		} catch (e: any) {
			test.equal(e?.code, 'ENOENT', 'should reject with the spawn error when the tool cannot be started')
		}
		try {
			await runToolOutput('fimo.scan', { ...input, thresh: '-o' })
			test.fail('should reject an invalid input')
		} catch (e) {
			test.match(String(e), /invalid thresh/, 'should reject an invalid input')
		}
	} finally {
		serverconfig.fimo = prev
	}
	test.end()
})

tape('getArgv(): list slots and prefixed slots', test => {
	// no op has a list field, so a list slot is tested with this spec
	const l: ToolSpec = {
		bin: () => 'x',
		fields: {
			regions: { type: 'list', item: { type: 'string', pattern: /^chr\d+:\d+-\d+$/, maxLength: 20 }, maxItems: 3 }
		},
		argv: ['-r', '...$regions']
	}
	checkSpec('t.list', l)
	test.deepEqual(
		getArgv('t.list', l, { regions: ['chr1:1-2', 'chr2:3-4'] }),
		['-r', 'chr1:1-2', 'chr2:3-4'],
		'should put each list item in its own argv slot'
	)
	for (const regions of [[], ['chr1:1-2', 'chr1:1-2', 'chr1:1-2', 'chr1:1-2'], ['-o:1-2'], 'chr1:1-2']) {
		test.throws(
			() => getArgv('t.list', l, { regions }),
			/invalid regions/,
			`should reject regions=${JSON.stringify(regions)}`
		)
	}
	const b = specs['bigBed.query']
	test.deepEqual(
		getArgv('bigBed.query', b, otherOps['bigBed.query'].input).slice(0, 3),
		['-chrom=chr1', '-start=0', '-end=1000'],
		'should put a value after the literal prefix of its slot'
	)
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
		['a bin that is not a function', s => (s.bin = 'x'), /bin must be a function/],
		['a negative int min', s => (s.fields.a = { type: 'int', min: -1, max: 1 }), /0 <= min <= max/],
		['a non-finite number max', s => (s.fields.a = { type: 'number', min: 0, max: Infinity }), /0 <= min <= max/],
		['a file field with no roots', s => (s.fields.a = { type: 'file', roots: [] }), /roots of a/],
		['a file field with an unknown root', s => (s.fields.a = { type: 'file', roots: ['/'] }), /roots of a/],
		[
			'a list field in a single slot',
			s => (s.fields.a = { type: 'list', item: s.fields.a, maxItems: 2 }),
			/only a list field/
		],
		['a spread slot of a field that is not a list', s => (s.argv = ['...$a']), /only a list field/],
		[
			'a spread slot with a prefix',
			s => ((s.fields.a = { type: 'list', item: s.fields.a, maxItems: 2 }), (s.argv = ['...-x=$a'])),
			/must not have a prefix|only a list field/
		],
		[
			'a list of lists',
			s => (s.fields.a = { type: 'list', item: { type: 'list', item: s.fields.a, maxItems: 2 }, maxItems: 2 }),
			/only a list field|must not be a list/
		],
		[
			'a list with too many items',
			s => ((s.fields.a = { type: 'list', item: s.fields.a, maxItems: 1e6 }), (s.argv = ['...$a'])),
			/maxItems/
		],
		['a literal with $ that is not a slot', s => s.argv.push('a$b c'), /must be a literal without \$/]
	]
	for (const [label, change, re] of cases) {
		const s = base()
		change(s)
		test.throws(() => checkSpec('t', s), re, `should reject ${label}`)
	}
	test.end()
})

tape('mergeSpecs(): rejects an op that is in more than one spec file', test => {
	const s: ToolSpec = { bin: () => 'x', fields: {}, argv: [] }
	test.deepEqual(Object.keys(mergeSpecs([{ a: s }, { b: s }])), ['a', 'b'], 'should merge distinct ops')
	test.throws(
		() => mergeSpecs([{ a: s }, { a: s }]),
		/tool spec a is defined more than once/,
		'should reject a duplicate op'
	)
	test.end()
})

tape('specs are frozen, and a recompiled pattern does not change the checks', test => {
	test.ok(Object.isFrozen(specs) && Object.isFrozen(spec) && Object.isFrozen(spec.fields), 'should freeze each spec')
	test.ok(Object.isFrozen(spec.argv), 'should freeze argv')
	// RegExp.prototype.compile() changes the pattern of a frozen RegExp before it throws, so the checks use a copy
	const pos1 = spec.fields.pos1 as { pattern: RegExp }
	const { source, flags } = pos1.pattern
	try {
		test.throws(() => pos1.pattern.compile('.*'), TypeError, 'should throw when a pattern is recompiled')
		test.equal(pos1.pattern.source, '.*', 'should have changed the spec pattern, which the checks do not use')
		for (const pos of ['-o', 'chr1;ls', 'chr1:1']) {
			test.throws(() => getArgv(op, spec, { ...valid(), pos1: pos }), /invalid pos1/, `should still reject pos1=${pos}`)
		}
		test.equal(getArgv(op, spec, valid())[3], 'chr1:0:1000000', 'should still accept a valid pos1')
	} finally {
		try {
			pos1.pattern.compile(source, flags)
		} catch (_) {
			// throws after the pattern is restored, as above
		}
	}
	test.equal(pos1.pattern.source, source, 'should have restored the spec pattern')
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})

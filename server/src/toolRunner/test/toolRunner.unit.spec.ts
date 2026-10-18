import tape from 'tape'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getCommand } from '#src/toolRunner/requests.ts'
import { listenToolRunner } from '#src/toolRunner/runner.ts'
import { setToolRunnerSocket, connectToolRunner, usesToolRunner } from '#src/toolRunner/client.ts'
import type { ToolProcess } from '#src/toolRunner/client.ts'
import { FrameType, FrameReader, writeJson, writeFrames, maxPayload } from '#src/toolRunner/protocol.ts'
import { runTool, runToolOutput, getArgv, specs } from '#src/tools/index.ts'
import * as utils from '#src/utils.js'
import { StandIns } from '#src/tools/test/standIns.ts'
import { setRequestContext } from '#src/requestContext.ts'
import express from 'express'
import type { Server } from 'http'

/*
Specs of the tool runner, which starts the processes that the server requests, and of the client that the server
uses to start every process, with or without a runner.

test sections:
getCommand(): tool requests
getCommand(): R, python and rust requests
getCommand(): hts requests
getCommand(): rejected requests
runner: the same output, exit code, and argv as without a runner
runner: stdin and stdout of several frames
runner: kill()
runner: a closed connection kills the process
runner: a rejected request starts nothing
runner: a tool that cannot be started
runner: a bcftools query
runner: tabix reads and a rust binary
request context: a process is stopped when the response is closed
control connection
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
const standIns = new StandIns()
// a short path, since a socket path is limited to about 100 characters
const socketDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-tr-'))
const socketPath = path.join(socketDir, 'tools.sock')
let runner: net.Server

function hicInput(): Record<string, unknown> {
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

/** sets serverconfig.hicstraw to a stand-in with the script while fn runs */
async function withStraw(script: string, fn: () => Promise<void>) {
	const prev = serverconfig.hicstraw
	serverconfig.hicstraw = standIns.add('straw', script)
	try {
		await fn()
	} finally {
		serverconfig.hicstraw = prev
		standIns.reset()
	}
}

/** starts processes through the runner while fn runs */
async function withRunner(fn: () => Promise<void>) {
	setToolRunnerSocket(socketPath)
	try {
		await fn()
	} finally {
		setToolRunnerSocket(undefined)
	}
}

/** resolves with the output and the close event arguments of a process */
function collect(ps: ToolProcess): Promise<{ stdout: string; stderr: string; code: number | null; signal: unknown }> {
	return new Promise((resolve, reject) => {
		const out: Buffer[] = []
		const err: Buffer[] = []
		ps.stdout.on('data', d => out.push(d))
		ps.stderr.on('data', d => err.push(d))
		ps.on('error', reject)
		ps.on('close', (code, signal) =>
			resolve({ stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString(), code, signal })
		)
	})
}

/** sends a request on a new connection, and resolves with the frames that the runner sends back */
function rawRequest(req: unknown, after?: (socket: net.Socket) => void): Promise<{ type: number; payload: string }[]> {
	return new Promise(resolve => {
		const frames: { type: number; payload: string }[] = []
		const socket = net.connect(socketPath)
		const reader = new FrameReader((type, payload) => frames.push({ type, payload: payload.toString() }))
		socket.on('data', (d: Buffer) => reader.push(d))
		socket.on('close', () => resolve(frames))
		writeJson(socket, FrameType.request, req)
		after?.(socket)
	})
}

function isRunning(pid: number) {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

async function waitFor(check: () => boolean, ms = 5000) {
	const end = Date.now() + ms
	while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 20))
	return check()
}

tape('\n', async test => {
	test.comment('-***- tool runner specs -***-')
	runner = await listenToolRunner({ socketPath })
	test.end()
})

tape('getCommand(): tool requests', test => {
	const input = hicInput()
	test.deepEqual(
		getCommand({ kind: 'tool', op: 'hicstraw.query', input }),
		{ file: serverconfig.hicstraw, args: getArgv('hicstraw.query', specs['hicstraw.query'], input) },
		'should build the command from the spec'
	)
	const dir = path.join(cache, 'x')
	test.deepEqual(
		getCommand({ kind: 'tool', op: 'tabix.header', input: { file: path.join(tp, 'a.gz'), dir } }),
		{ file: serverconfig.tabix, args: ['-H', path.join(tp, 'a.gz')], cwd: dir },
		'should include the cwd of the spec'
	)
	test.throws(
		() => getCommand({ kind: 'tool', op: 'hicstraw.query', input: { ...input, pos1: '-o' } }),
		/hicstraw.query: invalid pos1/,
		'should throw for an input that the spec rejects'
	)
	test.throws(
		() => getCommand({ kind: 'tool', op: 'toString', input: {} }),
		/unknown tool operation/,
		'should throw for an op that is not a spec'
	)
	test.end()
})

tape('getCommand(): R, python and rust requests', test => {
	const r = getCommand({ kind: 'R', script: 'km.R', subdir: 'src' })
	test.equal(r.file, 'Rscript', 'should run an R script with Rscript')
	test.equal(r.args.length, 2, 'should have no R script arguments')
	test.ok(r.args[0] == '--vanilla' && r.args[1].endsWith('/src/km.R'), 'should run the script of the R package')
	test.ok(
		getCommand({ kind: 'R', script: 'validate.pkgs.R', subdir: 'utils' }).args[1].endsWith('/utils/validate.pkgs.R'),
		'should run an R script in utils/'
	)
	const py = getCommand({ kind: 'python', script: 'gsea.py' })
	test.deepEqual(py.args.slice(0, 2), ['-E', '-s'], 'should run python without the PYTHON* env and user site dir')
	test.ok(py.args[2].endsWith('/src/gsea.py') && py.args.length == 3, 'should run the script of the python package')
	const rs = getCommand({ kind: 'rust', binary: 'fisher' })
	test.ok(rs.file.endsWith('/target/release/fisher') && rs.args.length == 0, 'should run the rust binary')

	for (const [req, re] of [
		[{ kind: 'R', script: '../src/km.R', subdir: 'src' }, /invalid R script name/],
		[{ kind: 'R', script: '/tmp/km.R', subdir: 'src' }, /invalid R script name/],
		[{ kind: 'R', script: 'km.r', subdir: 'src' }, /invalid R script name/],
		[{ kind: 'R', script: '-e.R', subdir: 'src' }, /invalid R script name/],
		[{ kind: 'R', script: 'km.R', subdir: '..' }, /invalid R script dir/],
		[{ kind: 'R', script: 'none.R', subdir: 'src' }, /does not exist/],
		[{ kind: 'python', script: '../src/gsea.py' }, /invalid python script name/],
		[{ kind: 'python', script: 'gsea.py\n' }, /invalid python script name/],
		[{ kind: 'python', script: 'none.py' }, /does not exist/],
		[{ kind: 'rust', binary: '../release/fisher' }, /invalid rust binary name/],
		[{ kind: 'rust', binary: 'fisher.d' }, /invalid rust binary name/],
		[{ kind: 'rust', binary: 'build' }, /does not exist/],
		[{ kind: 'rust', binary: 'none' }, /does not exist/]
	] as [unknown, RegExp][]) {
		test.throws(() => getCommand(req), re, `should reject ${JSON.stringify(req)}`)
	}
	test.end()
})

tape('getCommand(): hts requests', test => {
	const view = ['view', '-c', path.join(tp, 'a.bam'), 'chr1:1-2']
	test.deepEqual(
		getCommand({ kind: 'hts', tool: 'samtools', args: view, cwd: null }),
		{ file: serverconfig.samtools, args: view },
		'should run samtools with the arguments'
	)
	const dir = path.join(cache, 'x')
	test.deepEqual(
		getCommand({ kind: 'hts', tool: 'bcftools', args: ['query', 'a.bcf'], cwd: dir }),
		{ file: serverconfig.bcftools, args: ['query', 'a.bcf'], cwd: dir },
		'should run bcftools in a cache dir'
	)
	// the cache dir of a url keeps the url body
	const urlDir = path.join(cache, 'https/a.org:8443/x%20y/t.bcf?token=1&v=2')
	test.equal(
		getCommand({ kind: 'hts', tool: 'bcftools', args: ['query', 'a.bcf'], cwd: urlDir }).cwd,
		urlDir,
		'should allow url characters in the cache dir'
	)
	// the output format of a bcftools query, as in mds3.init.js and termdb.snp.js
	const query = ['query', 'a.bcf', '-r', 'chr1:1-2', '-f', '%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO[\t%TGT]\n']
	test.deepEqual(
		getCommand({ kind: 'hts', tool: 'bcftools', args: query, cwd: null }).args,
		query,
		'should allow a tab and newline in a bcftools output format'
	)
	const hts = (tool: unknown, args: unknown, cwd: unknown = null) => ({ kind: 'hts', tool, args, cwd })
	for (const [req, re] of [
		[hts('tabix', ['view']), /invalid hts tool/],
		[hts('constructor', ['view']), /invalid hts tool/],
		[hts('samtools', []), /invalid args/],
		[hts('samtools', 'view'), /invalid args/],
		[hts('samtools', Array(1001).fill('view')), /invalid args/],
		[hts('samtools', ['index', 'a.bam']), /unsupported subcommand/],
		[hts('bcftools', ['depth', 'a.bcf']), /unsupported subcommand/],
		[hts('samtools', ['view', 1]), /invalid argument/],
		[hts('samtools', ['view', '']), /invalid argument/],
		[hts('samtools', ['view', 'a\nb']), /invalid argument/],
		[hts('bcftools', ['query', 'a\tb.bcf', '-f', '%ID\n']), /invalid argument/],
		[hts('bcftools', ['query', 'a.bcf', '-f', '%ID\r\n']), /invalid argument/],
		[hts('bcftools', ['query', 'a.bcf', '-f', '%ID\x00']), /invalid argument/],
		[hts('samtools', ['view', '-f', '4\n']), /invalid argument/],
		[hts('samtools', ['view', 'x'.repeat(4097)]), /invalid argument/],
		[hts('samtools', ['view', 'a.bam', '-o/tmp/x:1-2']), /invalid region argument/],
		[hts('samtools', ['view', 'a.bam'], '/tmp'), /invalid cwd/],
		[hts('samtools', ['view', 'a.bam'], path.join(cache, '../x')), /invalid cwd/],
		[hts('samtools', ['view', 'a.bam'], 1), /invalid cwd/]
	] as [unknown, RegExp][]) {
		test.throws(() => getCommand(req), re, `should reject ${JSON.stringify(req).slice(0, 100)}`)
	}
	test.end()
})

tape('getCommand(): rejected requests', test => {
	const tool = { kind: 'tool', op: 'samtools.version', input: {} }
	for (const [label, req, re] of [
		['undefined', undefined, /must be a plain object/],
		['an array', [tool], /must be a plain object/],
		['a null-prototype object', Object.assign(Object.create(null), tool), /must be a plain object/],
		['an unknown kind', { ...tool, kind: 'exec' }, /unknown request kind/],
		['an inherited kind', { ...tool, kind: 'toString' }, /unknown request kind/],
		['a command', { kind: 'exec', file: '/bin/sh', args: ['-c', 'id'] }, /unknown request kind/],
		['an extra key', { ...tool, file: '/bin/sh' }, /invalid tool request keys/],
		['a missing key', { kind: 'tool', op: 'samtools.version' }, /invalid tool request keys/],
		['R arguments', { kind: 'R', script: 'km.R', subdir: 'src', args: ['x'] }, /invalid R request keys/],
		['rust arguments', { kind: 'rust', binary: 'fisher', args: ['x'] }, /invalid rust request keys/]
	] as [string, unknown, RegExp][]) {
		test.throws(() => getCommand(req), re, `should reject ${label}`)
	}
	test.end()
})

tape('runner: the same output, exit code, and argv as without a runner', async test => {
	await withStraw(`echo out; echo err >&2; exit 3`, async () => {
		const direct = await runToolOutput('hicstraw.query', hicInput())
		await withRunner(async () => {
			test.ok(usesToolRunner(), 'should use the runner')
			test.deepEqual(await runToolOutput('hicstraw.query', hicInput()), direct, 'should have the same output and code')
		})
		test.deepEqual(direct, { code: 3, stdout: 'out\n', stderr: 'err\n' }, 'should have the output of the tool')
		const [a, b] = standIns.calls('straw')
		test.deepEqual(b, a, 'should start the tool with the same argv')
	})
	await withRunner(async () => {
		test.throws(
			() => runTool('hicstraw.query', { ...hicInput(), pos1: '-o' }),
			/invalid pos1/,
			'should throw for an invalid input before anything is sent'
		)
	})
	test.end()
})

tape('runner: stdin and stdout of several frames', async test => {
	await withStraw(`cat`, async () => {
		await withRunner(async () => {
			const ps = runTool('hicstraw.query', hicInput())
			let spawned = false
			ps.on('spawn', () => (spawned = true))
			// multibyte characters that are split across frames, which must be joined before decoding
			const data = '≥αβ\n'.repeat(Math.ceil((2.5 * maxPayload) / 8))
			const result = collect(ps)
			ps.stdin.end(data)
			const { stdout, code } = await result
			test.ok(spawned, 'should emit spawn')
			test.equal(code, 0, 'should exit with 0')
			test.equal(stdout.length, data.length, 'should have the same length of output as of input')
			test.ok(stdout === data, 'should return the stdin data as stdout')
		})
	})
	test.end()
})

tape('runner: kill()', async test => {
	await withStraw(`exec sleep 30`, async () => {
		await withRunner(async () => {
			const ps = runTool('hicstraw.query', hicInput())
			await new Promise(r => ps.once('spawn', r))
			test.equal(ps.kill(), true, 'should send the signal')
			const { code, signal } = await collect(ps)
			test.equal(signal, 'SIGTERM', 'should be terminated by the signal')
			test.equal(code, null, 'should have no exit code')
			test.equal(ps.killed, true, 'should be marked as killed')
			test.equal(ps.kill(), false, 'should not send a signal after the exit')
		})
	})
	test.end()
})

tape('runner: a closed connection kills the process', async test => {
	const pidFile = path.join(socketDir, 'straw.pid')
	await withStraw(`echo $$ > ${pidFile}; exec sleep 30`, async () => {
		await rawRequest({ kind: 'tool', op: 'hicstraw.query', input: hicInput() }, async socket => {
			await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').endsWith('\n'))
			socket.destroy()
		})
		const pid = Number(fs.readFileSync(pidFile, 'utf8'))
		test.ok(await waitFor(() => !isRunning(pid)), 'should kill the process')
	})
	test.end()
})

tape('runner: a rejected request starts nothing', async test => {
	await withStraw(`echo started`, async () => {
		for (const [label, req] of [
			['an invalid input', { kind: 'tool', op: 'hicstraw.query', input: { ...hicInput(), pos1: '-o' } }],
			['an extra input field', { kind: 'tool', op: 'hicstraw.query', input: { ...hicInput(), argv: ['-x'] } }],
			['a command', { kind: 'exec', file: serverconfig.hicstraw, args: [] }],
			['an hts subcommand that is not used', { kind: 'hts', tool: 'samtools', args: ['index', 'a.bam'], cwd: null }]
		] as [string, unknown][]) {
			const frames = await rawRequest(req)
			test.deepEqual(
				frames.map(f => f.type),
				[FrameType.failed],
				`should only answer with a failed frame for ${label}`
			)
		}
		test.deepEqual(standIns.calls('straw'), [], 'should not start the tool')

		// a request frame that is not the first frame, or not JSON
		const frames = await new Promise<number[]>(resolve => {
			const types: number[] = []
			const socket = net.connect(socketPath)
			const reader = new FrameReader(type => types.push(type))
			socket.on('data', (d: Buffer) => reader.push(d))
			socket.on('close', () => resolve(types))
			writeFrames(socket, FrameType.request, '{not json')
		})
		test.deepEqual(frames, [FrameType.failed], 'should reject a request that is not JSON')
		test.deepEqual(standIns.calls('straw'), [], 'should not start the tool')
	})
	test.end()
})

tape('runner: a tool that cannot be started', async test => {
	const prev = serverconfig.hicstraw
	serverconfig.hicstraw = path.join(socketDir, 'none')
	try {
		await withRunner(async () => {
			const ps = runTool('hicstraw.query', hicInput())
			const events: unknown[] = []
			ps.on('error', (e: NodeJS.ErrnoException) => events.push(['error', e.code]))
			await new Promise(r => ps.on('close', code => r(events.push(['close', code]))))
			test.deepEqual(
				events,
				[
					['error', 'ENOENT'],
					['close', -2]
				],
				'should emit error and close, like a child process'
			)
		})
	} finally {
		serverconfig.hicstraw = prev
	}
	test.end()
})

tape('runner: a bcftools query', async test => {
	// the real tool, with the output format of mds3.init.js, which has a tab and newline
	const file = path.join(tp, 'files/hg38/TermdbTest/TermdbTest.bcf.gz')
	// a chromosome with variants in the test file
	const chr = '12'
	const query = async () => {
		const lines: string[] = []
		await utils.get_lines_bigfile({
			isbcf: true,
			args: ['query', file, '-r', chr, '-f', '%ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\n'],
			callback: line => lines.push(line)
		})
		return lines
	}
	const direct = await query()
	test.ok(direct.length > 0 && direct[0].split('\t').length == 6, 'should read the variant lines')
	await withRunner(async () => {
		test.deepEqual(await query(), direct, 'should read the same lines with the runner')
	})
	test.end()
})

tape('runner: tabix reads and a rust binary', async test => {
	const file = path.join(tp, 'files/hg38/TermdbTest/TermdbTest_ITD.gz')
	const region = { chr: 'chr17', start: 1, stop: 100000000 }
	const read = async () => {
		const lines: string[] = []
		await utils.readTabixLines({ file, regions: [region], callback: line => lines.push(line) })
		return lines
	}
	const fisherInput = JSON.stringify({
		input: [{ index: 0, n1: 10, n2: 2, n3: 3, n4: 15 }]
	})
	const direct = { lines: await read(), fisher: await run_rust('fisher', fisherInput) }
	await withRunner(async () => {
		test.deepEqual(await read(), direct.lines, 'should read the same tabix lines')
		test.deepEqual(await run_rust('fisher', fisherInput), direct.fisher, 'should have the same rust output')
		const first: string[] = []
		await utils.readTabixLines({ file, regions: [region], callback: (line, stop) => (first.push(line), stop()) })
		test.equal(first.length, 1, 'should stop the read when the callback calls stop()')
		try {
			await run_rust('fisher', fisherInput, ['--x'])
			test.fail('should reject rust arguments')
		} catch (e) {
			test.match(String(e), /arguments are not supported/, 'should reject rust arguments')
		}
	})
	test.equal(direct.lines.length, 2, 'should read the lines of the region')
	test.end()
})

/** an express app with the request context middleware, on an ephemeral port; returns its url and a close function */
async function listenApp(handlers: Record<string, (req: any, res: any) => unknown>) {
	const app = express()
	app.use(setRequestContext)
	for (const [p, h] of Object.entries(handlers)) app.get(p, h)
	const server = await new Promise<Server>(r => {
		const s = app.listen(0, () => r(s))
	})
	const { port } = server.address() as net.AddressInfo
	return { url: `http://localhost:${port}`, close: () => new Promise(r => server.close(r)) }
}

/** resolves with the pid that the stand-in writes to the file */
async function readPid(file: string) {
	await waitFor(() => fs.existsSync(file) && fs.readFileSync(file, 'utf8').endsWith('\n'))
	return Number(fs.readFileSync(file, 'utf8'))
}

tape('request context: a process is stopped when the response is closed', async test => {
	const pidFile = path.join(socketDir, 'ctx.pid')
	const errors: string[] = []
	const consoleError = console.error
	console.error = (m: string) => errors.push(m)
	try {
		for (const mode of ['without a runner', 'with a runner']) {
			await withStraw(`echo $$ > ${pidFile}; exec sleep 30`, async () => {
				if (mode == 'with a runner') setToolRunnerSocket(socketPath)
				let late: unknown
				const quick = standIns.add('quick', 'echo done')
				const { url, close } = await listenApp({
					// responds while the tool still runs
					'/early': async (req, res) => {
						runTool('hicstraw.query', hicInput()).on('error', () => {})
						// so that the tool has started, since it is stopped right after the response
						await readPid(pidFile)
						res.send({ ok: 1 })
						// a later start, such as from background work of the request
						res.once('close', () => {
							try {
								runTool('hicstraw.query', hicInput())
							} catch (e) {
								late = e
							}
						})
					},
					// waits for the tool, which only ends when it is stopped
					'/wait': async (req, res) => {
						await runToolOutput('hicstraw.query', hicInput())
						res.send({ ok: 1 })
					},
					// the tool ends before the response
					'/done': async (req, res) => {
						const prev = serverconfig.hicstraw
						serverconfig.hicstraw = quick
						try {
							res.send(await runToolOutput('hicstraw.query', hicInput()))
						} finally {
							serverconfig.hicstraw = prev
						}
					}
				})
				try {
					fs.rmSync(pidFile, { force: true })
					await fetch(url + '/early').then(r => r.json())
					const pid = await readPid(pidFile)
					test.ok(await waitFor(() => !isRunning(pid)), `${mode}: should stop a tool that runs after the response`)
					test.match(
						String(late),
						/not started, the response of \/early is already closed/,
						`${mode}: should not start a tool after the response`
					)

					fs.rmSync(pidFile, { force: true })
					const ctrl = new AbortController()
					const pending = fetch(url + '/wait', { signal: ctrl.signal }).catch(() => {})
					const pid2 = await readPid(pidFile)
					ctrl.abort()
					await pending
					test.ok(await waitFor(() => !isRunning(pid2)), `${mode}: should stop a tool when the client disconnects`)

					const before = errors.length
					test.deepEqual(
						await fetch(url + '/done').then(r => r.json()),
						{ code: 0, stdout: 'done\n', stderr: '' },
						`${mode}: should not change a tool that ends before the response`
					)
					await new Promise(r => setTimeout(r, 100))
					test.equal(errors.length, before, `${mode}: should not log a tool that ended before the response`)
				} finally {
					setToolRunnerSocket(undefined)
					await close()
				}
			})
		}
	} finally {
		console.error = consoleError
	}
	test.ok(
		errors.some(e => /^stopping hicstraw.query, which still runs after the response of \/early is closed$/.test(e)),
		'should log the stopped tool and the request path'
	)
	test.end()
})

tape('control connection', async test => {
	let closed = 0
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-tr-'))
	const p = path.join(dir, 'tools.sock')
	process.env.PP_TOOL_RUNNER_SOCKET = p
	// the runner is started after the server tries to connect, which is retried
	const connected = connectToolRunner(() => closed++)
	const server = await listenToolRunner({ socketPath: p })
	await connected
	test.equal(process.env.PP_TOOL_RUNNER_SOCKET, undefined, 'should remove the socket path from the env')
	test.ok(usesToolRunner(), 'should use the runner once it is ready')
	test.equal((fs.statSync(p).mode & 0o777).toString(8), '600', 'should only allow this user to connect')

	// such as a server that a watch mode restarted
	const second = net.connect(p)
	const types: number[] = []
	const reader = new FrameReader(type => types.push(type))
	second.on('data', (d: Buffer) => reader.push(d))
	writeFrames(second, FrameType.hello)
	test.ok(await waitFor(() => types.length > 0), 'should answer a new control connection')
	test.deepEqual(types, [FrameType.ready], 'should be ready for the new control connection')
	test.ok(await waitFor(() => closed == 1), 'should close the earlier control connection, whose server then exits')

	second.destroy()
	server.close()
	setToolRunnerSocket(undefined)
	fs.rmSync(dir, { recursive: true, force: true })
	test.end()
})

tape('cleanup', test => {
	runner.close()
	standIns.remove()
	fs.rmSync(socketDir, { recursive: true, force: true })
	test.end()
})

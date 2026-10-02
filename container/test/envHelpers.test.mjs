// In-process tests for envHelpers.mjs, using a fake fs and spawn injected via createContext(),
// plus a couple of subprocess smoke tests for the CLI entry wiring and exit code propagation.
// run: node --test container/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
	envHelpers,
	createContext,
	getNodeConfig,
	getCreds,
	findPrefixConflicts,
	permissionFlags
} from '../envHelpers.mjs'

const SCRIPT = path.join(import.meta.dirname, '../envHelpers.mjs')

test('dev: allowed paths are computed from cwd, node install, tmpdir, and serverconfig', () => {
	const ctx = fakeContext({
		files: {
			'/app/serverconfig.json': JSON.stringify({
				tpmasterdir: '/data/tp',
				cachedir: '~/cache',
				features: { tp_native_dir: '/data/native' },
				ssl: { key: './.ssl/k.key', cert: '/certs/c.crt' }
			})
		},
		realpaths: { '/tmp/user': '/private/tmp/user' }
	})
	const opts = getNodeConfig(ctx).nodeOptions
	assert.equal(opts.permission, true)
	// /app/.ssl/k.key is covered by /app
	assert.deepEqual(opts['allow-fs-read'].toSorted(), [
		'/app',
		'/certs/c.crt',
		'/data/native',
		'/data/tp',
		'/home/dev/cache',
		'/home/root/pp',
		'/node/v24',
		'/private/tmp/user',
		'/tmp/user'
	])
	assert.deepEqual(opts['allow-fs-write'].toSorted(), ['/home/dev/cache', '/private/tmp/user', '/tmp/user'])
})

test('container: tp and cache dirs are fixed, and serverconfig.json is not writable', () => {
	const ctx = fakeContext({
		env: { PP_MODE: 'container-prod' },
		files: { '/app/serverconfig.json': JSON.stringify({ tpmasterdir: '/host/tp', cachedir: '/host/cache' }) }
	})
	const opts = getNodeConfig(ctx).nodeOptions
	// the fixed tp dir is covered by the allowed /home/root/pp, and the mounted config's tp dir is not used
	assert.ok(opts['allow-fs-read'].includes('/home/root/pp'))
	assert.ok(!opts['allow-fs-read'].includes('/home/root/pp/tp'))
	assert.ok(!opts['allow-fs-read'].includes('/host/tp'))
	// app-server.mjs and app-full.mjs pass derived settings to the server instead of rewriting serverconfig.json
	assert.deepEqual(opts['allow-fs-write'].toSorted(), ['/home/root/pp/cache', '/home/root/pp/tp_write', '/tmp/user'])
})

test('container: a dir is listed before, and not after, its allowed subpaths', () => {
	// the permission model denies access to /home/root/pp itself when /home/root/pp/app/active is listed first
	const ctx = fakeContext({ env: { PP_MODE: 'container-prod' }, cwd: '/home/root/pp/app/active' })
	const read = getNodeConfig(ctx).nodeOptions['allow-fs-read']
	assert.ok(read.includes('/home/root/pp'))
	assert.ok(!read.some(p => p.startsWith('/home/root/pp/')))
})

test('prefix conflicts: paths that share a string prefix without one being under the other are reported', () => {
	const conflicts = findPrefixConflicts({
		nodeOptions: {
			'allow-fs-read': ['/app', '/data/tp'],
			'allow-fs-write': ['/home/root/pp/cache', '/home/root/pp/cachedir', '/tmp/user']
		}
	})
	assert.equal(conflicts.length, 1)
	assert.match(conflicts[0], /allow-fs-write paths '\/home\/root\/pp\/cache' and '\/home\/root\/pp\/cachedir'/)
	// the default container config has no conflicts
	const ctx = fakeContext({ env: { PP_MODE: 'container-prod' }, cwd: '/home/root/pp/app/active' })
	assert.deepEqual(findPrefixConflicts(getNodeConfig(ctx)), [])
})

test('covered paths: only ancestor dirs cover a path, not a path with the same string prefix', () => {
	const ctx = fakeContext({ env: { PP_ALLOW_FS_READ: '/app/sub:/apple:/app' } })
	const read = getNodeConfig(ctx).nodeOptions['allow-fs-read']
	assert.ok(read.includes('/app') && read.includes('/apple'))
	assert.ok(!read.includes('/app/sub'))
})

test('serverconfig.python is allowed when it is a path, since its existence is checked at startup', () => {
	const config = python => fakeContext({ files: { '/app/serverconfig.json': JSON.stringify({ python }) } })
	const read = python => getNodeConfig(config(python)).nodeOptions['allow-fs-read']
	assert.ok(read('/opt/venv/bin/python3').includes('/opt/venv/bin/python3'))
	// resolved from PATH when spawned
	assert.ok(!read('python3').some(p => p.endsWith('python3')))
})

test('case-insensitive file system: the inverted-case cwd is allowed for the tsx probe', () => {
	const ctx = fakeContext({ exists: ['/APP'] })
	assert.ok(getNodeConfig(ctx).nodeOptions['allow-fs-read'].includes('/APP'))
})

test('extra allowed paths from env override .env', () => {
	const ctx = fakeContext({
		env: { PP_ALLOW_FS_READ: '/r1:/r2' },
		files: { '/app/.env': 'PP_ALLOW_FS_READ=/ignored\nPP_ALLOW_FS_WRITE=/w1' }
	})
	const opts = getNodeConfig(ctx).nodeOptions
	assert.ok(opts['allow-fs-read'].includes('/r1') && opts['allow-fs-read'].includes('/r2'))
	assert.ok(!opts['allow-fs-read'].includes('/ignored'))
	assert.ok(opts['allow-fs-write'].includes('/w1'))
})

test('an explicitly empty env variable overrides its .env value', () => {
	const ctx = fakeContext({
		env: { PP_ALLOW_FS_READ: '', PP_CREDS_FILE: '' },
		files: { '/app/.env': 'PP_ALLOW_FS_READ=/stale\nPP_CREDS_FILE=/secrets/stale.json', '/secrets/stale.json': '{}' }
	})
	assert.ok(!getNodeConfig(ctx).nodeOptions['allow-fs-read'].includes('/stale'))
	assert.deepEqual(getCreds(ctx), {})
})

test('credentials: file contents from env or .env, an existing <NAME>_CREDS is not overwritten', () => {
	const ctx = fakeContext({
		env: { PP_CREDS_FILE: '/secrets/pp.json', PP_MMRF_CREDS: 'preset' },
		files: {
			'/app/.env': 'PP_X_CREDS_FILE="~/x.json"\nPP_MMRF_CREDS_FILE=/secrets/mmrf.json',
			'/secrets/pp.json': '{"a":1}',
			'/home/dev/x.json': '{"x":1}'
		}
	})
	assert.deepEqual(getCreds(ctx), { PP_CREDS: '{"a":1}', PP_X_CREDS: '{"x":1}' })
})

test('credentials: an existing but empty <NAME>_CREDS is not overwritten', () => {
	const ctx = fakeContext({
		env: { PP_CREDS_FILE: '/secrets/pp.json', PP_CREDS: '' },
		files: { '/secrets/pp.json': '{}' }
	})
	assert.deepEqual(getCreds(ctx), {})
})

test('credentials: an unreadable file throws', () => {
	const ctx = fakeContext({ env: { PP_CREDS_FILE: '/missing.json' } })
	assert.throws(() => getCreds(ctx), /ENOENT/)
})

test('credentials: a file under an allowed read path fails closed, before any file is written or read', t => {
	for (const [label, opts] of [
		['under the cwd', { env: { PP_CREDS_FILE: './creds.json' }, files: { '/app/creds.json': '{}' } }],
		[
			'under a container dir',
			{ env: { PP_MODE: 'container-prod', PP_CREDS_FILE: '/home/root/pp/secrets/c.json' }, files: {} }
		],
		[
			'a symlink that resolves under the cwd',
			{
				env: { PP_CREDS_FILE: '/secrets/link.json' },
				files: { '/secrets/link.json': '{}' },
				realpaths: { '/secrets/link.json': '/app/creds.json' }
			}
		],
		[
			'a differently-cased path in a case-insensitive file system',
			{ env: { PP_CREDS_FILE: '/APP/creds.json' }, exists: ['/APP'], files: { '/APP/creds.json': '{}' } }
		]
	]) {
		const ctx = fakeContext(opts)
		assert.throws(
			() => runInProcess(t, ['node', 'app.mjs'], ctx),
			/PP_CREDS_FILE=.* must not be under an allowed read path/,
			label
		)
		assert.deepEqual(ctx.written, {}, label)
		assert.equal(ctx.spawned.length, 0, label)
		assert.equal(ctx.execved.length, 0, label)
	}
})

test('router: the permission flags or config file flag are inserted where node or tsx parses them as options', t => {
	const flags = permissionFlags(getNodeConfig(fakeContext()))
	for (const [args, expected] of [
		[
			['node', 'app.mjs'],
			['node', ...flags, 'app.mjs']
		],
		[
			['/usr/bin/node', '--enable-source-maps', 'app.mjs'],
			['/usr/bin/node', ...flags, '--enable-source-maps', 'app.mjs']
		],
		[
			['tsx', 'watch', 'server.ts'],
			['tsx', 'watch', '--experimental-default-config-file', 'server.ts']
		],
		[
			['./node_modules/.bin/tsx', 'server.ts', 'validate'],
			['./node_modules/.bin/tsx', '--experimental-default-config-file', 'server.ts', 'validate']
		]
	]) {
		const ctx = fakeContext()
		t.mock.method(console, 'error', () => {})
		runInProcess(t, args, ctx)
		// a node command replaces this process, and a tsx command runs as a child process
		const actual = ctx.execved.length ? ctx.execved[0].args : [ctx.spawned[0].cmd, ...ctx.spawned[0].args]
		assert.deepEqual(actual, expected)
		// only a tsx command has a config file
		assert.deepEqual(Object.keys(ctx.written), path.basename(args[0]) == 'tsx' ? ['/app/node.config.json'] : [])
	}
})

test('permissionFlags(): one flag per allowed path, and a flag for each enabled option', () => {
	const config = {
		nodeOptions: { permission: true, 'allow-fs-read': ['/a', '/b,c'], 'allow-fs-write': ['/w'], 'allow-worker': true }
	}
	assert.deepEqual(permissionFlags(config), [
		'--permission',
		'--allow-fs-read=/a',
		'--allow-fs-read=/b,c',
		'--allow-fs-write=/w',
		'--allow-worker'
	])
})

test('tsx: the config file is written in PP_NODE_CONFIG_DIR when it is set, and passed by name', t => {
	t.mock.method(console, 'error', () => {})
	const ctx = fakeContext({ env: { PP_NODE_CONFIG_DIR: '/run/pp' } })
	runInProcess(t, ['tsx', 'watch', 'server.ts'], ctx)
	assert.deepEqual(Object.keys(ctx.written), ['/run/pp/node.config.json'])
	assert.deepEqual(ctx.spawned[0].args, ['watch', '--experimental-config-file=/run/pp/node.config.json', 'server.ts'])
})

test('the allowed paths are logged to stderr', t => {
	const error = t.mock.method(console, 'error', () => {})
	const ctx = fakeContext()
	runInProcess(t, ['node', 'app.mjs'], ctx)
	const { nodeOptions } = getNodeConfig(ctx)
	assert.deepEqual(
		error.mock.calls.map(c => c.arguments[0]),
		[
			`envHelpers.mjs: allow-fs-read ${nodeOptions['allow-fs-read'].join(' ')}`,
			`envHelpers.mjs: allow-fs-write ${nodeOptions['allow-fs-write'].join(' ')}`
		]
	)
})

test('router: process.execve() is called with a node path, since it does not search PATH', t => {
	for (const [cmd, file] of [
		['node', '/node/v24/bin/node'],
		['/usr/bin/node', '/usr/bin/node']
	]) {
		const ctx = fakeContext()
		runInProcess(t, [cmd, 'app.mjs'], ctx)
		assert.equal(ctx.execved[0].file, file)
		assert.equal(ctx.spawned.length, 0)
	}
})

test('router: other commands are rejected before any file is written', () => {
	const ctx = fakeContext()
	assert.throws(() => envHelpers(['sh', '-c', 'true'], ctx.deps), /must be node or tsx/)
	assert.deepEqual(ctx.written, {})
})

test('refuses to run with the permission model, before any file access', () => {
	const failOnAccess = new Proxy({}, { get: (_, k) => () => assert.fail(`unexpected fs.${String(k)}()`) })
	assert.throws(
		() => envHelpers(['node', 'app.mjs'], { hasPermissionModel: true, fs: failOnAccess }),
		/must not run with the permission model/
	)
})

test('writes node.config.json, and a node command replaces this process with credentials only in a handoff file', t => {
	const ctx = fakeContext({
		env: {
			PP_CREDS_FILE: '/secrets/pp.json',
			PP_MMRF_CREDS: 'm',
			PP_CREDS_HANDOFF_FILE: '/tmp/other.json',
			PP_MODE: 'container-prod'
		},
		files: { '/secrets/pp.json': '{"a":1}' }
	})
	runInProcess(t, ['node', 'app.mjs'], ctx)
	// the permission model is from the flags, not a config file
	assert.equal(ctx.execved[0].args[1], '--permission')
	assert.equal(ctx.written['/app/node.config.json'], undefined)
	const handoff = '/tmp/user/pp-creds-XXXXXX/creds.json'
	// both a <NAME>_CREDS_FILE content and an existing <NAME>_CREDS env variable
	assert.deepEqual(ctx.written[handoff], {
		content: JSON.stringify({ PP_MMRF_CREDS: 'm', PP_CREDS: '{"a":1}' }),
		opts: { mode: 0o600, flag: 'wx' }
	})
	assert.equal(ctx.execved.length, 1)
	// an existing PP_CREDS_HANDOFF_FILE is replaced, and no <NAME>_CREDS is in the initial env
	assert.deepEqual(ctx.execved[0].env, {
		PP_CREDS_FILE: '/secrets/pp.json',
		PP_MODE: 'container-prod',
		PP_CREDS_HANDOFF_FILE: handoff
	})
	assert.equal(ctx.spawned.length, 0)
	assert.equal(ctx.env.PP_CREDS, undefined)
	assert.deepEqual(ctx.removed, [])
})

test('without credentials, a node command has no handoff file', t => {
	const ctx = fakeContext({ env: { PP_CREDS_HANDOFF_FILE: '/tmp/other.json' } })
	runInProcess(t, ['node', 'app.mjs'], ctx)
	assert.equal('PP_CREDS_HANDOFF_FILE' in ctx.execved[0].env, false)
	assert.deepEqual(Object.keys(ctx.written), [])
})

test('the handoff dir is removed when process.execve() fails', t => {
	const ctx = fakeContext({
		env: { PP_CREDS: '{"a":1}' },
		execve: () => {
			throw new Error('execve failed')
		}
	})
	assert.throws(() => runInProcess(t, ['node', 'app.mjs'], ctx), /execve failed/)
	assert.deepEqual(ctx.removed, [{ p: '/tmp/user/pp-creds-XXXXXX', opts: { recursive: true, force: true } }])
})

test('a tsx command runs as a child process with credentials in its env, since tsx watch reloads the server', t => {
	const ctx = fakeContext({
		env: { PP_CREDS_FILE: '/secrets/pp.json' },
		files: { '/secrets/pp.json': '{"a":1}' }
	})
	runInProcess(t, ['tsx', 'watch', 'server.ts'], ctx)
	assert.equal(ctx.execved.length, 0)
	assert.equal(ctx.spawned[0].opts.env.PP_CREDS, '{"a":1}')
	assert.equal(ctx.env.PP_CREDS, undefined)
})

test('a node command in watch mode runs as a child process with credentials in its env, since it restarts the server', t => {
	for (const args of [
		['node', '--watch', 'app.mjs'],
		['node', '--watch-path=./src', 'app.mjs'],
		['node', '--watch-path', './src', 'app.mjs']
	]) {
		const ctx = fakeContext({ env: { PP_CREDS: '{"a":1}' } })
		runInProcess(t, args, ctx)
		assert.equal(ctx.execved.length, 0, args.join(' '))
		assert.equal(ctx.spawned[0].opts.env.PP_CREDS, '{"a":1}', args.join(' '))
		assert.equal('PP_CREDS_HANDOFF_FILE' in ctx.spawned[0].opts.env, false, args.join(' '))
	}
})

test('without process.execve(), a node command runs as a child process with a warning', t => {
	const ctx = fakeContext({ env: { PP_CREDS: '{"a":1}' }, execve: null })
	const warnings = []
	t.mock.method(console, 'warn', m => warnings.push(m))
	runInProcess(t, ['node', 'app.mjs'], ctx)
	assert.match(warnings.join('\n'), /process\.execve\(\) is not supported/)
	assert.equal(ctx.spawned[0].opts.env.PP_CREDS, '{"a":1}')
})

test('smoke: the command replaces this process, with the permission model and credentials, and its exit code propagates', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envHelpers-smoke-'))
	// the handoff dir is created in os.tmpdir(), which is set here to check that the command can remove it
	const tmpdir = path.join(dir, 'tmp')
	// the credentials file must not be under an allowed read path, such as the cwd or OS temp dir
	const credsFile = path.join(import.meta.dirname, `.smoke-creds-${process.pid}.json`)
	try {
		fs.mkdirSync(tmpdir)
		fs.writeFileSync(credsFile, '{"a":1}')
		// reads and removes the handoff file like server/src/serverconfig.js
		const child = `
			const fs = require('fs')
			let canReadCredsFile = true
			try { fs.readFileSync(${JSON.stringify(credsFile)}) } catch { canReadCredsFile = false }
			const file = process.env.PP_CREDS_HANDOFF_FILE
			const handoff = JSON.parse(fs.readFileSync(file, 'utf8'))
			fs.rmSync(require('path').dirname(file), { recursive: true })
			const envCreds = Object.keys(process.env).filter(k => k.endsWith('_CREDS'))
			console.log(JSON.stringify({ permission: !!process.permission, handoff, envCreds, canReadCredsFile, pid: process.pid }))
			process.exit(3)`
		const ps = spawnSync(process.execPath, [SCRIPT, 'node', '-e', child], {
			cwd: dir,
			encoding: 'utf8',
			env: { ...process.env, TMPDIR: tmpdir, PP_CREDS_FILE: credsFile, PP_ZZTEST_CREDS: 'z' }
		})
		assert.equal(ps.status, 3, ps.stderr)
		assert.deepEqual(JSON.parse(ps.stdout), {
			permission: true,
			handoff: { PP_ZZTEST_CREDS: 'z', PP_CREDS: '{"a":1}' },
			envCreds: [],
			canReadCredsFile: false,
			// the envHelpers.mjs process that spawnSync() started, which process.execve() replaced
			pid: ps.pid
		})
		// a node command gets the permission model from flags, so no config file is written
		assert.equal(fs.existsSync(path.join(dir, 'node.config.json')), false)
		assert.match(ps.stderr, /envHelpers\.mjs: allow-fs-read /)
		assert.deepEqual(fs.readdirSync(tmpdir), [], 'the command should be able to remove the handoff dir')
	} finally {
		fs.rmSync(dir, { recursive: true })
		fs.rmSync(credsFile, { force: true })
	}
})

test('smoke: node --watch restarts the command with the credentials', async () => {
	// resolved, since node resolves the script path, which the permission model denies through a symlinked dir,
	// such as /var/folders/... in macOS
	const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'envHelpers-smoke-'))
	// the watched script edits itself to be restarted once, so it must be under an allowed write path
	const tmpdir = path.join(dir, 'tmp')
	const script = path.join(tmpdir, 'watched.cjs')
	try {
		fs.mkdirSync(tmpdir)
		fs.writeFileSync(
			script,
			`const fs = require('fs')
			const restarted = fs.existsSync(__filename + '.started')
			console.log(JSON.stringify({ restarted, creds: process.env.PP_CREDS ?? null }))
			if (!restarted) {
				fs.writeFileSync(__filename + '.started', '')
				fs.appendFileSync(__filename, '\\n')
			}`
		)
		const child = spawn(process.execPath, [SCRIPT, 'node', '--watch', script], {
			cwd: dir,
			env: { ...process.env, TMPDIR: tmpdir, PP_CREDS: '{"a":1}' }
		})
		const runs = []
		let stdout = ''
		let stderr = ''
		child.stderr.on('data', data => (stderr += data))
		const done = new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error(`no restart within 20s, stdout: ${stdout}, stderr: ${stderr}`)),
				20000
			)
			// the last line of a chunk may be unfinished, and is completed by a later chunk
			let unfinished = ''
			child.stdout.on('data', data => {
				stdout += data
				const lines = (unfinished + data).split('\n')
				unfinished = lines.pop()
				for (const line of lines) {
					if (line.startsWith('{')) runs.push(line)
				}
				if (runs.length >= 2) {
					clearTimeout(timeout)
					resolve()
				}
			})
		})
		try {
			await done
		} finally {
			child.kill()
		}
		assert.deepEqual(runs.map(JSON.parse), [
			{ restarted: false, creds: '{"a":1}' },
			{ restarted: true, creds: '{"a":1}' }
		])
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test('smoke: a flag in the envHelpers.mjs arguments is rejected with a non-zero exit', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envHelpers-smoke-'))
	try {
		fs.writeFileSync(path.join(dir, 'node.config.json'), '{"nodeOptions":{"permission":true}}')
		const ps = spawnSync(process.execPath, [SCRIPT, 'node', '--experimental-default-config-file', '-e', '1'], {
			cwd: dir,
			encoding: 'utf8'
		})
		assert.equal(ps.status, 1, ps.stderr)
		assert.match(ps.stderr, /must not run with the permission model/)
	} finally {
		fs.rmSync(dir, { recursive: true })
	}
})

// a context from a fake fs and spawn that FAIL CLOSED: reading an unmodeled file throws ENOENT,
// and only <cwd>/node.config.json may be written; ctx.deps is for calling envHelpers(args, deps)
function fakeContext({ env = {}, files = {}, exists = [], realpaths = {}, cwd = '/app', execve, posture } = {}) {
	const written = {}
	const postureCalls = []
	const spawned = []
	const execved = []
	const removed = []
	const fakeFs = {
		existsSync: p => p in files || exists.includes(p),
		readFileSync: p => {
			if (p in files) return files[p]
			throw Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT' })
		},
		realpathSync: p => {
			if (p in realpaths) return realpaths[p]
			throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
		},
		writeFileSync: (p, content, opts) => {
			// or the credentials handoff file in a dir from mkdtempSync()
			if (
				p != path.join(cwd, 'node.config.json') &&
				p != '/run/pp/node.config.json' &&
				p != '/tmp/user/pp-creds-XXXXXX/creds.json'
			)
				throw new Error(`unexpected write: ${p}`)
			written[p] = opts ? { content, opts } : content
		},
		mkdtempSync: prefix => prefix + 'XXXXXX',
		rmSync: (p, opts) => removed.push({ p, opts })
	}
	const fakeSpawn = (cmd, args, opts) => {
		spawned.push({ cmd, args, opts })
		return Object.assign(new EventEmitter(), { kill: () => {} })
	}
	const fakeExecve = (file, args, env) => execved.push({ file, args, env })
	const deps = {
		fs: fakeFs,
		spawn: fakeSpawn,
		execve: execve === undefined ? fakeExecve : execve,
		env,
		cwd,
		execPath: '/node/v24/bin/node',
		tmpdir: '/tmp/user',
		homedir: '/home/dev',
		hasPermissionModel: false,
		checkPosture: opts => {
			postureCalls.push(opts)
			if (posture instanceof Error) throw posture
			return posture || { warnings: [], unchecked: [] }
		}
	}
	return Object.assign(createContext(deps), { deps, written, spawned, execved, removed, postureCalls })
}

test('container: the runtime settings are checked with the allowed write dirs that exist, and warnings are logged', t => {
	const warn = t.mock.method(console, 'warn', () => {})
	const ctx = fakeContext({
		env: { PP_MODE: 'container-prod' },
		exists: ['/home/root/pp/cache', '/tmp/user'],
		posture: { warnings: ['the root filesystem is writable, mount it read-only'], unchecked: [] }
	})
	runInProcess(t, ['node', 'app.mjs'], ctx)
	assert.equal(ctx.postureCalls.length, 1)
	assert.equal(ctx.postureCalls[0].tmpdir, '/tmp/user')
	// /home/root/pp/tp_write is also allowed, but is skipped since it does not exist
	assert.deepEqual(ctx.postureCalls[0].writableDirs.toSorted(), ['/home/root/pp/cache', '/tmp/user'])
	assert.deepEqual(
		warn.mock.calls.map(c => c.arguments[0]),
		['runtimePosture.mjs: WARNING the root filesystem is writable, mount it read-only']
	)
	assert.equal(ctx.execved.length, 1, 'the server still starts')
})

test('dev: the runtime settings are not checked', t => {
	const ctx = fakeContext({ files: { '/secrets/pp.json': '{}' } })
	runInProcess(t, ['node', 'app.mjs'], ctx)
	assert.equal(ctx.postureCalls.length, 0)
	assert.equal(ctx.execved.length, 1)
})

test('container: an error from the runtime settings check is logged, and the server still starts', t => {
	const warn = t.mock.method(console, 'warn', () => {})
	const ctx = fakeContext({ env: { PP_MODE: 'container-prod' }, posture: new Error('boom') })
	runInProcess(t, ['node', 'app.mjs'], ctx)
	assert.deepEqual(
		warn.mock.calls.map(c => c.arguments[0]),
		['envHelpers.mjs: WARNING unable to check the runtime settings: boom']
	)
	assert.equal(ctx.execved.length, 1)
})

// runs envHelpers() with the fake context, and removes the signal listeners that it adds to this test process
function runInProcess(t, args, ctx) {
	const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
	const before = new Map(signals.map(s => [s, process.listeners(s)]))
	t.after(() => {
		for (const s of signals) {
			for (const listener of process.listeners(s)) if (!before.get(s).includes(listener)) process.off(s, listener)
		}
	})
	return envHelpers(args, ctx.deps)
}

// In-process tests for envHelpers.mjs, using a fake fs and spawn injected via createContext(),
// plus a couple of subprocess smoke tests for the CLI entry wiring and exit code propagation.
// run: node --test container/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { envHelpers, createContext, getNodeConfig, getCreds } from '../envHelpers.mjs'

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

test('container: tp and cache dirs are fixed, and serverconfig.json is writable', () => {
	const ctx = fakeContext({
		env: { PP_MODE: 'container-prod' },
		files: { '/app/serverconfig.json': JSON.stringify({ tpmasterdir: '/host/tp', cachedir: '/host/cache' }) }
	})
	const opts = getNodeConfig(ctx, ['node', '--experimental-default-config-file', 'app-full.mjs']).nodeOptions
	// the fixed tp dir is covered by the allowed /home/root/pp, and the mounted config's tp dir is not used
	assert.ok(opts['allow-fs-read'].includes('/home/root/pp'))
	assert.ok(!opts['allow-fs-read'].includes('/home/root/pp/tp'))
	assert.ok(!opts['allow-fs-read'].includes('/host/tp'))
	assert.deepEqual(opts['allow-fs-write'].toSorted(), ['/app/serverconfig.json', '/home/root/pp/cache', '/tmp/user'])
})

test('container: a dir is listed before, and not after, its allowed subpaths', () => {
	// the permission model denies access to /home/root/pp itself when /home/root/pp/app/active is listed first
	const ctx = fakeContext({ env: { PP_MODE: 'container-prod' }, cwd: '/home/root/pp/app/active' })
	const read = getNodeConfig(ctx).nodeOptions['allow-fs-read']
	assert.ok(read.includes('/home/root/pp'))
	assert.ok(!read.some(p => p.startsWith('/home/root/pp/')))
})

test('covered paths: only ancestor dirs cover a path, not a path with the same string prefix', () => {
	const ctx = fakeContext({ env: { PP_ALLOW_FS_READ: '/app/sub:/apple:/app' } })
	const read = getNodeConfig(ctx).nodeOptions['allow-fs-read']
	assert.ok(read.includes('/app') && read.includes('/apple'))
	assert.ok(!read.includes('/app/sub'))
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

test('serverconfig.json is writable only for the app-*.mjs container entry scripts, with or without PP_MODE', () => {
	const ctx = fakeContext()
	assert.ok(
		getNodeConfig(ctx, ['node', 'app-server.mjs']).nodeOptions['allow-fs-write'].includes('/app/serverconfig.json')
	)
	assert.ok(
		!getNodeConfig(ctx, ['tsx', 'watch', 'server.ts']).nodeOptions['allow-fs-write'].includes('/app/serverconfig.json')
	)
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

test('router: the config flag is inserted where node or tsx parses it as an option', t => {
	for (const [args, expected] of [
		[
			['node', 'app.mjs'],
			['node', '--experimental-default-config-file', 'app.mjs']
		],
		[
			['/usr/bin/node', '--enable-source-maps', 'app.mjs'],
			['/usr/bin/node', '--experimental-default-config-file', '--enable-source-maps', 'app.mjs']
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
		runInProcess(t, args, ctx)
		assert.deepEqual([ctx.spawned[0].cmd, ...ctx.spawned[0].args], expected)
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

test('writes node.config.json and passes credentials only in the child env', t => {
	const ctx = fakeContext({
		env: { PP_CREDS_FILE: '/secrets/pp.json' },
		files: { '/secrets/pp.json': '{"a":1}' }
	})
	runInProcess(t, ['node', 'app.mjs'], ctx)
	const written = JSON.parse(ctx.written['/app/node.config.json'])
	// newer node versions reject any other top-level key
	assert.deepEqual(Object.keys(written), ['nodeOptions'])
	assert.equal(written.nodeOptions.permission, true)
	assert.equal(ctx.spawned[0].opts.env.PP_CREDS, '{"a":1}')
	assert.equal(ctx.env.PP_CREDS, undefined)
})

test('smoke: the child runs with the permission model and credentials, and its exit code propagates', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envHelpers-smoke-'))
	try {
		fs.writeFileSync(path.join(dir, 'creds.json'), '{"a":1}')
		const child = `console.log(JSON.stringify({ permission: !!process.permission, creds: process.env.PP_CREDS })); process.exit(3)`
		const ps = spawnSync(process.execPath, [SCRIPT, 'node', '-e', child], {
			cwd: dir,
			encoding: 'utf8',
			env: { ...process.env, PP_CREDS_FILE: path.join(dir, 'creds.json') }
		})
		assert.equal(ps.status, 3, ps.stderr)
		assert.deepEqual(JSON.parse(ps.stdout), { permission: true, creds: '{"a":1}' })
		assert.ok(fs.existsSync(path.join(dir, 'node.config.json')))
	} finally {
		fs.rmSync(dir, { recursive: true })
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
function fakeContext({ env = {}, files = {}, exists = [], realpaths = {}, cwd = '/app' } = {}) {
	const written = {}
	const spawned = []
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
		writeFileSync: (p, content) => {
			if (p != path.join(cwd, 'node.config.json')) throw new Error(`unexpected write: ${p}`)
			written[p] = content
		}
	}
	const fakeSpawn = (cmd, args, opts) => {
		spawned.push({ cmd, args, opts })
		return Object.assign(new EventEmitter(), { kill: () => {} })
	}
	const deps = {
		fs: fakeFs,
		spawn: fakeSpawn,
		env,
		cwd,
		execPath: '/node/v24/bin/node',
		tmpdir: '/tmp/user',
		homedir: '/home/dev',
		hasPermissionModel: false
	}
	return Object.assign(createContext(deps), { deps, written, spawned })
}

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

import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { builtinModules } from 'module'

/*
test sections:

the same PP_CACHEID_CREDS derives the same names, and is deleted from process.env
a generated key derives different names per process
the cache dir name cannot be produced by generateHash
serverconfig.hideCachedir uses a derived subdir of the configured cachedir
PP_CACHEID_CREDS is removed from process.env without hideCachedir
a later copy of serverconfig.js does not set up a cache subdir, and has no cachedir
serverconfig.js imports only native modules

Each test imports serverconfig.js with a unique query string, which evaluates a new copy of that module, as if it
were the first copy in a process unless keepFirstLoad is set.
*/

const HEX32 = /^[0-9a-f]{32}$/
const firstLoadFlag = Symbol.for('proteinpaint.serverconfig.firstLoad')
const tmpdirs: string[] = []

type LoadOpts = { key?: string; hide?: boolean; keepFirstLoad?: boolean; parent?: string }

/** returns a new copy of serverconfig.js, and the parent of its cache subdir when hide is set */
async function load(tag: string, opts: LoadOpts = {}) {
	const parent = opts.parent || fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cachekey-'))
	if (!opts.parent) tmpdirs.push(parent)
	const env = { overrides: process.env.PP_SERVERCONFIG_OVERRIDES }
	const warn = console.warn
	const warnings: string[] = []
	console.warn = (...args) => warnings.push(args.join(' '))
	if (!opts.keepFirstLoad) delete (globalThis as any)[firstLoadFlag]
	if (opts.key === undefined) delete process.env.PP_CACHEID_CREDS
	else process.env.PP_CACHEID_CREDS = opts.key
	if (opts.hide) process.env.PP_SERVERCONFIG_OVERRIDES = JSON.stringify({ cachedir: parent, hideCachedir: true })
	try {
		const m = await import(`#src/serverconfig.js?${tag}`)
		return { sc: m.default, generateHash: m.generateHash, parent, warnings }
	} finally {
		console.warn = warn
		delete process.env.PP_CACHEID_CREDS
		if (env.overrides === undefined) delete process.env.PP_SERVERCONFIG_OVERRIDES
		else process.env.PP_SERVERCONFIG_OVERRIDES = env.overrides
	}
}

tape('\n', t => {
	t.comment('-***- src/serverconfig cache key -***-')
	t.end()
})

tape('the same PP_CACHEID_CREDS derives the same names, and is deleted from process.env', async t => {
	process.env.PP_CACHEID_CREDS = 'test-only-a'
	const a = await load('same-a', { key: 'test-only-a', hide: true })
	t.equal('PP_CACHEID_CREDS' in process.env, false, 'PP_CACHEID_CREDS is deleted from process.env')
	const b = await load('same-b', { key: 'test-only-a', hide: true })
	const c = await load('same-c', { key: 'test-only-c', hide: true })

	const args = { x: 1 }
	t.equal(a.generateHash(args), b.generateHash(args), 'same key, same cacheId')
	t.notEqual(a.generateHash(args), c.generateHash(args), 'different key, different cacheId')
	const nameA = path.basename(a.sc.cachedir)
	t.match(nameA, HEX32, 'the cache dir name is 32 hex chars')
	t.equal(nameA, path.basename(b.sc.cachedir), 'same key, same cache dir name')
	t.notEqual(nameA, path.basename(c.sc.cachedir), 'different key, different cache dir name')
	t.equal(
		a.warnings.some(w => w.includes('is not set')),
		false,
		'no warning about a generated key'
	)
	t.end()
})

tape('a generated key derives different names per process', async t => {
	const a = await load('random-a', { hide: true })
	const b = await load('random-b', { hide: true })
	t.notEqual(a.generateHash({ x: 1 }), b.generateHash({ x: 1 }), 'each process gets its own cacheIds')
	t.notEqual(path.basename(a.sc.cachedir), path.basename(b.sc.cachedir), 'each process gets its own cache dir name')
	t.ok(
		a.warnings.some(w => w.includes('is not set')),
		'warns that the cache dir name is generated for this process only'
	)
	t.end()
})

tape('the cache dir name cannot be produced by generateHash', async t => {
	const { sc, generateHash } = await load('domain', { key: 'test-only-domain', hide: true })
	const name = path.basename(sc.cachedir)
	for (const args of ['cachedir', ['cachedir'], { cachedir: 1 }]) {
		t.notEqual(generateHash(args), name, `generateHash(${JSON.stringify(args)}) differs from the dir name`)
	}
	t.end()
})

tape('serverconfig.hideCachedir uses a derived subdir of the configured cachedir', async t => {
	const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-hidecache-'))
	tmpdirs.push(parent)
	// entries of the earlier layout, and a subdir that another key would derive
	fs.mkdirSync(path.join(parent, 'massSession'))
	fs.writeFileSync(path.join(parent, 'massSession', 'saved'), '{}')
	fs.writeFileSync(path.join(parent, 'tmpfile'), 'x')
	const otherKeyDir = path.join(parent, 'a'.repeat(32))
	fs.mkdirSync(otherKeyDir)

	const { sc, warnings } = await load('hidecache', { key: 'test-only-hide', hide: true, parent })
	t.equal(path.dirname(sc.cachedir), parent, 'cachedir is a subdir of the configured cachedir')
	t.match(path.basename(sc.cachedir), HEX32, 'the subdir name is derived')
	t.equal(fs.statSync(sc.cachedir).mode & 0o777, 0o700, 'the subdir is only accessible by the server user')
	t.equal('hideCachedir' in sc, false, 'hideCachedir is deleted from serverconfig')
	t.ok(
		fs.existsSync(path.join(sc.cachedir, 'massSession', 'saved')),
		'an earlier cache subdir is moved into the subdir'
	)
	t.ok(fs.existsSync(path.join(sc.cachedir, 'tmpfile')), 'an earlier cache file is moved into the subdir')
	t.deepEqual(
		fs.readdirSync(parent).sort(),
		[path.basename(otherKeyDir), path.basename(sc.cachedir)].sort(),
		'only the derived subdirs are left in the configured cachedir'
	)
	t.ok(
		warnings.some(w => w.includes('can be listed')),
		'warns that a parent dir which the server user can list does not hide the subdir name'
	)
	t.equal(
		warnings.some(w => w.includes(path.basename(sc.cachedir))),
		false,
		'the subdir name is not in any warning'
	)
	t.end()
})

tape('PP_CACHEID_CREDS is removed from process.env without hideCachedir', async t => {
	process.env.PP_CACHEID_CREDS = 'test-only-unhidden'
	await import(`#src/serverconfig.js?${'unhidden'}`)
	t.equal('PP_CACHEID_CREDS' in process.env, false, 'removed when serverconfig.js is loaded, before any request')
	delete process.env.PP_CACHEID_CREDS
	t.end()
})

tape('a later copy of serverconfig.js does not set up a cache subdir, and has no cachedir', async t => {
	const first = await load('first-copy', { key: 'test-only-copies', hide: true })
	const before = fs.readdirSync(first.parent).sort()
	// the env value was removed by the first copy, as in a server process
	const later = await load('later-copy', { hide: true, keepFirstLoad: true, parent: first.parent })
	t.equal('cachedir' in later.sc, false, 'the later copy has no cachedir')
	t.deepEqual(fs.readdirSync(first.parent).sort(), before, 'the later copy does not add a subdir')
	t.equal(
		later.warnings.some(w => w.includes('is not set') || w.includes('can be listed')),
		false,
		'the later copy does not warn about the cache subdir'
	)
	t.end()
})

tape('serverconfig.js imports only native modules', t => {
	const file = path.join(import.meta.dirname, '../serverconfig.js')
	const code = fs.readFileSync(file, 'utf8')
	const specifiers = [...code.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1])
	t.ok(specifiers.length, 'found the import statements')
	const native = new Set(builtinModules)
	const other = specifiers.filter(s => !native.has(s.replace(/^node:/, '')))
	t.deepEqual(other, [], 'every import is a native module, since this file is also loaded unbundled from the package')
	t.end()
})

tape('cleanup', t => {
	for (const d of tmpdirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
	// leave the flag as a server process would have it, for the later spec files
	Object.defineProperty(globalThis, firstLoadFlag, { value: true, configurable: true })
	t.end()
})

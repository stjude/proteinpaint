import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'

/*
test sections:

the same PP_CACHEID_CREDS derives the same names, and is deleted from process.env
a generated key is not persistent, and derives different names per module instance
takeCacheDirName returns the name only once
the cache dir name cannot be produced by generateHash
serverconfig.hideCachedir uses a derived subdir of the configured cachedir
serverconfig.js removes PP_CACHEID_CREDS from process.env without hideCachedir

Each test imports cacheKey.ts with a unique query string, which evaluates a new instance of that module,
since the key is read once per module instance.
*/

const HEX32 = /^[0-9a-f]{32}$/

async function loadCacheKey(tag: string, value?: string) {
	if (value === undefined) delete process.env.PP_CACHEID_CREDS
	else process.env.PP_CACHEID_CREDS = value
	try {
		const m = await import(`#src/utils/cacheKey.ts?${tag}`)
		// the key is read on first use
		const persistent = m.hasPersistentKey()
		return { m, persistent }
	} finally {
		delete process.env.PP_CACHEID_CREDS
	}
}

tape('\n', t => {
	t.comment('-***- src/utils/cacheKey -***-')
	t.end()
})

tape('the same PP_CACHEID_CREDS derives the same names, and is deleted from process.env', async t => {
	process.env.PP_CACHEID_CREDS = 'test-only-a'
	const a = await import(`#src/utils/cacheKey.ts?${'same-a'}`)
	t.equal(a.hasPersistentKey(), true, 'a key from PP_CACHEID_CREDS is persistent')
	t.equal('PP_CACHEID_CREDS' in process.env, false, 'PP_CACHEID_CREDS is deleted from process.env once read')
	const { m: b } = await loadCacheKey('same-b', 'test-only-a')
	const { m: c } = await loadCacheKey('same-c', 'test-only-c')

	const args = { x: 1 }
	t.equal(a.generateHash(args), b.generateHash(args), 'same key, same cacheId')
	t.notEqual(a.generateHash(args), c.generateHash(args), 'different key, different cacheId')
	const nameA = a.takeCacheDirName()
	t.match(nameA, HEX32, 'the cache dir name is 32 hex chars')
	t.equal(nameA, b.takeCacheDirName(), 'same key, same cache dir name')
	t.notEqual(nameA, c.takeCacheDirName(), 'different key, different cache dir name')
	t.end()
})

tape('a generated key is not persistent, and derives different names per module instance', async t => {
	const { m: a, persistent } = await loadCacheKey('random-a')
	const { m: b } = await loadCacheKey('random-b')
	t.equal(persistent, false, 'a generated key is not persistent')
	t.notEqual(a.takeCacheDirName(), b.takeCacheDirName(), 'each process gets its own cache dir name')
	t.end()
})

tape('takeCacheDirName returns the name only once', async t => {
	const { m } = await loadCacheKey('once', 'test-only-once')
	m.takeCacheDirName()
	t.throws(() => m.takeCacheDirName(), /already taken/, 'a second call throws')
	t.end()
})

tape('the cache dir name cannot be produced by generateHash', async t => {
	const { m: a } = await loadCacheKey('domain-a', 'test-only-domain')
	const { m: b } = await loadCacheKey('domain-b', 'test-only-domain')
	const name = a.takeCacheDirName()
	for (const args of ['cachedir', ['cachedir'], { cachedir: 1 }]) {
		t.notEqual(b.generateHash(args), name, `generateHash(${JSON.stringify(args)}) differs from the dir name`)
	}
	t.end()
})

tape('serverconfig.hideCachedir uses a derived subdir of the configured cachedir', async t => {
	const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-hidecache-'))
	const overrides = process.env.PP_SERVERCONFIG_OVERRIDES
	const warn = console.warn
	const warnings: string[] = []
	console.warn = (...args) => warnings.push(args.join(' '))
	process.env.PP_SERVERCONFIG_OVERRIDES = JSON.stringify({ cachedir: parent, hideCachedir: true })
	// entries of the earlier layout, and a subdir that another key would derive
	fs.mkdirSync(path.join(parent, 'massSession'))
	fs.writeFileSync(path.join(parent, 'massSession', 'saved'), '{}')
	fs.writeFileSync(path.join(parent, 'tmpfile'), 'x')
	const otherKeyDir = path.join(parent, 'a'.repeat(32))
	fs.mkdirSync(otherKeyDir)
	try {
		const { default: sc } = await import(`#src/serverconfig.js?${'hidecache'}`)
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
		t.equal(path.dirname(sc.cachedir), parent, 'cachedir is a subdir of the configured cachedir')
		t.match(path.basename(sc.cachedir), HEX32, 'the subdir name is derived')
		t.equal(fs.statSync(sc.cachedir).mode & 0o777, 0o700, 'the subdir is only accessible by the server user')
		t.equal('hideCachedir' in sc, false, 'hideCachedir is deleted from serverconfig')
		t.ok(
			warnings.some(w => w.includes('can be listed')),
			'warns that a parent dir which the server user can list does not hide the subdir name'
		)
		t.equal(
			warnings.some(w => w.includes(path.basename(sc.cachedir))),
			false,
			'the subdir name is not in any warning'
		)
	} finally {
		console.warn = warn
		if (overrides === undefined) delete process.env.PP_SERVERCONFIG_OVERRIDES
		else process.env.PP_SERVERCONFIG_OVERRIDES = overrides
		fs.rmSync(parent, { recursive: true, force: true })
	}
	t.end()
})

tape('serverconfig.js removes PP_CACHEID_CREDS from process.env without hideCachedir', async t => {
	process.env.PP_CACHEID_CREDS = 'test-only-unhidden'
	try {
		await import(`#src/serverconfig.js?${'unhidden'}`)
		t.equal('PP_CACHEID_CREDS' in process.env, false, 'removed when serverconfig.js is loaded, before any request')
	} finally {
		delete process.env.PP_CACHEID_CREDS
	}
	t.end()
})

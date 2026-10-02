// In-process tests for runtimePosture.mjs, using a fake fs with fake /proc files.
// run: node --test container/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { checkRuntimePosture, logRuntimePosture, parseMountinfo, findMount } from '../runtimePosture.mjs'

const SCRIPT = path.join(import.meta.dirname, '../runtimePosture.mjs')

const hardenedStatus = 'Name:\tnode\nCapEff:\t0000000000000000\nNoNewPrivs:\t1\n'
const hardenedMounts = [
	'1 0 0:1 / / ro,relatime - overlay overlay rw',
	'2 1 0:2 / /tmp rw,nosuid,nodev,noexec - tmpfs tmpfs rw',
	'3 1 0:3 /cache /home/root/pp/cache rw,nosuid,nodev,noexec - xfs /dev/sda1 rw'
].join('\n')

test('a hardened container has no warnings', () => {
	const result = checkRuntimePosture(fakeDeps())
	assert.deepEqual(result, { warnings: [], unchecked: [] })
})

test('each missing setting is reported', () => {
	const result = checkRuntimePosture(
		fakeDeps({
			uid: 0,
			files: {
				'/proc/self/status': 'CapEff:\t00000000a80425fb\nNoNewPrivs:\t0\n',
				'/proc/sys/kernel/yama/ptrace_scope': '0\n',
				'/proc/self/mountinfo': [
					'1 0 0:1 / / rw,relatime - overlay overlay rw',
					'2 1 0:2 / /home/root/pp/cache rw,nosuid - xfs /dev/sda1 rw'
				].join('\n')
			},
			writable: ['/opt/venv']
		})
	)
	assert.deepEqual(result.warnings, [
		'the process runs as root (uid=0)',
		'the process has effective capabilities (CapEff=00000000a80425fb), drop all capabilities',
		'no_new_privs is not set, set the no-new-privileges option',
		'kernel.yama.ptrace_scope=0, set it to 1 or higher',
		'the root filesystem is writable, mount it read-only',
		'/tmp is on a mount without noexec (mount point /)',
		'/home/root/pp/cache is on a mount without noexec (mount point /home/root/pp/cache)',
		'/opt/venv is writable by the process, it should be read-only'
	])
	assert.deepEqual(result.unchecked, [])
})

test('a missing Yama LSM is a warning, a denied read is unchecked', () => {
	const files = { '/proc/sys/kernel/yama/ptrace_scope': undefined }
	assert.deepEqual(checkRuntimePosture(fakeDeps({ files })).warnings, ['the Yama LSM is not enabled'])
	const denied = checkRuntimePosture(
		fakeDeps({ denied: ['/proc/self/status', '/proc/self/mountinfo', '/proc/sys/kernel/yama/ptrace_scope'] })
	)
	assert.deepEqual(denied, {
		warnings: [],
		unchecked: ['/proc/self/status', '/proc/sys/kernel/yama/ptrace_scope', '/proc/self/mountinfo']
	})
})

test('a lib dir is unchecked when the permission model denies access to it', () => {
	const result = checkRuntimePosture(fakeDeps({ denied: ['/opt/venv'] }))
	assert.deepEqual(result, { warnings: [], unchecked: ['/opt/venv'] })
})

test('a writable dir is resolved to its real path before finding its mount', () => {
	const result = checkRuntimePosture(
		fakeDeps({
			writableDirs: ['/home/root/pp/cachelink'],
			realpaths: { '/home/root/pp/cachelink': '/home/root/pp/cache' }
		})
	)
	assert.deepEqual(result.warnings, [])
})

test('other platforms are skipped', () => {
	assert.deepEqual(checkRuntimePosture(fakeDeps({ platform: 'darwin' })), {
		skipped: "not checked on platform='darwin'"
	})
	const logged = []
	logRuntimePosture({ skipped: 'x' }, m => logged.push(m))
	assert.deepEqual(logged, [])
})

test('parseMountinfo() decodes escaped paths, findMount() uses the longest and last mount point', () => {
	const mounts = parseMountinfo(
		[
			'1 0 0:1 / / ro - overlay o rw',
			'2 1 0:2 / /my\\040data rw - xfs d rw',
			'3 1 0:3 / /tmp rw - tmpfs t rw',
			'4 3 0:4 / /tmp ro,noexec - tmpfs t rw'
		].join('\n')
	)
	assert.equal(mounts[1].mountPoint, '/my data')
	assert.equal(findMount(mounts, '/my data/x').mountPoint, '/my data')
	assert.equal(findMount(mounts, '/my datax').mountPoint, '/')
	assert.deepEqual(findMount(mounts, '/tmp/y').options, ['ro', 'noexec'])
})

test('logRuntimePosture() prints each warning and the unchecked items', () => {
	const logged = []
	logRuntimePosture({ warnings: ['a', 'b'], unchecked: ['/x', '/y'] }, m => logged.push(m))
	assert.deepEqual(logged, [
		'runtimePosture.mjs: WARNING a',
		'runtimePosture.mjs: WARNING b',
		'runtimePosture.mjs: unable to check /x, /y'
	])
})

test('cli: runs and exits 0 without --strict', () => {
	const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })

	test('cli: --strict exits 1 only for a warning, and skips other platforms', () => {
		const r = spawnSync(process.execPath, [SCRIPT, '--strict'], { encoding: 'utf8' })
		assert.doesNotMatch(r.stderr, /TypeError/)
		if (process.platform == 'linux') assert.equal(r.status, r.stderr.includes('WARNING') ? 1 : 0, r.stderr)
		else assert.equal(r.status, 0, r.stderr)
	})

	test('cli: the module can be imported from a script on stdin', () => {
		const r = spawnSync(process.execPath, ['--input-type=module', '-'], {
			input: `import { checkRuntimePosture } from ${JSON.stringify(SCRIPT)}; console.log(typeof checkRuntimePosture)`,
			encoding: 'utf8'
		})
		assert.equal(r.status, 0, r.stderr)
		assert.equal(r.stdout.trim(), 'function')
	})
	assert.equal(r.status, 0, r.stderr)
})

function fakeDeps({
	platform = 'linux',
	uid = 1000,
	files = {},
	writable = [],
	denied = [],
	realpaths = {},
	writableDirs = ['/home/root/pp/cache']
} = {}) {
	const allFiles = {
		'/proc/self/status': hardenedStatus,
		'/proc/self/mountinfo': hardenedMounts,
		'/proc/sys/kernel/yama/ptrace_scope': '1\n',
		...files
	}
	const libDirs = ['/opt/venv', '/usr/local/lib/R/site-library']
	const error = code => Object.assign(new Error(code), { code })
	return {
		platform,
		uid,
		tmpdir: '/tmp',
		writableDirs,
		libDirs,
		fs: {
			readFileSync(file) {
				if (denied.includes(file)) throw error('ERR_ACCESS_DENIED')
				if (allFiles[file] === undefined) throw error('ENOENT')
				return allFiles[file]
			},
			existsSync: p => {
				if (denied.includes(p)) throw error('ERR_ACCESS_DENIED')
				return libDirs.includes(p)
			},
			accessSync(p) {
				if (denied.includes(p)) throw error('ERR_ACCESS_DENIED')
				if (!writable.includes(p)) throw error('EACCES')
			},
			realpathSync: p => realpaths[p] || p
		}
	}
}

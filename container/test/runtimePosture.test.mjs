// In-process tests for runtimePosture.mjs, using a fake fs with fake /proc files.
// run: node --test container/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import {
	checkRuntimePosture,
	logRuntimePosture,
	parseMountinfo,
	findMount,
	STRICT_CHECKS,
	APP_DIR
} from '../runtimePosture.mjs'

const SCRIPT = path.join(import.meta.dirname, '../runtimePosture.mjs')
const messages = result => result.findings.map(f => f.message)

const hardenedStatus = 'Name:\tnode\nCapEff:\t0000000000000000\nNoNewPrivs:\t1\n'
const hardenedMounts = [
	'1 0 0:1 / / ro,relatime - overlay overlay rw',
	'2 1 0:2 / /tmp rw,nosuid,nodev,noexec - tmpfs tmpfs rw',
	'3 1 0:3 /cache /home/root/pp/cache rw,nosuid,nodev,noexec - xfs /dev/sda1 rw'
].join('\n')

test('a hardened container has no warnings', () => {
	const result = checkRuntimePosture(fakeDeps())
	assert.deepEqual(result, { findings: [], unchecked: [] })
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
	assert.deepEqual(
		result.findings.map(f => [f.check, f.message]),
		[
			['user', 'the process runs as root (uid=0)'],
			['capabilities', 'the process has effective capabilities (CapEff=00000000a80425fb), drop all capabilities'],
			['no-new-privileges', 'no_new_privs is not set, set the no-new-privileges option'],
			['ptrace-scope', 'kernel.yama.ptrace_scope=0, set it to 1 or higher'],
			['read-only-root', 'the root filesystem is writable, mount it read-only'],
			['tmp-noexec', '/tmp is on a mount without noexec (mount point /)'],
			['dir-noexec', '/home/root/pp/cache is on a mount without noexec (mount point /home/root/pp/cache)'],
			['lib-dirs', '/opt/venv is writable by the process, it should be read-only']
		]
	)
	assert.deepEqual(result.unchecked, [])
})

test('a missing Yama LSM is a warning, a denied read is unchecked', () => {
	const files = { '/proc/sys/kernel/yama/ptrace_scope': undefined }
	assert.deepEqual(messages(checkRuntimePosture(fakeDeps({ files }))), ['the Yama LSM is not enabled'])
	const denied = checkRuntimePosture(
		fakeDeps({ denied: ['/proc/self/status', '/proc/self/mountinfo', '/proc/sys/kernel/yama/ptrace_scope'] })
	)
	assert.deepEqual(denied, {
		findings: [],
		unchecked: ['/proc/self/status', '/proc/sys/kernel/yama/ptrace_scope', '/proc/self/mountinfo']
	})
})

test('a lib dir is unchecked when the permission model denies access to it', () => {
	const result = checkRuntimePosture(fakeDeps({ denied: ['/opt/venv'] }))
	assert.deepEqual(result, { findings: [], unchecked: ['/opt/venv'] })
})

test('a venv package dir is checked on its own, since its access can differ from the venv dir', () => {
	// the venv dir itself is not writable, but its package dir is
	const result = checkRuntimePosture(fakeDeps({ writable: ['/opt/venv/lib/python3.14/site-packages'] }))
	assert.deepEqual(result.findings, [
		{
			check: 'lib-dirs',
			message: '/opt/venv/lib/python3.14/site-packages is writable by the process, it should be read-only'
		}
	])
	// a lib dir that is not a venv has no lib/ dir to list, which is not a finding
	assert.deepEqual(checkRuntimePosture(fakeDeps({ dirs: {}, exists: [] })), { findings: [], unchecked: [] })
	// a venv lib dir that the permission model denies listing
	assert.deepEqual(checkRuntimePosture(fakeDeps({ denied: ['/opt/venv/lib'] })).unchecked, ['/opt/venv/lib'])
})

test('an unexpected lib dir probe error is unchecked, which is an error in strict mode', () => {
	const result = checkRuntimePosture(fakeDeps({ probeErrors: { '/opt/venv': 'EIO' } }))
	assert.deepEqual(result, { findings: [], unchecked: ['/opt/venv'] })
	const logged = []
	assert.deepEqual(logRuntimePosture(result, { strict: true, log: m => logged.push(m) }), ['unable to check /opt/venv'])
	assert.deepEqual(logged, ['runtimePosture.mjs: ERROR unable to check /opt/venv'])
	// a dir that is not writable, such as on a read-only mount, or that is removed after existsSync(), is checked
	for (const code of ['EACCES', 'EROFS', 'EPERM', 'ENOENT', 'ENOTDIR']) {
		assert.deepEqual(
			checkRuntimePosture(fakeDeps({ probeErrors: { '/opt/venv': code } })),
			{ findings: [], unchecked: [] },
			code
		)
	}
})

test('a mount point under a lib dir is checked on its own', () => {
	const mount = '/usr/local/lib/R/site-library/somepkg'
	const result = checkRuntimePosture(
		fakeDeps({
			files: { '/proc/self/mountinfo': `${hardenedMounts}\n9 1 0:9 / ${mount} rw - xfs d rw` },
			exists: [mount],
			writable: [mount]
		})
	)
	assert.deepEqual(messages(result), [`${mount} is writable by the process, it should be read-only`])
})

test('a writable dir is resolved to its real path before finding its mount', () => {
	const result = checkRuntimePosture(
		fakeDeps({
			writableDirs: ['/home/root/pp/cachelink'],
			realpaths: { '/home/root/pp/cachelink': '/home/root/pp/cache' }
		})
	)
	assert.deepEqual(result.findings, [])
})

test('other platforms are skipped', () => {
	assert.deepEqual(checkRuntimePosture(fakeDeps({ platform: 'darwin' })), {
		skipped: "not checked on platform='darwin'"
	})
	const logged = []
	assert.deepEqual(logRuntimePosture({ skipped: 'x' }, { strict: true, log: m => logged.push(m) }), [])
	assert.deepEqual(logged, [])
})

test('the root filesystem check uses the last of stacked mounts on /, as for the other dirs', () => {
	const stacked = mountinfo => messages(checkRuntimePosture(fakeDeps({ files: { '/proc/self/mountinfo': mountinfo } })))
	// a mount over / has the earlier / mount as its parent, and the later mounts are under the new one
	const tmp = '2 4 0:2 / /tmp rw,noexec - tmpfs t rw\n3 4 0:3 / /home/root/pp/cache rw,noexec - xfs d rw'
	assert.deepEqual(stacked(`1 0 0:1 / / rw - overlay o rw\n4 1 0:4 / / ro - overlay o rw\n${tmp}`), [])
	assert.deepEqual(stacked(`1 0 0:1 / / ro - overlay o rw\n4 1 0:4 / / rw - overlay o rw\n${tmp}`), [
		'the root filesystem is writable, mount it read-only'
	])
})

test('findMount() skips a mount that a later mount over one of its parent dirs hides', () => {
	// the cache mount 2 is under /home/root/pp, where the later mount 3 hides it, so the process sees mount 3
	const mounts = parseMountinfo(
		[
			'1 0 0:1 / / ro - overlay o rw',
			'2 1 0:2 / /home/root/pp/cache rw - xfs d rw',
			'3 1 0:3 / /home/root/pp rw,noexec - xfs d rw',
			'4 1 0:4 / /tmp rw,noexec - tmpfs t rw'
		].join('\n')
	)
	assert.equal(findMount(mounts, '/home/root/pp/cache/x').id, '3')
	assert.equal(findMount(mounts, '/tmp').id, '4')
	assert.equal(findMount(mounts, '/opt').id, '1')
	const result = checkRuntimePosture(fakeDeps({ files: { '/proc/self/mountinfo': mounts.map(toLine).join('\n') } }))
	assert.deepEqual(result.findings, [], 'the hidden cache mount without noexec is not reported')

	// a mount after the covering mount, at the same path, is under it and is seen
	const later = parseMountinfo(
		[
			'1 0 0:1 / / ro - o o rw',
			'3 1 0:3 / /home/root/pp rw - x d rw',
			'5 3 0:5 / /home/root/pp/cache rw - x d rw'
		].join('\n')
	)
	assert.equal(findMount(later, '/home/root/pp/cache').id, '5')
})

test('a lib dir listing failure other than a missing dir is unchecked, and a hidden mount under a lib dir is not checked', () => {
	for (const code of ['EACCES', 'EIO']) {
		const result = checkRuntimePosture(fakeDeps({ listErrors: { '/opt/venv/lib': code } }))
		assert.deepEqual(result.unchecked, ['/opt/venv/lib'], code)
	}
	assert.deepEqual(checkRuntimePosture(fakeDeps({ listErrors: { '/opt/venv/lib': 'ENOTDIR' } })).unchecked, [])
	// a writable package mount that a later mount over the R library dir hides
	const pkg = '/usr/local/lib/R/site-library/somepkg'
	const mountinfo = `${hardenedMounts}\n9 1 0:9 / ${pkg} rw - xfs d rw\n10 1 0:10 / /usr/local/lib/R/site-library ro - xfs d rw`
	const result = checkRuntimePosture(
		fakeDeps({ files: { '/proc/self/mountinfo': mountinfo }, exists: [pkg], writable: [pkg] })
	)
	assert.deepEqual(result.findings, [])
})

// a mountinfo line for a parsed mount, with placeholder device and source fields
const toLine = m => `${m.id} ${m.parentId} 0:0 / ${m.mountPoint} ${m.options.join(',')} - fs src rw`

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
	assert.deepEqual(mounts[0].superOptions, ['rw'])
	// optional fields before the separator, and a line without a separator
	const [shared, short] = parseMountinfo('5 1 0:5 / /x rw shared:1 master:2 - xfs d ro,attr2\n6 1 0:6 / /y rw')
	assert.deepEqual(shared.superOptions, ['ro', 'attr2'])
	assert.deepEqual(short.superOptions, [])
})

test('logRuntimePosture() prints each finding and the unchecked items as warnings by default', () => {
	const logged = []
	const result = {
		findings: [
			{ check: 'user', message: 'a' },
			{ check: 'ptrace-scope', message: 'b' }
		],
		unchecked: ['/x', '/y']
	}
	assert.deepEqual(logRuntimePosture(result, { log: m => logged.push(m) }), [])
	assert.deepEqual(logged, [
		'runtimePosture.mjs: WARNING a',
		'runtimePosture.mjs: WARNING b',
		'runtimePosture.mjs: WARNING unable to check /x, /y'
	])
})

test('logRuntimePosture() in strict mode: a STRICT_CHECKS finding and an unchecked item are errors', () => {
	const logged = []
	const result = {
		findings: [
			{ check: 'user', message: 'a' },
			{ check: 'ptrace-scope', message: 'b' },
			{ check: 'dir-noexec', message: 'c' }
		],
		unchecked: ['/x']
	}
	assert.deepEqual(logRuntimePosture(result, { strict: true, log: m => logged.push(m) }), [
		'a',
		'c',
		'unable to check /x'
	])
	assert.deepEqual(logged, [
		'runtimePosture.mjs: ERROR a',
		'runtimePosture.mjs: WARNING b',
		'runtimePosture.mjs: ERROR c',
		'runtimePosture.mjs: ERROR unable to check /x'
	])
	// the host kernel setting is not required
	assert.deepEqual([...STRICT_CHECKS].toSorted(), [
		'app-files',
		'capabilities',
		'dir-noexec',
		'lib-dirs',
		'no-new-privileges',
		'read-only-root',
		'tmp-noexec',
		'user'
	])
})

test('logRuntimePosture() in strict mode: a dir-noexec finding is an error', () => {
	const mountinfo = hardenedMounts.replace(
		'/home/root/pp/cache rw,nosuid,nodev,noexec',
		'/home/root/pp/cache rw,nosuid,nodev'
	)
	const result = checkRuntimePosture(fakeDeps({ files: { '/proc/self/mountinfo': mountinfo } }))
	assert.deepEqual(result.findings, [
		{
			check: 'dir-noexec',
			message: '/home/root/pp/cache is on a mount without noexec (mount point /home/root/pp/cache)'
		}
	])
	const logged = []
	assert.deepEqual(logRuntimePosture(result, { strict: true, log: m => logged.push(m) }), [
		'/home/root/pp/cache is on a mount without noexec (mount point /home/root/pp/cache)'
	])
	assert.deepEqual(logged, [
		'runtimePosture.mjs: ERROR /home/root/pp/cache is on a mount without noexec (mount point /home/root/pp/cache)'
	])
})

test('the noexec check of a write dir skips a ro mount and includes the mounts under the dir', () => {
	// a write dir without its own mount, on the root mount with ro
	const writableDirs = ['/home/root/pp/cache', '/home/root/pp/tp_write']
	const result = checkRuntimePosture(fakeDeps({ writableDirs }))
	assert.deepEqual(result, { findings: [], unchecked: [] })
	assert.deepEqual(logRuntimePosture(result, { strict: true, log: () => {} }), [])

	// the same dir on a root mount without ro
	const mountinfo = hardenedMounts.replace('/ / ro,relatime', '/ / rw,relatime')
	const rw = checkRuntimePosture(fakeDeps({ writableDirs, files: { '/proc/self/mountinfo': mountinfo } }))
	assert.deepEqual(
		rw.findings.map(f => [f.check, f.message]),
		[
			['read-only-root', 'the root filesystem is writable, mount it read-only'],
			['dir-noexec', '/home/root/pp/tp_write is on a mount without noexec (mount point /)']
		]
	)

	// a write dir mount with ro, and the OS temp dir on the root mount with ro
	const ro = [
		'1 0 0:1 / / ro,relatime - overlay overlay rw',
		'3 1 0:3 /cache /home/root/pp/cache ro,nosuid,nodev - xfs /dev/sda1 rw'
	].join('\n')
	assert.deepEqual(checkRuntimePosture(fakeDeps({ files: { '/proc/self/mountinfo': ro } })), {
		findings: [],
		unchecked: []
	})

	// a filesystem with the ro super option, while the per-mount options have rw
	const superRo = hardenedMounts
		.replace('/ / ro,relatime - overlay overlay rw', '/ / rw,relatime - overlay overlay ro')
		.replace(
			'/home/root/pp/cache rw,nosuid,nodev,noexec - xfs /dev/sda1 rw',
			'/home/root/pp/cache rw - xfs /dev/sda1 ro'
		)
	assert.deepEqual(checkRuntimePosture(fakeDeps({ writableDirs, files: { '/proc/self/mountinfo': superRo } })), {
		findings: [],
		unchecked: []
	})

	// a write dir of /, which covers all of the mounts that the process sees
	const all = checkRuntimePosture(fakeDeps({ writableDirs: ['/'], files: { '/proc/self/mountinfo': mountinfo } }))
	assert.deepEqual(
		all.findings.filter(f => f.check == 'dir-noexec').map(f => f.message),
		['/ is on a mount without noexec (mount point /)']
	)
	const rootRo = `${hardenedMounts}\n9 1 0:9 / /data rw - xfs d rw`
	assert.deepEqual(
		checkRuntimePosture(fakeDeps({ writableDirs: ['/'], files: { '/proc/self/mountinfo': rootRo } })).findings,
		[{ check: 'dir-noexec', message: '/ has a mount without noexec under it (mount point /data)' }]
	)

	// a mount under a write dir is checked, even when the dir itself is on a ro mount; a hidden one is not
	const nested = [
		ro,
		'4 3 0:4 / /home/root/pp/cache/sub rw,nosuid - xfs /dev/sdb1 rw',
		'5 1 0:5 / /home/root/pp/tp_write/a/b rw - xfs /dev/sdc1 rw',
		'6 1 0:6 / /home/root/pp/tp_write/a ro - xfs /dev/sdd1 rw',
		'7 1 0:7 / /home/root/pp/tp_writex rw - xfs /dev/sde1 rw'
	].join('\n')
	assert.deepEqual(
		checkRuntimePosture(fakeDeps({ writableDirs, files: { '/proc/self/mountinfo': nested } })).findings,
		[
			{
				check: 'dir-noexec',
				message: '/home/root/pp/cache has a mount without noexec under it (mount point /home/root/pp/cache/sub)'
			}
		]
	)
})

test('the app dir, node_modules, @sjcrh packages, bundle dir, and .mjs files are checked, not public', () => {
	const writable = [...appPaths]
	const result = checkRuntimePosture(fakeDeps({ writable }))
	const expected = [
		APP_DIR,
		`${APP_DIR}/node_modules`,
		`${APP_DIR}/node_modules/@sjcrh`,
		`${APP_DIR}/bin`,
		`${APP_DIR}/app-full.mjs`,
		`${APP_DIR}/envHelpers.mjs`,
		`${APP_DIR}/node_modules/@sjcrh/proteinpaint-front`,
		`${APP_DIR}/node_modules/@sjcrh/proteinpaint-server`
	]
	assert.deepEqual(
		result.findings.map(f => [f.check, f.message]),
		expected.map(p => ['app-files', `${p} is writable by the process, it should be read-only`])
	)
	assert.deepEqual(result.unchecked, [])
	// an error in strict mode
	const errors = logRuntimePosture(result, { strict: true, log: () => {} })
	assert.equal(errors.length, expected.length)
})

test('a missing app dir is not checked, such as outside of the image', () => {
	assert.deepEqual(checkRuntimePosture(fakeDeps({ dirs: {}, exists: [], writable: [APP_DIR] })), {
		findings: [],
		unchecked: []
	})
})

test('an app file that cannot be probed or listed is unchecked', () => {
	const server = `${APP_DIR}/node_modules/@sjcrh/proteinpaint-server`
	assert.deepEqual(checkRuntimePosture(fakeDeps({ probeErrors: { [server]: 'EIO' } })).unchecked, [server])
	assert.deepEqual(checkRuntimePosture(fakeDeps({ denied: [`${APP_DIR}/envHelpers.mjs`] })).unchecked, [
		`${APP_DIR}/envHelpers.mjs`
	])
	for (const code of ['EACCES', 'ERR_ACCESS_DENIED']) {
		const result = checkRuntimePosture(fakeDeps({ listErrors: { [APP_DIR]: code } }))
		assert.deepEqual(result.unchecked, [APP_DIR], code)
		assert.deepEqual(result.findings, [], code)
	}
	// a read-only root filesystem is not writable either
	assert.deepEqual(checkRuntimePosture(fakeDeps({ probeErrors: { [APP_DIR]: 'EROFS' } })), {
		findings: [],
		unchecked: []
	})
})

test('cli: runs and exits 0 without --strict', () => {
	const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
	assert.equal(r.status, 0, r.stderr)
})

test('cli: --strict exits 1 only for an error, and skips other platforms', () => {
	const r = spawnSync(process.execPath, [SCRIPT, '--strict'], { encoding: 'utf8' })
	assert.doesNotMatch(r.stderr, /TypeError/)
	if (process.platform == 'linux') assert.equal(r.status, r.stderr.includes('ERROR') ? 1 : 0, r.stderr)
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

// the app files in the full image; public, which is writable here, is not checked
const appDirs = {
	[APP_DIR]: ['app-full.mjs', 'envHelpers.mjs', 'package.json', 'serverconfig.json', 'bin', 'public', 'node_modules'],
	[`${APP_DIR}/node_modules/@sjcrh`]: ['proteinpaint-front', 'proteinpaint-server']
}
const appPaths = [
	APP_DIR,
	`${APP_DIR}/node_modules`,
	`${APP_DIR}/node_modules/@sjcrh`,
	`${APP_DIR}/bin`,
	`${APP_DIR}/public`,
	`${APP_DIR}/app-full.mjs`,
	`${APP_DIR}/envHelpers.mjs`,
	`${APP_DIR}/node_modules/@sjcrh/proteinpaint-front`,
	`${APP_DIR}/node_modules/@sjcrh/proteinpaint-server`
]

function fakeDeps({
	platform = 'linux',
	uid = 1000,
	files = {},
	writable = [],
	denied = [],
	realpaths = {},
	writableDirs = ['/home/root/pp/cache'],
	// dir -> entries, for readdirSync(), and the paths that exist besides libDirs
	dirs = { '/opt/venv/lib': ['python3.14'], ...appDirs },
	exists = ['/opt/venv/lib/python3.14/site-packages', ...appPaths],
	// dir -> error code, for readdirSync()
	listErrors = {},
	// dir -> error code, for accessSync(), instead of EACCES for a dir that is not writable
	probeErrors = {}
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
				return libDirs.includes(p) || exists.includes(p)
			},
			readdirSync(p) {
				if (denied.includes(p)) throw error('ERR_ACCESS_DENIED')
				if (listErrors[p]) throw error(listErrors[p])
				if (!dirs[p]) throw error('ENOENT')
				return dirs[p]
			},
			accessSync(p) {
				if (denied.includes(p)) throw error('ERR_ACCESS_DENIED')
				if (probeErrors[p]) throw error(probeErrors[p])
				if (!writable.includes(p)) throw error('EACCES')
			},
			realpathSync: p => realpaths[p] || p
		}
	}
}

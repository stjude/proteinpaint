import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

/*
Tests:
	massSession and sessionIds routes are set up by default
	massSession and sessionIds routes are not set up when the massSession cache maxAge is 0
	massSession and sessionIds routes are not set up when the massSession cache maxSize is 0

isDisabled in massSession.ts is computed from serverconfig when the module is first evaluated,
and sessionIds.ts imports it from that module instance, so each serverconfig case is tested
by loading both routes in a child process with process.env.PP_SERVERCONFIG_OVERRIDES
*/

// prints the route methods that augen sets up, and whether the massSession cache dir was created
const childScript = `
import fs from 'fs'
import path from 'path'
import { setRoutes } from '@sjcrh/augen'
import serverconfig from '#src/serverconfig.js'
const massSession = await import('#src/routes/massSession.ts')
const sessionIds = await import('#src/routes/sessionIds.ts')
const mounted = []
const app = {}
for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
setRoutes(app, [massSession, sessionIds])
const hasCacheDir = fs.existsSync(path.join(serverconfig.cachedir, 'massSession'))
console.log('RESULT=' + JSON.stringify({ mounted: mounted.sort(), hasCacheDir }))
`

function loadRoutes(massSessionCacheOpts?: { maxAge?: number; maxSize?: number }) {
	const cachedir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-massSession-'))
	try {
		const overrides: any = { cachedir }
		if (massSessionCacheOpts) overrides.features = { cacheMonitor: { subdirs: { massSession: massSessionCacheOpts } } }
		const child = spawnSync(
			process.execPath,
			['--import', 'tsx', '--conditions=sjpp/dev', '--input-type=module', '--eval', childScript],
			{ encoding: 'utf8', env: { ...process.env, PP_SERVERCONFIG_OVERRIDES: JSON.stringify(overrides) } }
		)
		const line = child.stdout.split('\n').find(l => l.startsWith('RESULT='))
		if (!line) throw `child process did not report a result: ${child.stderr || child.stdout}`
		return JSON.parse(line.slice('RESULT='.length))
	} finally {
		fs.rmSync(cachedir, { recursive: true, force: true })
	}
}

tape('\n', function (test) {
	test.comment('-***- routes/massSession specs -***-')
	test.end()
})

tape('massSession and sessionIds routes are set up by default', test => {
	const { mounted, hasCacheDir } = loadRoutes()
	test.deepEqual(
		mounted,
		['delete /massSession', 'get /massSession', 'get /sessionIds', 'post /massSession'],
		'should set up every massSession method and sessionIds'
	)
	test.equal(hasCacheDir, true, 'should create the massSession cache dir')
	test.end()
})

for (const opts of [{ maxAge: 0 }, { maxSize: 0 }]) {
	const key = Object.keys(opts)[0]
	tape(`massSession and sessionIds routes are not set up when the massSession cache ${key} is 0`, test => {
		const { mounted, hasCacheDir } = loadRoutes(opts)
		test.deepEqual(mounted, [], `should not set up any massSession method or sessionIds when ${key}=0`)
		test.equal(hasCacheDir, false, `should not create the massSession cache dir when ${key}=0`)
		test.end()
	})
}

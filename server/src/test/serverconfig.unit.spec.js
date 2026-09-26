import tape from 'tape'
import serverconfig from '../serverconfig.js'
import path from 'path'

const __dirname = import.meta.dirname

const sc = structuredClone(serverconfig)
tape('basic test', test => {
	test.equal(sc.debugmode, true, 'should have debugmode=true in test environment')
	test.equal(sc.binpath, path.join(__dirname, '../..'), 'should detect the correct binpath')
	test.equal(sc.routeSetters?.length, 6, 'should set the expected routeSetters')
	test.end()
})

/*
	process.env.PP_CREDS is parsed when serverconfig.js is evaluated, so these tests set it and then
	import serverconfig.js with a unique query string, which evaluates a new instance of that module
*/
tape('process.env.PP_CREDS: valid JSON overrides dsCredentials, and is deleted from process.env', async test => {
	const creds = { zzCredsTest: { '*': { '*': { type: 'basic', password: 'test-only' } } } } // pragma: allowlist secret
	process.env.PP_CREDS = JSON.stringify(creds)
	try {
		const { default: config } = await import('../serverconfig.js?pp_creds=valid')
		test.deepEqual(config.dsCredentials.zzCredsTest, creds.zzCredsTest, 'should set dsCredentials from PP_CREDS')
		test.equal('PP_CREDS' in process.env, false, 'should delete PP_CREDS from process.env')
	} finally {
		delete process.env.PP_CREDS
	}
	test.end()
})

tape('process.env.PP_CREDS: invalid JSON throws a message without the credentials content', async test => {
	process.env.PP_CREDS = '{"zzCredsTest": "secret-value-not-in-message' // pragma: allowlist secret
	try {
		await import('../serverconfig.js?pp_creds=invalid')
		test.fail('should throw on invalid JSON')
	} catch (e) {
		const message = String(e.message || e)
		test.equal(message, 'invalid JSON in process.env.PP_CREDS', 'should throw a sanitized message')
		test.equal(message.includes('secret-value'), false, 'should not include any of the credentials content')
	} finally {
		delete process.env.PP_CREDS
	}
	test.end()
})

/*
	process.env.PP_SERVERCONFIG_OVERRIDES is also applied when serverconfig.js is evaluated,
	such as from the container app-server.mjs and app-full.mjs, instead of rewriting serverconfig.json
*/
tape('process.env.PP_SERVERCONFIG_OVERRIDES: applied before derived settings, and kept in process.env', async test => {
	const genomes = [{ name: 'zzOverrideTest', species: 'human', file: './genome/hg38.test.js', datasets: [] }]
	process.env.PP_SERVERCONFIG_OVERRIDES = JSON.stringify({ backend_only: true, genomes })
	try {
		const { default: config } = await import('../serverconfig.js?pp_serverconfig_overrides=valid')
		test.equal(config.backend_only, true, 'should override backend_only')
		test.deepEqual(config.genomes, genomes, 'should override genomes')
		test.equal(config.binDir, undefined, 'should apply backend_only to the derived binDir')
		test.equal(
			'PP_SERVERCONFIG_OVERRIDES' in process.env,
			true,
			'should keep PP_SERVERCONFIG_OVERRIDES for spawned child processes'
		)
	} finally {
		delete process.env.PP_SERVERCONFIG_OVERRIDES
	}
	test.end()
})

tape('process.env.PP_SERVERCONFIG_OVERRIDES: must be a JSON object', async test => {
	for (const [value, expected] of [
		['{"backend_only": tr', /^invalid JSON in process.env.PP_SERVERCONFIG_OVERRIDES/],
		['[]', /^process.env.PP_SERVERCONFIG_OVERRIDES must be a JSON object$/],
		['null', /^process.env.PP_SERVERCONFIG_OVERRIDES must be a JSON object$/]
	]) {
		process.env.PP_SERVERCONFIG_OVERRIDES = value
		try {
			await import(`../serverconfig.js?pp_serverconfig_overrides=${encodeURIComponent(value)}`)
			test.fail(`should throw for ${value}`)
		} catch (e) {
			test.match(String(e.message || e), expected, `should throw for ${value}`)
		} finally {
			delete process.env.PP_SERVERCONFIG_OVERRIDES
		}
	}
	test.end()
})

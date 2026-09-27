import tape from 'tape'
import serverconfig, { lockFeatures } from '../serverconfig.js'
import path from 'path'
import fs from 'fs'

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

/*
	lockFeatures() is called by app.ts launch() after dataset init, and is tested here against
	a copy of the config, so that other unit tests can still toggle the shared serverconfig.features{}
*/
tape('lockFeatures(): serverconfig.features{} cannot be changed after launch', test => {
	const sc = {
		features: {
			customFlag: true,
			dslabelFilter: ['TermdbTest'],
			altGenomeByDslabel: { TermdbTest: 'hg38-test' },
			cacheMonitor: { subdirs: { massSession: { maxAge: 1 } } }
		}
	}
	const original = sc.features
	lockFeatures(sc)

	test.deepEqual({ ...sc.features }, { ...original }, 'should keep the same feature keys and values')
	test.equal(Object.getPrototypeOf(sc.features), null, 'should have a null prototype')
	test.equal('customFlag' in sc.features, true, 'should still support the `in` operator used by mds3.init.js')

	// test files are ES modules and so run in strict mode, where writing to a frozen object throws
	test.throws(() => (sc.features.loosenCORS = true), TypeError, 'should not add a feature')
	test.throws(() => (sc.features.customFlag = false), TypeError, 'should not change a feature')
	test.throws(() => delete sc.features.customFlag, TypeError, 'should not delete a feature')
	test.throws(() => sc.features.dslabelFilter.push('ProtectedTest'), TypeError, 'should not change a nested array')
	test.throws(() => (sc.features.altGenomeByDslabel.GDC = 'hg38-test'), TypeError, 'should not change a nested object')
	test.throws(
		() => (sc.features.cacheMonitor.subdirs.massSession.maxAge = 0),
		TypeError,
		'should not change a deeply nested object'
	)
	test.throws(() => (sc.features = { loosenCORS: true }), TypeError, 'should not replace serverconfig.features')
	test.throws(
		() => Object.defineProperty(sc, 'features', { value: { loosenCORS: true } }),
		TypeError,
		'should not redefine serverconfig.features'
	)
	test.equal(sc.features.loosenCORS, undefined, 'should not have enabled any feature')
	test.end()
})

tape('lockFeatures(): a polluted Object.prototype is not read as a feature', test => {
	const sc = { features: { customFlag: true } }
	lockFeatures(sc)
	Object.prototype.zzPollutedFeature = true
	try {
		test.equal(sc.features.zzPollutedFeature, undefined, 'should not inherit a polluted Object.prototype property')
		test.equal({}.zzPollutedFeature, true, 'should confirm that Object.prototype was polluted for this test')
	} finally {
		delete Object.prototype.zzPollutedFeature
	}
	test.end()
})

tape('no module-level alias of serverconfig.features{}', test => {
	// an alias captured when a module is first imported keeps referencing the original features{} object,
	// which lockFeatures() replaces with a locked copy, so the alias would remain mutable after launch
	const srcDir = path.join(__dirname, '..')
	const aliasPattern = /^(export\s+)?(const|let|var)\s+\w+\s*=\s*serverconfig\.features\s*;?\s*$/m
	const offenders = []
	for (const f of fs.readdirSync(srcDir, { recursive: true })) {
		if (!/\.(js|ts|mjs|cjs)$/.test(f) || f.includes('node_modules') || f.includes('test/')) continue
		const code = fs.readFileSync(path.join(srcDir, f), { encoding: 'utf8' })
		if (aliasPattern.test(code)) offenders.push(f)
	}
	test.deepEqual(offenders, [], 'should read serverconfig.features directly instead of from a module-level alias')
	test.end()
})

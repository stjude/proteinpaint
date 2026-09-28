import tape from 'tape'
import serverconfig, { lockServerconfig, mergeDsFeatures } from '../serverconfig.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

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
	lockServerconfig() is called by app.ts launch() after dataset init, and is tested here against
	other config objects, so that other unit tests can still modify the shared serverconfig
*/
tape('lockServerconfig(): serverconfig.features{} cannot be changed after launch', test => {
	const sc = {
		features: {
			customFlag: true,
			dslabelFilter: ['TermdbTest'],
			altGenomeByDslabel: { TermdbTest: 'hg38-test' },
			cacheMonitor: { subdirs: { massSession: { maxAge: 1 } } }
		}
	}
	const original = structuredClone(sc.features)
	// like `const bamCache = serverconfig.features.bamCache` in bam.js, captured when a module is imported
	const alias = sc.features
	const nestedAlias = sc.features.cacheMonitor
	lockServerconfig(sc)

	// compare as JSON, since tape deepEqual() also compares the now-null prototypes
	test.deepEqual(JSON.parse(JSON.stringify(sc.features)), original, 'should keep the same feature keys and values')
	test.equal(sc.features, alias, 'should lock features{} in place, so that a captured alias is locked too')
	test.equal(sc.features.cacheMonitor, nestedAlias, 'should lock nested objects in place')
	test.equal(Object.isFrozen(nestedAlias.subdirs), true, 'should freeze a nested object through a captured alias')
	test.equal(Object.getPrototypeOf(sc.features), null, 'should have a null prototype')
	test.equal(
		Object.getPrototypeOf(sc.features.cacheMonitor.subdirs.massSession),
		null,
		'should have a null prototype for a nested object'
	)
	test.equal(Array.isArray(sc.features.dslabelFilter), true, 'should keep a nested array as an array')
	test.equal(sc.features.dslabelFilter.includes('TermdbTest'), true, 'should keep array methods')
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

tape('lockServerconfig(): a polluted Object.prototype is not read as a feature', test => {
	const sc = { features: { customFlag: true, wsi: {}, dslabelFilter: ['TermdbTest'] } }
	lockServerconfig(sc)
	Object.prototype.zzPollutedFeature = true
	Object.prototype.allowDirectSlidePath = true
	try {
		test.equal({}.zzPollutedFeature, true, 'should confirm that Object.prototype was polluted for this test')
		test.equal(sc.features.zzPollutedFeature, undefined, 'should not inherit a polluted Object.prototype property')
		test.equal(
			sc.features.wsi.allowDirectSlidePath,
			undefined,
			'should not inherit a polluted Object.prototype property in a nested object, e.g. the check in routes/wsitiles.ts'
		)
	} finally {
		delete Object.prototype.zzPollutedFeature
		delete Object.prototype.allowDirectSlidePath
	}
	test.end()
})

tape('serverconfig: a polluted Object.prototype is not read as a top-level setting', test => {
	test.equal(Object.getPrototypeOf(serverconfig), null, 'should have a null prototype')
	Object.prototype.zzPollutedSetting = true
	try {
		test.equal({}.zzPollutedSetting, true, 'should confirm that Object.prototype was polluted for this test')
		test.equal(serverconfig.zzPollutedSetting, undefined, 'should not inherit a polluted Object.prototype property')
	} finally {
		delete Object.prototype.zzPollutedSetting
	}
	test.end()
})

tape('serverconfig: the prototype is removed before any setting is read or defaulted', async test => {
	// cache_snpgt is defaulted by serverconfig.js when not set, and its fileNameRegexp guards client-provided cache file names
	Object.prototype.cache_snpgt = { dir: '/zz-polluted', fileNameRegexp: /(?!)/ }
	try {
		const { default: config } = await import('../serverconfig.js?pollution=before-import')
		test.equal(Object.getPrototypeOf(config), null, 'should have a null prototype')
		test.equal(
			Object.hasOwn(config, 'cache_snpgt'),
			true,
			'should apply the default instead of using an inherited value'
		)
		test.notEqual(config.cache_snpgt.dir, '/zz-polluted', 'should not use the polluted cache_snpgt.dir')
	} finally {
		delete Object.prototype.cache_snpgt
	}
	test.end()
})

tape('mergeDsFeatures(): copies only own ds.serverconfigFeatures keys, without overwriting', test => {
	const sc = { features: { sse: false } }
	Object.prototype.zzPollutedFeature = true
	try {
		// a ds without serverconfigFeatures still iterates the `|| {}` fallback, which inherits from Object.prototype
		mergeDsFeatures(sc, { label: 'ds1', init: {} })
		mergeDsFeatures(sc, { label: 'ds2', init: {}, serverconfigFeatures: { gdcBam: { cacheMaxSize: 1 }, sse: true } })
		test.deepEqual(Object.keys(sc.features), ['sse', 'gdcBam'], 'should only have own keys')
		test.equal(Object.hasOwn(sc.features, 'zzPollutedFeature'), false, 'should not copy a polluted inherited key')
		test.equal(sc.features.sse, false, 'should not overwrite an existing feature')
		lockServerconfig(sc)
		test.equal(sc.features.zzPollutedFeature, undefined, 'should not have a polluted feature after locking')
	} finally {
		delete Object.prototype.zzPollutedFeature
	}
	test.end()
})

tape('lockServerconfig(): fully locks or fails for already-frozen, sealed, circular, or accessor values', test => {
	{
		const child = { x: 1 }
		const sc = { features: { frozenNullProto: Object.freeze(Object.assign(Object.create(null), { child })) } }
		lockServerconfig(sc)
		test.equal(Object.isFrozen(child), true, 'should traverse into an already-frozen object and freeze its descendants')
		test.equal(Object.getPrototypeOf(child), null, 'should set a null prototype on a descendant of a frozen object')
	}
	{
		const child = { x: 1 }
		lockServerconfig({ features: { list: Object.freeze([child]) } })
		test.equal(Object.isFrozen(child), true, 'should traverse into an already-frozen array')
	}
	{
		const features = { a: {} }
		features.a.parent = features
		lockServerconfig({ features })
		test.equal(Object.isFrozen(features.a), true, 'should lock a circular reference without infinite recursion')
	}
	test.throws(
		() => lockServerconfig({ features: { wsi: Object.freeze({ allowDirectSlidePath: false }) } }),
		/serverconfig.features.wsi cannot be locked/,
		'should throw for an already-frozen plain object, which would keep inheriting from Object.prototype'
	)
	test.throws(
		() => lockServerconfig({ features: { wsi: Object.seal({}) } }),
		/serverconfig.features.wsi cannot be locked/,
		'should throw for a sealed plain object'
	)
	test.throws(
		() =>
			lockServerconfig({
				features: {
					get loosenCORS() {
						return false
					}
				}
			}),
		/serverconfig.features.loosenCORS cannot be locked/,
		'should throw for a getter, which can return a different value on each call'
	)
	test.end()
})

tape(
	'lockServerconfig(): the whole serverconfig{} is frozen, but only features{} objects get a null prototype',
	test => {
		const sc = {
			port: 3000,
			allowedEmbedders: ['a.org'],
			genomes: [{ name: 'hg38', tracks: [{ file: 'a.gz' }], datasets: [{ name: 'ds1', jsfile: 'ds1.js' }] }],
			cache_snpgt: { fileNameRegexp: /[^\w]/ },
			// already frozen by other code, outside of features{}
			ssl: Object.freeze({ key: 'a.key', nested: { cert: 'a.crt' } }),
			features: { wsi: {} }
		}
		lockServerconfig(sc)

		test.throws(() => (sc.port = 1), TypeError, 'should not change a top-level setting')
		test.throws(() => (sc.debugmode = true), TypeError, 'should not add a top-level setting')
		test.throws(() => delete sc.port, TypeError, 'should not delete a top-level setting')
		test.throws(() => sc.allowedEmbedders.push('*'), TypeError, 'should not change a top-level array')
		test.throws(() => sc.genomes.push({ name: 'zz' }), TypeError, 'should not add a genome')
		test.throws(() => (sc.genomes[0].tracks[0].file = 'b.gz'), TypeError, 'should not change a deeply nested object')
		test.throws(() => (sc.genomes[0].datasets[0].jsfile = 'b.js'), TypeError, 'should not change a raw dataset entry')
		test.throws(
			() => (sc.ssl.nested.cert = 'b.crt'),
			TypeError,
			'should freeze a descendant of an already-frozen object'
		)
		test.equal(
			Object.getPrototypeOf(sc.genomes[0]),
			Object.prototype,
			'should only freeze, not set a null prototype, outside of features{}'
		)
		test.equal(Object.getPrototypeOf(sc.features.wsi), null, 'should set a null prototype for a features{} object')
		test.equal(
			sc.cache_snpgt.fileNameRegexp.test('a/b'),
			true,
			'should keep a frozen RegExp without the g or y flag usable'
		)
		test.end()
	}
)

tape('lockServerconfig(): fails at launch for a value that freezing cannot protect', test => {
	for (const [label, sc, expected] of [
		[
			'a RegExp with the g flag',
			{ cache_snpgt: { fileNameRegexp: /[^\w]/g } },
			/serverconfig.cache_snpgt.fileNameRegexp/
		],
		['a RegExp with the y flag', { features: { re: /a/y } }, /serverconfig.features.re/],
		['a Map', { features: { cache: new Map() } }, /serverconfig.features.cache/],
		['a Set', { genomes: [{ tracks: new Set() }] }, /serverconfig.genomes.0.tracks/],
		['a Date', { maintenance: { start: new Date() } }, /serverconfig.maintenance.start/]
	]) {
		test.throws(() => lockServerconfig({ features: {}, ...sc }), expected, `should throw for ${label}`)
	a local ./.ssl dir is detected relative to process.cwd(), so this test evaluates serverconfig.js
	from a temporary working dir that has its own serverconfig.json, without any ssl setting
*/
tape('ssl: a local ./.ssl dir is loaded unless ssl=false', async test => {
	const cwd = process.cwd()
	const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-serverconfig-ssl-'))
	try {
		fs.mkdirSync(path.join(tmpdir, '.ssl'))
		fs.writeFileSync(path.join(tmpdir, '.ssl/test.key'), '')
		fs.writeFileSync(path.join(tmpdir, '.ssl/test.crt'), '')
		const minimalConfig = {
			debugmode: true,
			allow_env_overrides: true,
			binpath: sc.binpath,
			tpmasterdir: sc.tpmasterdir,
			cachedir: sc.cachedir,
			genomes: []
		}
		fs.writeFileSync(path.join(tmpdir, 'serverconfig.json'), JSON.stringify(minimalConfig))
		process.chdir(tmpdir)
		// process.cwd() may resolve symlinks in the tmpdir path, such as /var -> /private/var in macOS
		const sslDir = path.join(process.cwd(), '.ssl')
		const expectedSsl = { key: `${sslDir}/test.key`, cert: `${sslDir}/test.crt` }

		for (const [label, overrides, expected] of [
			['missing', {}, expectedSsl],
			['null', { ssl: null }, expectedSsl],
			['false', { ssl: false }, false]
		]) {
			process.env.PP_SERVERCONFIG_OVERRIDES = JSON.stringify(overrides)
			const { default: config } = await import(`../serverconfig.js?ssl=${label}`)
			test.deepEqual(config.ssl, expected, `should set the expected ssl value when ssl is ${label}`)
		}
	} finally {
		delete process.env.PP_SERVERCONFIG_OVERRIDES
		process.chdir(cwd)
		fs.rmSync(tmpdir, { recursive: true, force: true })
	}
	test.end()
})

import tape from 'tape'
import { validateDsCredentials } from '#src/auth/auth.dsCredentials.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'test-dsCredentials-secret' // pragma: allowlist secret

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/auth.dsCredentials -***-')
	test.end()
})

tape('validateDsCredentials: empty credentials returns empty credEmbedders', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const creds = {}
	const credEmbedders = await validateDsCredentials(creds)
	test.ok(credEmbedders instanceof Set, 'should return a Set')
	test.equal(credEmbedders.size, 0, 'should return an empty Set for empty credentials')
	test.end()
})

tape('validateDsCredentials: skips and removes comment keys starting with #', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const creds: any = {
		'#comment': { termdb: { '*': { type: 'basic', password: 'test' } } }, // pragma: allowlist secret
		realDs: { termdb: { '*': { type: 'basic', password: 'test' } } } // pragma: allowlist secret
	}
	await validateDsCredentials(creds, { hg38: { datasets: { realDs: {} } } })
	test.equal(creds['#comment'], undefined, 'should remove comment keys starting with #')
	test.ok(creds['realDs'], 'should keep non-comment keys')
	test.end()
})

tape('validateDsCredentials: removes entries for dslabel patterns that were not loaded', async function (test) {
	test.timeoutAfter(500)
	test.plan(6)

	{
		const creds: any = {
			someDs: { termdb: { '*': { type: 'basic', password: 'test' } } }, // pragma: allowlist secret
			realDs: { termdb: { '*': { type: 'basic', password: 'test' } } } // pragma: allowlist secret
		}
		await validateDsCredentials(creds, { hg38: { datasets: { realDs: {} } } })
		test.equal(creds['someDs'], undefined, 'should remove cred entries for dslabels that were not loaded')
		test.ok(creds['realDs'], 'should keep cred entries for dslabels that were loaded')
	}

	{
		const creds: any = {
			someDs: { termdb: { '*': { type: 'basic', password: 'test' } } }, // pragma: allowlist secret
			realDs: { termdb: { '*': { type: 'basic', password: 'test' } } } // pragma: allowlist secret
		}
		await validateDsCredentials(creds)
		test.ok(creds['someDs'], 'should keep cred entries if the 2nd argument is not supplied')
		test.ok(creds['realDs'], 'should keep cred entries for dslabels that were loaded')
	}

	{
		const creds: any = {
			someDs: { termdb: { '*': { type: 'basic', password: 'test' } } }, // pragma: allowlist secret
			'realD*': { termdb: { '*': { type: 'basic', password: 'test' } } } // pragma: allowlist secret
		}
		await validateDsCredentials(creds, { hg38: { datasets: { realDs: {}, someDs: {}, ds0: {} } } })
		test.ok(creds['someDs'], 'should keep cred entries for an exact dslabel match')
		test.ok(creds['realD*'], 'should keep cred entries for a dslabel pattern match')
	}

	test.end()
})

tape('validateDsCredentials: basic type gets expected defaults', async function (test) {
	test.timeoutAfter(500)
	test.plan(6)

	const creds: any = {
		testDs: {
			termdb: {
				'test.example.com': {
					type: 'basic',
					password: 'mypassword' // pragma: allowlist secret
				}
			}
		}
	}
	const credEmbedders = await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
	const cred = creds.testDs.termdb['test.example.com']
	test.equal(cred.secret, 'mypassword', 'should copy password to secret for basic type')
	test.equal(cred.authRoute, '/dslogin', 'should set authRoute to /dslogin for basic type')
	test.equal(cred.headerKey, 'x-ds-access-token', 'should set default headerKey for basic type')
	test.equal(cred.dslabel, 'testDs', 'should set dslabel on cred')
	test.equal(cred.route, 'termdb', 'should set route on cred')
	test.ok(credEmbedders.has('test.example.com'), 'should include the embedder host in credEmbedders')
	test.end()
})

tape('validateDsCredentials: jwt type gets expected defaults', async function (test) {
	test.timeoutAfter(500)
	test.plan(5)

	const creds: any = {
		jwtDs: {
			termdb: {
				'jwt.example.com': {
					type: 'jwt',
					secret
				}
			}
		}
	}
	const credEmbedders = await validateDsCredentials(creds, { hg38: { datasets: { jwtDs: {} } } })
	const cred = creds.jwtDs.termdb['jwt.example.com']
	test.equal(cred.authRoute, '/jwt-status', 'should set authRoute to /jwt-status for jwt type')
	test.equal(cred.headerKey, 'x-ds-access-token', 'should set default headerKey for jwt type')
	test.equal(cred.dslabel, 'jwtDs', 'should set dslabel on cred')
	test.equal(cred.route, 'termdb', 'should set route on cred')
	test.ok(credEmbedders.has('jwt.example.com'), 'should include the embedder host in credEmbedders')
	test.end()
})

tape('validateDsCredentials: wildcard route is renamed from * to /**', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const creds: any = {
		testDs: {
			'*': {
				'*': {
					type: 'basic',
					password: 'test' // pragma: allowlist secret
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
	test.ok(creds.testDs['/**'], 'should rename * route to /**')
	test.equal(creds.testDs['*'], undefined, 'should remove the original * route key')
	test.end()
})

tape('validateDsCredentials: looseIpCheck is converted to ipCheck: loose', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const creds: any = {
		testDs: {
			termdb: {
				'*': {
					type: 'basic',
					password: 'test', // pragma: allowlist secret
					looseIpCheck: true
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
	const cred = creds.testDs.termdb['*']
	test.equal(cred.ipCheck, 'loose', 'should convert looseIpCheck to ipCheck: loose')
	test.equal(cred.looseIpCheck, undefined, 'should remove looseIpCheck property')
	test.end()
})

tape('validateDsCredentials: forbidden type is accepted without error', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		testDs: {
			burden: {
				'*': {
					type: 'forbidden'
				}
			}
		}
	}
	try {
		await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
		test.pass('should not throw for forbidden type')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	}
	test.end()
})

tape('validateDsCredentials: open type is accepted without error', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		testDs: {
			termdb: {
				'*': {
					type: 'open'
				}
			}
		}
	}
	try {
		await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
		test.pass('should not throw for open type')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	}
	test.end()
})

tape('validateDsCredentials: unknown type throws an error', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		testDs: {
			termdb: {
				'*': {
					type: 'unknown-type'
				}
			}
		}
	}
	try {
		await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
		test.fail('should throw for unknown credential type')
	} catch (e) {
		test.ok(String(e).includes('unknown cred.type'), 'should throw an error mentioning unknown cred.type')
	}
	test.end()
})

tape('validateDsCredentials: cookieId is set from headerKey for termdb route', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		testDs: {
			termdb: {
				'*': {
					type: 'basic',
					password: 'test', // pragma: allowlist secret
					headerKey: 'custom-header-key'
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
	const cred = creds.testDs.termdb['*']
	test.equal(cred.cookieId, 'custom-header-key', 'should use headerKey as cookieId for termdb route')
	test.end()
})

tape('validateDsCredentials: cookieId uses dslabel+route+embedder pattern for non-termdb route', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		myDs: {
			burden: {
				myEmbedder: {
					type: 'basic',
					password: 'test' // pragma: allowlist secret
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { myDs: {} } } })
	const cred = creds.myDs.burden['myEmbedder']
	test.equal(
		cred.cookieId,
		'myDs-burden-myEmbedder-Id',
		'should set cookieId from dslabel+route+embedder for non-termdb route'
	)
	test.end()
})

tape('validateDsCredentials: legacy type=login is reshaped correctly', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const creds: any = {
		legacyDs: {
			type: 'login',
			password: 'legacyPassword' // pragma: allowlist secret
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { legacyDs: {} } } })
	test.equal(creds.legacyDs.type, undefined, 'should remove legacy type field')
	test.ok(creds.legacyDs['/**'], 'should create /** route key from legacy login type')
	const cred = creds.legacyDs['/**']['*']
	test.equal(cred.type, 'basic', 'should convert legacy type:login to type:basic')
	test.end()
})

tape('validateDsCredentials: legacy type=jwt with embedders is reshaped correctly', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const creds: any = {
		legacyJwtDs: {
			type: 'jwt',
			headerKey: 'x-custom-token',
			embedders: {
				localhost: {
					secret,
					dsnames: [{ id: 'legacyJwtDs', label: 'Legacy JWT Dataset' }]
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { legacyJwtDs: {} } } })
	test.equal(creds.legacyJwtDs.type, undefined, 'should remove legacy type field')
	test.ok(creds.legacyJwtDs.termdb, 'should create termdb route key from legacy jwt type')
	const cred = creds.legacyJwtDs.termdb['localhost']
	test.equal(cred.type, 'jwt', 'should keep type:jwt after reshaping')
	test.end()
})

tape('validateDsCredentials: deprecated secrets key throws an error', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		secrets: 'deprecated-secrets-value' // pragma: allowlist secret
	}
	try {
		await validateDsCredentials(creds, { hg38: { datasets: { termdb: {} } } })
		test.fail('should throw for deprecated secrets key')
	} catch (e) {
		test.ok(String(e).includes('deprecated'), 'should throw an error mentioning deprecated')
	}
	test.end()
})

tape('validateDsCredentials: ds-level headerKey overrides default for all routes', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		testDs: {
			headerKey: 'custom-ds-header',
			termdb: {
				'*': {
					type: 'basic',
					password: 'test' // pragma: allowlist secret
				}
			}
		}
	}
	await validateDsCredentials(creds, { hg38: { datasets: { testDs: {} } } })
	const cred = creds.testDs.termdb['*']
	test.equal(
		cred.headerKey,
		'custom-ds-header',
		'should use ds-level headerKey for cred entries that do not specify their own'
	)
	test.end()
})

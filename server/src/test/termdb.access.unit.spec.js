import tape from 'tape'
import { filterTerms } from '../termdb.server.init.ts'

tape('\n', function (test) {
	test.comment('-***- termdb access control specs -***-')
	test.end()
})

tape('filterTerms()', async function (test) {
	const req = {
		//headers:{authorization:'Bearer mock-token'}, // is this needed?
		query: {
			// lacking dslabel/embedder somehow did not cause auth.getNonsensitiveInfo to throw
			__protected__: {}
		}
	}

	const ds = {
		cohort: {
			termdb: {}
		}
	}
	const terms = [{ id: 'termRole1' }, { id: 'termRole2' }]

	{
		const result = filterTerms(req, ds, terms)
		test.deepEqual(result, terms, 'ds lacks access control and all terms are shown')
	}

	// mock a controller on ds
	ds.cohort.termdb.isTermVisible = (authResult, id) => {
		// FIXME authResult is undefined
		//console.log(2,authResult)
		return id == 'termRole1'
	}

	{
		const result = filterTerms(
			{ query: { dslabel: 'TermdbTest', embedder: 'http://localhost', __protected__: {} } },
			ds,
			terms
		)
		test.deepEqual(result, [terms[0]], '1 term left after filtering')
	}

	test.end()
})

/*
pruneTermdbConfig() — generalized contract test. The proteinpaint pipeline (in
termdb.config.ts) deep-clones tdb.plotConfigByCohort onto the per-request response object
and then invokes ds.cohort.termdb.pruneTermdbConfig?.(c, q, ds), letting the hook mutate
the cloned config. Real datasets supply their own hook with role-based pruning logic; here
we exercise the contract with a synthetic mockup that prunes cohort keys named in
q.__protected__.blockedCohorts. This keeps the suite dataset-agnostic.
*/
function buildMockupDs() {
	return {
		cohort: {
			termdb: {
				plotConfigByCohort: {
					public: { runChart: { plots: ['p1', 'p2'] } },
					restricted: { runChart: { plots: ['p3'] } }
				},
				pruneTermdbConfig(c, q, _ds) {
					if (!c.plotConfigByCohort) return
					const blocked = q?.__protected__?.blockedCohorts || []
					const fresh = {}
					for (const k of Object.keys(c.plotConfigByCohort)) {
						if (!blocked.includes(k)) fresh[k] = c.plotConfigByCohort[k]
					}
					c.plotConfigByCohort = fresh
				}
			}
		}
	}
}

tape('pruneTermdbConfig(): hook mutates response plotConfigByCohort', t => {
	const ds = buildMockupDs()
	const c = { plotConfigByCohort: structuredClone(ds.cohort.termdb.plotConfigByCohort) }
	const q = { __protected__: { blockedCohorts: ['restricted'] } }

	ds.cohort.termdb.pruneTermdbConfig(c, q, ds)

	t.deepEqual(Object.keys(c.plotConfigByCohort), ['public'], 'blocked cohort is pruned from the response')
	t.end()
})

tape('pruneTermdbConfig(): deep-clone-before-prune protects cached tdb.plotConfigByCohort across requests', t => {
	// Mirrors the termdb.config.ts pipeline: every request deep-clones tdb.plotConfigByCohort
	// onto its own response before letting the hook mutate it. Two back-to-back requests with
	// different blocklists must both see the full cached config — otherwise a prior request's
	// mutation has leaked into the cache.
	const ds = buildMockupDs()
	const cached = ds.cohort.termdb.plotConfigByCohort
	const cachedKeysBefore = Object.keys(cached)

	for (const blocked of [['restricted'], ['public']]) {
		const c = { plotConfigByCohort: structuredClone(cached) }
		const q = { __protected__: { blockedCohorts: blocked } }
		ds.cohort.termdb.pruneTermdbConfig(c, q, ds)
	}

	t.deepEqual(
		Object.keys(cached),
		cachedKeysBefore,
		'cached tdb.plotConfigByCohort still has every cohort after both requests'
	)
	t.end()
})

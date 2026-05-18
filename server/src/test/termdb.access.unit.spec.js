import tape from 'tape'
import { filterTerms } from '../termdb.server.init.ts'
import careregConfig from '../../../../dataset/sjglobal.carereg.ts'

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
filterTermdbConfig() — the carereg dataset's role-based plot-config pruner. The hook lives
on careregConfig.cohort.termdb; we build a per-test ds that wires up isTermVisible +
filterTermdbConfig + a synthetic _role2terms map, so the production hook body executes
against controllable inputs. Mirrors the carereg plot-config shape (runChart2.plots,
report.sections[].plots) at minimal size.
*/
function buildCareregDs(roleAllowlist) {
	const careregTdb = careregConfig.cohort.termdb
	const _role2terms = roleAllowlist
		? new Map(Object.entries(roleAllowlist).map(([r, ids]) => [r, new Set(ids)]))
		: undefined
	return {
		cohort: {
			termdb: {
				isTermVisible: careregTdb.isTermVisible,
				filterTermdbConfig: careregTdb.filterTermdbConfig,
				_role2terms
			}
		}
	}
}

function buildTermdbConfig() {
	return {
		plotConfigByCohort: {
			default: {
				runChart2: {
					settings: { aggregation: 'median' },
					plots: [
						{ name: 'allowed', xtw: { id: 'AGE' }, ytw: { id: 'AGE' } },
						{ name: 'mixed', xtw: { id: 'AGE' }, ytw: { id: 'BLOCKED' } },
						{ name: 'blocked', xtw: { id: 'BLOCKED' }, ytw: { id: 'AGE' } }
					]
				},
				report: {
					sections: [
						{
							name: 'Demographics',
							plots: [
								{ chartType: 'barchart', term: { id: 'AGE' } },
								{ chartType: 'barchart', term: { id: 'BLOCKED' } }
							]
						},
						{
							name: 'AllBlocked',
							plots: [{ chartType: 'barchart', term: { id: 'BLOCKED' } }]
						}
					]
				}
			}
		},
		termCollections: []
	}
}

tape('filterTermdbConfig(): public role drops non-allowlisted plots and empty sections', t => {
	const ds = buildCareregDs({ public: ['AGE'] })
	const c = buildTermdbConfig()
	const q = { __protected__: { clientAuthResult: { role: 'public' } } }

	ds.cohort.termdb.filterTermdbConfig.call(ds.cohort.termdb, c, q, ds)

	const cohort = c.plotConfigByCohort.default
	t.deepEqual(
		cohort.runChart2.plots.map(p => p.name),
		['allowed'],
		'runChart2 keeps only plots whose every term id is visible'
	)
	t.deepEqual(
		cohort.report.sections.map(s => s.name),
		['Demographics'],
		'sections with zero surviving plots are dropped'
	)
	t.deepEqual(
		cohort.report.sections[0].plots.map(p => p.term.id),
		['AGE'],
		'within a surviving section, only visible-term plots remain'
	)
	t.end()
})

tape('filterTermdbConfig(): admin role keeps every plot', t => {
	const ds = buildCareregDs({ public: ['AGE'] })
	const c = buildTermdbConfig()
	const q = { __protected__: { clientAuthResult: { role: 'admin' } } }

	ds.cohort.termdb.filterTermdbConfig.call(ds.cohort.termdb, c, q, ds)

	const cohort = c.plotConfigByCohort.default
	t.equal(cohort.runChart2.plots.length, 3, 'admin sees all runChart2 plots')
	t.equal(cohort.report.sections.length, 2, 'admin sees all report sections')
	t.end()
})

tape('filterTermdbConfig(): fail-closed when _role2terms is undefined', t => {
	const ds = buildCareregDs(undefined)
	const c = buildTermdbConfig()
	const q = { __protected__: { clientAuthResult: { role: 'public' } } }

	ds.cohort.termdb.filterTermdbConfig.call(ds.cohort.termdb, c, q, ds)

	const cohort = c.plotConfigByCohort.default
	t.deepEqual(cohort.runChart2.plots, [], 'all runChart2 plots stripped when no allowlist applies')
	t.deepEqual(cohort.report.sections, [], 'all report sections dropped when no allowlist applies')
	t.end()
})

tape('filterTermdbConfig(): no-op when isTermVisible is absent', t => {
	const ds = {
		cohort: {
			termdb: { filterTermdbConfig: careregConfig.cohort.termdb.filterTermdbConfig }
		}
	}
	const c = buildTermdbConfig()
	const before = JSON.stringify(c)
	ds.cohort.termdb.filterTermdbConfig.call(ds.cohort.termdb, c, { __protected__: {} }, ds)
	t.equal(JSON.stringify(c), before, 'response is untouched when the dataset has no isTermVisible')
	t.end()
})

tape('filterTermdbConfig(): does not mutate cached plotConfigByCohort across calls', t => {
	// Same source object passed twice with different roles — admin run must NOT see a config
	// that was already pruned by an earlier public run, which would indicate shared-reference mutation.
	const sharedSrc = buildTermdbConfig().plotConfigByCohort
	const ds = buildCareregDs({ public: ['AGE'] })

	const cPublic = { plotConfigByCohort: sharedSrc, termCollections: [] }
	ds.cohort.termdb.filterTermdbConfig.call(
		ds.cohort.termdb,
		cPublic,
		{ __protected__: { clientAuthResult: { role: 'public' } } },
		ds
	)

	const cAdmin = { plotConfigByCohort: sharedSrc, termCollections: [] }
	ds.cohort.termdb.filterTermdbConfig.call(
		ds.cohort.termdb,
		cAdmin,
		{ __protected__: { clientAuthResult: { role: 'admin' } } },
		ds
	)

	t.equal(
		cAdmin.plotConfigByCohort.default.runChart2.plots.length,
		3,
		'admin still sees all 3 plots after a prior public prune (no cached mutation)'
	)
	t.end()
})

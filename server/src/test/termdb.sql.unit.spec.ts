import tape from 'tape'
import { mayMapFilterToTermSamples } from '../termdb.sql.js'

/* a two-level dataset: patients (type 1) are the parents of samples (type 2).
survival and subtype annotate patients, purity annotates samples, and a geneVariant
term is non-dictionary and thus annotates the default (leaf) sample type */
function getDs() {
	return {
		cohort: {
			termdb: {
				sampleTypes: {
					1: { name: 'patient', plural_name: 'patients', parent_id: null },
					2: { name: 'sample', plural_name: 'samples', parent_id: 1 }
				},
				term2SampleType: new Map([
					['Event-free_survival', 1],
					['AGE_YRS', 1],
					['purity', 2]
				])
			}
		}
	}
}

const filter = { filters: 'f_0 AS (...), f AS (SELECT * FROM f_0)', CTEname: 'f', values: ['Subtype'] }
const survivalTerm = { id: 'Event-free_survival', type: 'survival' }
const sampleLevelTerm = { id: 'purity', type: 'float' }

tape('\n', test => {
	test.pass('-***- termdb.sql mayMapFilterToTermSamples -***-')
	test.end()
})

tape('mayMapFilterToTermSamples() maps a parent-level term back to parent ids', test => {
	const q = { ds: getDs(), mapParent2Children: true, sampleType: 2 }
	const mapped = mayMapFilterToTermSamples(filter, q, survivalTerm)
	test.notEqual(mapped.CTEname, filter.CTEname, 'should not reuse the child-level CTE name')
	test.ok(
		mapped.CTEname.includes('sample_ancestry') && mapped.CTEname.includes('sa.sample_id IN f'),
		'should resolve the filtered child ids to their ancestors'
	)
	test.ok(mapped.CTEname.includes('sm.sample_type = 1'), 'should restrict the ancestors to the parent sample type')
	test.equal(mapped.filters, filter.filters, 'should carry over the filter CTE definitions unchanged')
	test.deepEqual(mapped.values, filter.values, 'should carry over the filter values unchanged')
	test.equal(filter.CTEname, 'f', 'should not mutate the supplied filter')
	test.end()
})

tape('mayMapFilterToTermSamples() returns the filter unchanged when there is nothing to map', test => {
	const ds = getDs()
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: false, sampleType: 2 }, survivalTerm),
		filter,
		'no parent-to-children mapping in effect'
	)
	test.equal(
		mayMapFilterToTermSamples(null, { ds, mapParent2Children: true, sampleType: 2 }, survivalTerm),
		null,
		'no filter'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 2 }, sampleLevelTerm),
		filter,
		'term already annotates the query sample type'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 1 }, survivalTerm),
		filter,
		'query sample type is the root, thus has no parent to map to'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 3 }, survivalTerm),
		filter,
		'unknown query sample type'
	)
	test.end()
})

tape('mayMapFilterToTermSamples() leaves a non-dictionary term unmapped', test => {
	// a geneVariant term annotates the leaf sample type, which is what the filter already resolved to
	const q = { ds: getDs(), mapParent2Children: true, sampleType: 2 }
	const geneVariantTerm = { type: 'geneVariant', name: 'KRAS' }
	test.equal(mayMapFilterToTermSamples(filter, q, geneVariantTerm), filter, 'should return the filter unchanged')
	test.end()
})

import tape from 'tape'
import Database from 'better-sqlite3'
import { getAuthApi, authApi } from '../auth.js'
import { barchart_data } from '../termdb.barchart.js'
import { guardDb } from '../sql.ts'

/*
dedupedSerieses is built from each row's dedupkey1 by the same partjson template as serieses, so
a row without one is left out of it. Only a membership multivalue term1 deduplicates; for any
other term1 the two must be identical, or q.deduplicate and the client's checks would read an
empty series set.
*/

tape('\n', function (test) {
	test.comment('-***- termdb.barchart specs -***-')
	test.end()
})

tape('barchart_data: a geneVariant term1 groupset has dedupedSerieses identical to serieses', async t => {
	await ensureOpenAuth()
	const ds = makeGeneVariantDs({
		s1: { key: 'Mutated', value: 'Mutated', values: [{ dt: 1, class: 'M' }] },
		s2: { key: 'Mutated', value: 'Mutated', values: [{ dt: 1, class: 'F' }] },
		s3: { key: 'Wildtype', value: 'Wildtype', values: [{ dt: 1, class: 'WT' }] }
	})
	const result = await barchart_data({ term1: geneVariantTw({ type: 'custom-groupset' }) }, ds, ds.cohort.termdb)
	const chart = result.data.charts[0]
	t.deepEqual(
		seriesTotals(chart.serieses),
		[
			['Mutated', 2],
			['Wildtype', 1]
		],
		'serieses are the groups'
	)
	t.deepEqual(seriesTotals(chart.dedupedSerieses), seriesTotals(chart.serieses), 'dedupedSerieses are the same')
	t.end()
})

tape('barchart_data: a geneVariant term1 without groupsetting has dedupedSerieses identical to serieses', async t => {
	await ensureOpenAuth()
	const ds = makeGeneVariantDs({
		s1: { values: [{ dt: 1, class: 'M' }] },
		// two variants of one dt are combined into one series key, after the rows are built
		s2: {
			values: [
				{ dt: 1, class: 'M' },
				{ dt: 1, class: 'M' }
			]
		},
		s3: { values: [{ dt: 1, class: 'WT' }] }
	})
	const result = await barchart_data({ term1: geneVariantTw({ type: 'values' }) }, ds, ds.cohort.termdb)
	const chart = result.data.charts[0]
	t.deepEqual(
		seriesTotals(chart.serieses),
		[
			['MISSENSE', 1],
			['MISSENSE(2)', 1],
			['Wildtype', 1]
		],
		'serieses are the classes'
	)
	t.deepEqual(seriesTotals(chart.dedupedSerieses), seriesTotals(chart.serieses), 'dedupedSerieses are the same')
	t.end()
})

tape('barchart_data: a categorical term1 has dedupedSerieses identical to serieses', async t => {
	await ensureOpenAuth()
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO anno_categorical VALUES (1, 'status', 'positive'), (2, 'status', 'positive'), (3, 'status', 'negative');
	`)
	const ds = { cohort: { db: { connection }, termdb: { term2SampleType: new Map() } } }
	try {
		const result = await barchart_data(
			{
				term1: {
					$id: 'status',
					term: { id: 'status', name: 'Status', type: 'categorical' },
					q: { type: 'values' }
				}
			},
			ds,
			ds.cohort.termdb
		)
		const chart = result.data.charts[0]
		t.deepEqual(
			seriesTotals(chart.serieses),
			[
				['negative', 1],
				['positive', 2]
			],
			'serieses are the categories'
		)
		t.deepEqual(seriesTotals(chart.dedupedSerieses), seriesTotals(chart.serieses), 'dedupedSerieses are the same')
	} finally {
		connection.close()
	}
	t.end()
})

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

/* a dataset without a db, whose geneVariant query returns sample2value as given: a groupset
value already carries its group as .key, as mayGetGeneVariantData() assigns it */
function makeGeneVariantDs(sample2value) {
	return {
		label: 'MockGeneVariant',
		cohort: { termdb: { q: { id2sampleName: id => id } } },
		mayGetGeneVariantData: async tw => new Map([[tw.$id, structuredClone(sample2value)]])
	}
}

function geneVariantTw(q) {
	return {
		$id: 'tp53',
		term: {
			type: 'geneVariant',
			name: 'TP53',
			genes: [{ kind: 'gene', type: 'geneVariant', id: 'TP53', gene: 'TP53', name: 'TP53' }]
		},
		q
	}
}

/** [seriesId, total] of each series, sorted, since the two lists need not share an order */
function seriesTotals(serieses) {
	return serieses.map(s => [s.seriesId, s.total]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

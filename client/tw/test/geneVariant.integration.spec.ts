import tape from 'tape'
import type { GvTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase, GvPredefinedGS } from '../geneVariant'
import { dtsnvindel, dtcnv, dtfusionrna } from '#shared/common.js'
import { trimGvTermsForSave } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

/* a single-gene raw tw, for the tests that vary only the groupset q */
function getGsTw(q: any) {
	return {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
}

function testCnvGroupset(groupset, test) {
	test.ok(groupset.groups.length > 0, 'groupset should have at least one group')
}

function testSnvIndelGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(
		mutTvs.values,
		[
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		'mutant tvs should have mutant values'
	)
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testFusionGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(
		mutTvs.values,
		[{ key: 'Fuserna', label: 'Fusion transcript', value: 'Fuserna' }],
		'mutant tvs should have mutant values'
	)
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testSvGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(mutTvs.values, [], 'mutant tvs should have empty values because gene does not have SVs in dataset')
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testItdGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(mutTvs.values, [{ key: 'ITD', label: 'ITD', value: 'ITD' }], 'mutant tvs should have mutant values')
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

/**************
 test sections
***************/

const vocabApi: any = await getVocabApi()

tape('\n', function (test) {
	test.comment('-***- tw/geneVariant.integration -***-')
	test.end()
})

tape('fill(): invalid tw', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'categorical'
		},
		isAtomic: true,
		q: { isAtomic: true }
	}
	try {
		await GvBase.fill(tw, { vocabApi })
	} catch (e) {
		test.equal(e, "incorrect term.type='categorical', expecting 'geneVariant'", 'should throw on incorrect term.type')
	}
})

tape('fill(): no q.type', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	const expectedQ = {
		isAtomic: true,
		type: 'values',
		hiddenValues: {}
	}
	test.deepEqual(fullTw.q, expectedQ, 'should fill in q')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.end()
})

tape('fill(): q.type=values', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'values' }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	test.end()
})

tape('fill(): q.type=values, stale q.dtLst', async test => {
	// dtLst is left behind when a groupset is cleared, and would otherwise limit
	// the term to the dts of the groupset that is no longer in use
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'values', dtLst: [4] }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	test.deepEqual(
		fullTw.q,
		{ isAtomic: true, type: 'values', hiddenValues: {} },
		'should delete stale q.dtLst of a values q'
	)
	test.end()
})

tape('fill(): q.type=predefined-groupset', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [
				{
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant'
				}
			],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset' }
	}
	const fullTw: GvTW = await GvBase.fill(tw, { vocabApi })
	if (fullTw.q.type != 'predefined-groupset') throw 'q.type must be predefined-groupset'
	test.equal(fullTw.type, 'GvPredefinedGsTW', 'should fill in tw.type')
	test.equal(fullTw.q.predefined_groupset_idx, 0, 'should fill q.predefined_groupset_idx to be 0')
	test.equal(fullTw.term.childTerms.length, 5, 'should create one child term per data type')
	test.ok(
		fullTw.term.childTerms.every(term => !term.origin),
		'should keep origins off child terms'
	)
	if (!fullTw.term.groupsetting.lst) throw 'term.groupsetting.lst is missing'
	test.equal(fullTw.term.groupsetting.lst.length, 5, 'should list one predefined groupset per data type')

	/* only the selected groupset carries groups[]; the rest are name/dt listings, since
	building a groupset costs a data request per dt term (see listPredefinedGroupsets) */
	const lst = fullTw.term.groupsetting.lst as any[]
	test.ok(lst[0].groups, 'should build the groups[] of the selected groupset')
	test.ok(
		lst.slice(1).every(groupset => !groupset.groups),
		'should not build the groups[] of the unselected groupsets'
	)
	test.ok(
		lst.slice(1).every(groupset => groupset.name && Number.isInteger(groupset.dt)),
		'should list the unselected groupsets with a name and dt'
	)
	test.end()
})

tape('fill(): a defaultQ must not override an explicit q.type', async test => {
	/* a pill declares a defaultQ for the term types it accepts, e.g. getT0T2defaultQ() in
	client/plots/summaryQ.ts declares a predefined groupset for a summary term2. That is a
	default for a q that does not say, and must not rewrite one that does -- otherwise a
	remembered custom groupset handed to that pill silently becomes a predefined groupset,
	see mayShowRememberedQ() in client/termdb/handlers/geneVariant.ts */
	const customset = {
		groups: [
			{
				name: 'TP53 mutated',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'snvindel_somatic', type: 'dtsnvindel', dt: dtsnvindel, origin: 'somatic' },
								values: [{ key: 'M' }]
							}
						}
					]
				}
			}
		]
	}
	const tw: any = getGsTw({ isAtomic: true, type: 'custom-groupset', customset })
	const fullTw: GvTW = await GvBase.fill(tw, { vocabApi, defaultQ: { type: 'predefined-groupset' } })
	test.equal(fullTw.q.type, 'custom-groupset', 'should keep the q.type the caller set')
	test.equal(fullTw.type, 'GvCustomGsTW', 'should route by the kept q.type')

	// a q that does not declare a type still takes the default
	const tw2: any = getGsTw({ isAtomic: true })
	const fullTw2: GvTW = await GvBase.fill(tw2, { vocabApi, defaultQ: { type: 'predefined-groupset' } })
	test.equal(fullTw2.q.type, 'predefined-groupset', 'should apply the default to a q with no type')
	test.end()
})

tape('fill(): predefined groupset of each dt', async test => {
	// each groupset is only built when it is the selected one, so fill once per index
	for (let idx = 0; idx < 5; idx++) {
		const tw: any = {
			term: {
				name: 'TP53',
				genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
				type: 'geneVariant'
			},
			isAtomic: true,
			q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: idx }
		}
		const fullTw: any = await GvBase.fill(tw, { vocabApi })
		const groupset = fullTw.term.groupsetting.lst[idx]
		test.ok(groupset.groups, `should build the groups[] of groupset ${idx} when selected`)
		if (groupset.dt == 1) {
			testSnvIndelGroupset(groupset, test)
		} else if (groupset.dt == 2) {
			testFusionGroupset(groupset, test)
		} else if (groupset.dt == 4) {
			testCnvGroupset(groupset, test)
		} else if (groupset.dt == 5) {
			testSvGroupset(groupset, test)
		} else if (groupset.dt == 6) {
			testItdGroupset(groupset, test)
		} else {
			test.fail('unexpected groupset')
		}
	}
	test.end()
})

tape('fill(): selects a predefined groupset by q.dtLst', async test => {
	// an entry point may know a dt but not a groupset index, see launchGeneVariantPlot()
	// in client/mass/search.ts and the summarize* plots
	const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', dtLst: [dtcnv] })
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const idx = fullTw.q.predefined_groupset_idx
	test.equal(fullTw.term.groupsetting.lst[idx].name, 'CNV', 'should select the groupset of the query dt')
	test.ok(fullTw.term.groupsetting.lst[idx].groups, 'should build the selected groupset')
	test.deepEqual(fullTw.q.dtLst, [dtcnv], 'should keep q.dtLst')
	test.end()
})

tape('fill(): migrates a legacy origin-specific predefined groupset', async test => {
	const tw: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		predefined_groupset_idx: 1,
		dtLst: [dtsnvindel]
	})
	tw.term.childTerms = [
		{
			id: 'snvindel_somatic',
			query: 'snvindel',
			name: 'SNV/indel (somatic)',
			name_noOrigin: 'SNV/indel',
			type: 'dtsnvindel',
			dt: dtsnvindel,
			origin: 'somatic',
			values: {}
		},
		{
			id: 'snvindel_germline',
			query: 'snvindel',
			name: 'SNV/indel (germline)',
			name_noOrigin: 'SNV/indel',
			type: 'dtsnvindel',
			dt: dtsnvindel,
			origin: 'germline',
			values: {}
		}
	]

	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	test.deepEqual(fullTw.q.origins, ['germline'], 'should preserve the selected legacy origin as the groupset seed')
	test.deepEqual(
		fullTw.term.groupsetting.lst[0].groups[0].filter.lst[0].tvs.origins,
		['germline'],
		'should stamp the seeded origin onto the rebuilt tvs'
	)
	test.ok(
		fullTw.term.childTerms.every(term => !term.origin),
		'should rebuild origin-agnostic child terms'
	)
	test.equal(fullTw.q.predefined_groupset_idx, 0, 'should resolve the selected data type to its new groupset index')
	test.equal(fullTw.term.groupsetting.lst[0].name, 'SNV/indel', 'should use an origin-agnostic groupset')
	test.deepEqual(fullTw.q.dtLst, [dtsnvindel], 'should preserve the selected data type')
	test.end()
})

tape('fill(): migrates a trimmed legacy origin-specific predefined groupset', async test => {
	// as saved in a session, where trimGvTermsForSave() dropped term.childTerms
	const tw: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		predefined_groupset_idx: 1,
		dtLst: [dtsnvindel]
	})
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	test.deepEqual(fullTw.q.origins, ['germline'], 'should recover the legacy origin from the groupset index')
	test.equal(fullTw.q.originLabel, 'Germline', 'should derive the origin label the migration does not set')
	test.deepEqual(fullTw.q.dtLst, [dtsnvindel], 'should keep the selected data type')
	test.equal(fullTw.term.groupsetting.lst[fullTw.q.predefined_groupset_idx].name, 'SNV/indel')
	test.end()
})

tape('fill(): migrates the origin of a legacy custom groupset', async test => {
	const tvs = (origin: string) => ({
		type: 'tvs',
		tvs: {
			term: { id: `snvindel_${origin}`, type: 'dtsnvindel', dt: dtsnvindel, origin, name_noOrigin: 'SNV/indel' },
			values: [{ key: 'M', label: 'MISSENSE', value: 'M' }]
		}
	})
	const group = (name: string, origin: string) => ({
		name,
		type: 'filter',
		filter: { type: 'tvslst', in: true, join: '', lst: [tvs(origin)] }
	})
	/* the legacy shape was already per-tvs, so a groupset whose groups differ by origin
	must keep each group's own origin rather than widen both to the union */
	const tw: any = getGsTw({
		isAtomic: true,
		type: 'custom-groupset',
		customset: { name: 'legacy', groups: [group('g1', 'germline'), group('g2', 'somatic')] }
	})
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const groups = fullTw.q.customset.groups
	test.deepEqual(groups[0].filter.lst[0].tvs.origins, ['germline'], 'should move the first tvs origin onto that tvs')
	test.deepEqual(groups[1].filter.lst[0].tvs.origins, ['somatic'], 'should keep the second tvs on its own origin')
	const term = groups[0].filter.lst[0].tvs.term
	test.notOk('origin' in term || 'name_noOrigin' in term, 'should strip the legacy origin from the tvs term')
	test.end()
})

tape('trimGvTermsForSave(): a trimmed tw refills to the same tw', async test => {
	/* a session is serialized without the derived properties of a geneVariant term, so
	whatever is dropped there has to be rebuilt by fill() when the session is opened */
	/* looked up rather than hardcoded, the way the stale q.dtLst test does it. Only this
	groupset needs a seed: a trimmed tw with no origins is read as a legacy tw, whose index
	for the origin-split dt points at an origin-specific child term. The indexes of the other
	groupsets are left alone, since their q.dtLst does not match the dt that index had */
	const probeTw: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		dtLst: [dtsnvindel],
		origins: ['somatic', 'germline']
	})
	const probe: any = await GvBase.fill(probeTw, { vocabApi })
	const snvindelIdx = probe.q.predefined_groupset_idx

	for (const idx of [0, 1, 2, 3, 4]) {
		const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: idx })
		if (idx == snvindelIdx) tw.q.origins = ['somatic', 'germline']
		const fullTw: any = await GvBase.fill(tw, { vocabApi })

		// what sessionBtn.getSavableState() writes, then what opening the session reads
		const saved = trimGvTermsForSave({ term: structuredClone(fullTw) }).term
		const reopened: any = await GvBase.fill(JSON.parse(JSON.stringify(saved)), { vocabApi })

		test.deepEqual(reopened, fullTw, `groupset ${idx}: should refill to the same tw as before the trim`)
	}
	test.end()
})

tape('trimGvTermsForSave(): shrinks a saved geneVariant tw', async test => {
	// the ratio is measured on a real filled-in tw, since the redundancy that dominates it
	// (a parentTerm per child dt term, a dt term per tvs of the selected groupset) only
	// shows up at the size the dataset actually fills in
	const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 })
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const before = JSON.stringify(fullTw).length
	const after = JSON.stringify(trimGvTermsForSave({ term: structuredClone(fullTw) }).term).length
	test.comment(
		`single-gene tw: ${before} -> ${after} bytes (${Math.round((100 * (before - after)) / before)}% smaller)`
	)
	test.ok(after < before * 0.2, `should cut a single-gene tw by more than 80% (${before} -> ${after} bytes)`)

	/* term.genes[] is serialized once per childTerm.parentTerm and once per tvs of the
	selected groupset, so both the untrimmed size and the saving grow with the gene count,
	while the trimmed tw grows by just the one copy of genes[] that it keeps */
	const setTw: any = {
		term: {
			name: 'my gene set',
			genes: ['TP53', 'KRAS'].map(name => ({ kind: 'gene', id: name, gene: name, name, type: 'geneVariant' })),
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	const fullSetTw: any = await GvBase.fill(setTw, { vocabApi })
	const setBefore = JSON.stringify(fullSetTw).length
	const setAfter = JSON.stringify(trimGvTermsForSave({ term: structuredClone(fullSetTw) }).term).length
	const growthBefore = setBefore - before
	const growthAfter = setAfter - after
	test.comment(`2-gene tw: ${setBefore} -> ${setAfter} bytes`)
	test.comment(`cost of the 2nd gene: ${growthBefore} bytes untrimmed vs ${growthAfter} bytes trimmed`)
	test.ok(
		growthBefore > growthAfter * 5,
		`each added gene should cost several times more untrimmed, since genes[] is serialized once per parentTerm and per tvs (${growthBefore} vs ${growthAfter} bytes)`
	)
	test.end()
})

tape('fill(): q.type=predefined-groupset, stale q.dtLst', async test => {
	// dtLst of the previously selected groupset would otherwise limit the dts queried
	// for the term (see getDtsToQuery() in server/src/mds3.init.js)

	// looked up rather than hardcoded, so the index does not go stale whenever the dt
	// term order changes, e.g. when a dt no longer splits into origin-specific terms
	const probeQTw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', dtLst: [dtcnv] })
	const probeTw: any = await GvBase.fill(probeQTw, { vocabApi })
	const cnvIdx = probeTw.q.predefined_groupset_idx

	/* the stale dt is deliberately not the origin-split one: a legacy index for that dt
	points at an origin-specific child term, so this tw would be migrated rather than read
	as the current shape it is testing */
	const tw: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		predefined_groupset_idx: cnvIdx,
		dtLst: [dtfusionrna]
	})
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.term.groupsetting.lst[cnvIdx].name, 'CNV', 'should keep the selected groupset')
	test.equal(fullTw.q.predefined_groupset_idx, cnvIdx, 'should keep q.predefined_groupset_idx')
	test.deepEqual(fullTw.q.dtLst, [dtcnv], 'should re-derive q.dtLst from the selected groupset')
	test.end()
})

tape('fill(): q.type=custom-groupset', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [
				{
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant'
				}
			],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: customGsQ
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvCustomGsTW', 'should fill in tw.type=GvCustomGsTW')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.end()
})

tape('fill(): q.type=custom-groupset, stale mnames', async test => {
	// simulates a customset of a session saved before the mname tally became opt-in,
	// where it was stored on the dt term of every tvs
	const q: any = structuredClone(customGsQ)
	const tvsTerms = q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	for (const t of tvsTerms) {
		t.mnames = [{ mname: 'R273H', class: 'M', samplecount: 1 }]
	}
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const filled = fullTw.q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	test.equal(filled.length, tvsTerms.length, 'should keep every customset group')
	test.ok(
		filled.every(t => !('mnames' in t)),
		'should delete the stale mname tally from every tvs of the customset'
	)
	test.ok(
		filled.every(t => t.values && Object.keys(t.values).length),
		'should leave the tvs term values intact'
	)
	test.end()
})

tape('fill(): q.type=custom-groupset, re-attaches the parentTerm of each tvs', async test => {
	/* a termsetting instance is reused when the pill is switched to another term, so a
	customset can arrive naming a gene the tw is not about. it can also arrive with no
	parentTerm at all, since a saved session is trimmed of them */
	const q: any = structuredClone(customGsQ)
	const tvsTerms = q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	tvsTerms[0].parentTerm = {
		name: 'KRAS',
		type: 'geneVariant',
		genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
	}
	delete tvsTerms[1].parentTerm
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const filled = fullTw.q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	test.deepEqual(
		filled.map(t => t.parentTerm?.name),
		['TP53', 'TP53'],
		'should attach the term of the tw as the parentTerm of every tvs'
	)
	test.equal(
		filled[0].parentTerm.childTerms,
		undefined,
		'should not nest the derived childTerms[] in an attached parentTerm'
	)
	test.end()
})

tape('fill(): q.type=custom-groupset, stale q.dtLst', async test => {
	// a dtLst that disagrees with the groups would limit the dts queried for the term,
	// so a group of a dt missing from it would never match, see getDtsToQuery()
	const q: any = structuredClone(customGsQ)
	q.dtLst = [dtcnv]
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	test.deepEqual(fullTw.q.dtLst, [dtsnvindel], 'should re-derive q.dtLst from the customset groups')
	test.end()
})

tape('fill(): q.type=custom-groupset, a tvs that does not filter by dt', async test => {
	// the groups of a geneVariant groupset can only filter by dt; the server would
	// otherwise reject the customset deep in filterByItem()
	const q: any = structuredClone(customGsQ)
	q.customset.groups[0].filter.lst[0].tvs.term = { id: 'sex', type: 'categorical' }
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
	try {
		await GvBase.fill(tw, { vocabApi })
		test.fail('should throw on a customset tvs that is not a dt term')
	} catch (e: any) {
		test.ok(String(e).includes('not a dt term'), 'should throw on a customset tvs that is not a dt term')
	}
	test.end()
})

tape('getMinCopy(): trims the derived term properties', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const beforeTerm = JSON.stringify(fullTw.term)
	const xtw = new GvPredefinedGS(fullTw, { vocabApi })
	const copy: any = xtw.getMinCopy()

	// no server code reads childTerms[]
	test.equal('childTerms' in copy.term, false, 'should remove term.childTerms[]')

	// get_active_groupset() reads lst[q.predefined_groupset_idx], so the other
	// groupsets are nulled rather than removed, to keep the indexes aligned
	const idx = copy.q.predefined_groupset_idx
	const lst = copy.term.groupsetting.lst
	test.equal(lst.length, fullTw.term.groupsetting.lst.length, 'should keep the groupsetting.lst[] length')
	test.equal(lst[idx].name, fullTw.term.groupsetting.lst[idx].name, 'should keep the selected groupset')
	test.ok(
		lst.every((groupset, i) => i == idx || groupset === null),
		'should null every groupset other than the selected one'
	)

	// the dt term of every tvs of the selected groupset
	const tvsTerms: any[] = []
	const walk = (obj: any) => {
		if (!obj || typeof obj != 'object') return
		if (obj.type == 'tvs' && obj.tvs?.term) tvsTerms.push(obj.tvs.term)
		for (const k in obj) walk(obj[k])
	}
	walk(lst[idx])
	test.ok(tvsTerms.length > 0, 'selected groupset should have tvs to check')
	test.ok(
		tvsTerms.every(t => !('mnames' in t)),
		'should remove mnames from every tvs term'
	)
	/* the parent of a groupset tvs is the term of this very tw, which the payload already
	carries. the server reads the gene off tw.term, see mayFilterCnvByOverlap() */
	test.ok(
		tvsTerms.every(t => !('parentTerm' in t)),
		'should remove parentTerm from every tvs term'
	)

	// the trim is destructive, so it must only ever run on the copy
	test.equal(JSON.stringify(fullTw.term), beforeTerm, 'should not mutate the source tw.term')
	test.end()
})

tape('getTwMinCopy(): trims without mutating the source term', async test => {
	// the non-xtw path, used for the terms of a matrix data request
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const before = JSON.stringify(fullTw)
	const copy: any = vocabApi.getTwMinCopy(fullTw)

	test.equal('childTerms' in copy.term, false, 'should remove term.childTerms[] on this path too')
	test.ok(copy.term.groupsetting.lst[copy.q.predefined_groupset_idx], 'should keep the selected groupset')
	test.equal('isAtomic' in copy.q, false, 'should strip q.isAtomic from the copy')
	test.equal(fullTw.q.isAtomic, true, 'should leave q.isAtomic on the source, which rx copyMerge() reads')
	test.equal(JSON.stringify(fullTw), before, 'should not mutate the source tw')
	test.end()
})

/**********
 variables
***********/

const customGsQ = {
	isAtomic: true,
	type: 'custom-groupset',
	hiddenValues: {},
	customset: {
		groups: [
			{
				name: 'SNV/indel Missense (somatic)',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'snvindel_somatic',
									query: 'snvindel',
									name: 'SNV/indel (somatic)',
									parent_id: null,
									isleaf: true,
									type: 'dtsnvindel',
									dt: 1,
									values: {
										M: { label: 'MISSENSE' },
										F: { label: 'FRAMESHIFT' },
										WT: { label: 'Wildtype' }
									},
									name_noOrigin: 'SNV/indel',
									origin: 'somatic',
									parentTerm: {
										name: 'TP53',
										genes: [
											{
												kind: 'gene',
												id: 'TP53',
												gene: 'TP53',
												name: 'TP53',
												type: 'geneVariant'
											}
										],
										type: 'geneVariant'
									}
								},
								values: [
									{
										key: 'M',
										label: 'MISSENSE',
										value: 'M'
									}
								],
								isnot: false,
								excludeGeneName: true
							}
						}
					]
				},
				color: '#e75480'
			},
			{
				name: 'SNV/indel Wildtype (somatic)',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'snvindel_somatic',
									query: 'snvindel',
									name: 'SNV/indel (somatic)',
									parent_id: null,
									isleaf: true,
									type: 'dtsnvindel',
									dt: 1,
									values: {
										M: { label: 'MISSENSE' },
										F: { label: 'FRAMESHIFT' },
										WT: { label: 'Wildtype' }
									},
									name_noOrigin: 'SNV/indel',
									origin: 'somatic',
									parentTerm: {
										name: 'TP53',
										genes: [
											{
												kind: 'gene',
												id: 'TP53',
												gene: 'TP53',
												name: 'TP53',
												type: 'geneVariant'
											}
										],
										type: 'geneVariant'
									}
								},
								values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
								excludeGeneName: true
							}
						}
					]
				},
				color: '#0000ff'
			}
		]
	}
}

/*
The bi-/mono-allelic groupset needs a dataset with snvindel + continuous cnv + a maf
filter, which no in-repo test dataset has (TermdbTest cnv is log2ratio with no cutoffs).
So the branch is driven with a stub vocabApi. It is the only groupset that spans two
dts, so it is listed with .dts[] instead of .dt and needs both dt terms queried.
*/
function getAllelicVocabApi() {
	const queries = {
		snvindel: {
			mafFilter: {
				filter: { type: 'tvslst', join: '', in: true, lst: [] },
				terms: [{ id: 'maf', name: 'MAF', type: 'float', default: true }]
			}
		},
		cnv: { cnvGainCutoff: 0.3, cnvLossCutoff: -0.3, cnvMaxLength: 2000000 }
	}
	const classesByDt = { 1: { M: 1, F: 1, WT: 1 }, 4: { CNV_amp: 1, WT: 1 } }
	return {
		termdbConfig: { queries },
		state: { termfilter: { filter: undefined } },
		getCategories: async (_term, _filter, body) => {
			const dt = body.term1_q.dtLst[0]
			return { lst: [{ dt, classes: classesByDt[dt] }] }
		}
	}
}

tape('fill(): lists the bi-/mono-allelic groupset with its dts', async test => {
	const vocabApi: any = getAllelicVocabApi()
	const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 })
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const lst = fullTw.term.groupsetting.lst
	const allelic = lst[lst.length - 1]

	test.equal(allelic.name, 'Bi-/mono-allelic', 'should append the allelic groupset to the listing')
	test.deepEqual(allelic.dts, [dtsnvindel, dtcnv], 'should list it with .dts[] of snvindel and cnv')
	test.equal(allelic.dt, undefined, 'should not give it a single .dt')
	test.equal(allelic.groups, undefined, 'should not build it when another groupset is selected')
	test.end()
})

tape('fill(): selects and builds the allelic groupset by dtLst', async test => {
	const vocabApi: any = getAllelicVocabApi()
	const queriedDts: number[] = []
	const orig = vocabApi.getCategories
	vocabApi.getCategories = async (term: any, filter: any, body: any) => {
		queriedDts.push(body.term1_q.dtLst[0])
		return orig(term, filter, body)
	}
	// a two-dt q.dtLst can only match the allelic groupset
	const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', dtLst: [dtsnvindel, dtcnv] })
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const lst = fullTw.term.groupsetting.lst
	const idx = fullTw.q.predefined_groupset_idx

	test.equal(lst[idx].name, 'Bi-/mono-allelic', 'should select the allelic groupset from q.dtLst')
	test.equal(lst[idx].groups?.length, 2, 'should build its two groups')
	test.deepEqual(
		lst[idx].groups.map(g => g.name),
		['Bi-allelic alteration', 'Mono-allelic alteration'],
		'should build the bi- and mono-allelic groups'
	)
	test.deepEqual(
		[...new Set(queriedDts)].sort(),
		[dtsnvindel, dtcnv].sort(),
		'should query both dt terms, unlike a single-dt groupset'
	)
	test.ok(
		lst.slice(0, idx).every(gs => !gs.groups),
		'should leave the single-dt groupsets unbuilt'
	)
	test.end()
})

tape('GvPredefinedGS.getTitleText(): names the selected origins', async test => {
	const vocabApi = await getVocabApi()

	const getXtw = async (q: any) => {
		const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', dtLst: [dtsnvindel], ...q })
		const fullTw: any = await GvBase.fill(tw, { vocabApi })
		return new GvPredefinedGS(fullTw, { vocabApi })
	}

	// the label is derived by fill() from the seed, so a q carrying no label still gets one
	const oneOrigin = await getXtw({ origins: ['germline'] })
	test.equal(oneOrigin.getTitleText(), 'TP53 SNV/indel (Germline)', 'should use the dataset label of the origin')

	// empty when every origin is selected, so there is nothing to tell apart
	const allOrigins = await getXtw({ origins: ['germline', 'somatic'] })
	test.equal(allOrigins.getTitleText(), 'TP53 SNV/indel', 'should omit the label when every origin is selected')

	// no seed means every origin is queried, which is likewise nothing to tell apart
	const noOrigins = await getXtw({})
	test.equal(noOrigins.getTitleText(), 'TP53 SNV/indel', 'should omit the label without an origin seed')

	// a label left over from another selection must not survive
	const staleLabel = await getXtw({ origins: ['germline'], originLabel: 'Somatic' })
	test.equal(staleLabel.getTitleText(), 'TP53 SNV/indel (Germline)', 'should re-derive a stale origin label')

	// both qualifiers read in the order the gene search UI selects them
	const withSampleType = await getXtw({ origins: ['germline'] })
	withSampleType.term.sampleTypeLabel = 'Normals'
	test.equal(
		withSampleType.getTitleText(),
		'TP53 SNV/indel (Germline, Normals)',
		'should combine the origin and sample type labels'
	)

	test.end()
})

/* a custom groupset of one group, filtering one dt by the given origins. Uses the current
tvs.origins[] shape, so migrateLegacyOrigins() leaves it alone */
function getOriginCustomsetTw(dt: number, origins: string[]) {
	return getGsTw({
		isAtomic: true,
		type: 'custom-groupset',
		customset: {
			name: 'grps',
			groups: [
				{
					name: 'g1',
					type: 'filter',
					filter: {
						type: 'tvslst',
						in: true,
						join: '',
						lst: [
							{
								type: 'tvs',
								tvs: {
									term: { id: 'snvindel', type: dt == dtsnvindel ? 'dtsnvindel' : 'dtcnv', dt },
									origins,
									values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
									genotype: 'variant'
								}
							}
						]
					}
				}
			]
		}
	})
}

tape('fill(): rejects an unknown origin', async test => {
	const vocabApi = await getVocabApi()

	/* an unknown origin matches no value, so it would quietly empty a group rather than
	fail -- filterByItem() on the server applies the origin but cannot check it */
	const badSeed: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		dtLst: [dtsnvindel],
		origins: ['relapse']
	})
	try {
		await GvBase.fill(badSeed, { vocabApi })
		test.fail('should throw on an unknown origin seed')
	} catch (e) {
		test.equal(String(e), `unknown origin 'relapse' for dt ${dtsnvindel}`, 'should reject an unknown seed origin')
	}

	const badTvs: any = getOriginCustomsetTw(dtsnvindel, ['relapse'])
	try {
		await GvBase.fill(badTvs, { vocabApi })
		test.fail('should throw on an unknown tvs origin')
	} catch (e) {
		test.equal(String(e), `unknown origin 'relapse' for dt ${dtsnvindel}`, 'should reject an unknown customset origin')
	}

	// cnv is not origin-split, so its values carry no origin for a tvs to filter by
	const unsplitTvs: any = getOriginCustomsetTw(dtcnv, ['germline'])
	try {
		await GvBase.fill(unsplitTvs, { vocabApi })
		test.fail('should throw for origins on a dt that is not origin-split')
	} catch (e) {
		test.equal(String(e), `dt ${dtcnv} is not split by origin`, 'should reject origins on an unsplit dt')
	}

	// a seed must name origins of the groupset's own dt, so this one is an error too
	const staleSeed: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', dtLst: [dtcnv], origins: ['germline'] })
	try {
		await GvBase.fill(staleSeed, { vocabApi })
		test.fail('should throw for a seed on a dt that is not origin-split')
	} catch (e) {
		test.equal(String(e), `dt ${dtcnv} is not split by origin`, 'should reject a seed on an unsplit dt')
	}

	test.end()
})

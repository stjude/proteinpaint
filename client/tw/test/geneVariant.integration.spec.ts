import tape from 'tape'
import type { GvTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase, GvPredefinedGS } from '../geneVariant'
import { dtsnvindel, dtcnv } from '#shared/common.js'
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
	test.equal(fullTw.term.childTerms.length, 6, 'should create 6 child dt terms')
	if (!fullTw.term.groupsetting.lst) throw 'term.groupsetting.lst is missing'
	test.equal(fullTw.term.groupsetting.lst.length, 6, 'should list 6 predefined groupsets')

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

tape('fill(): predefined groupset of each dt', async test => {
	// each groupset is only built when it is the selected one, so fill once per index
	for (let idx = 0; idx < 6; idx++) {
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

tape('fill(): rehydrated predefined groupset', async test => {
	/* the somatic and germline SNV/indel groupsets both report dt=1, so a filled-in q.dtLst
	does not identify which of the two is selected. re-filling must not reselect by dt,
	otherwise a saved germline tw comes back as a somatic one */
	const germlineIdx = 1
	const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: germlineIdx })
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	test.equal(
		fullTw.term.groupsetting.lst[germlineIdx].name,
		'SNV/indel (germline)',
		'should select the germline groupset'
	)
	test.deepEqual(fullTw.q.dtLst, [dtsnvindel], 'should derive q.dtLst from the selected groupset')

	// a saved session is rehydrated by re-filling its serialized tw, see init() in mass/store.ts
	const rehydrated: any = await GvBase.fill(JSON.parse(JSON.stringify(fullTw)), { vocabApi })
	test.equal(rehydrated.q.predefined_groupset_idx, germlineIdx, 'should keep q.predefined_groupset_idx')
	test.equal(
		rehydrated.term.groupsetting.lst[rehydrated.q.predefined_groupset_idx].name,
		'SNV/indel (germline)',
		'should keep the germline groupset selected'
	)
	test.end()
})

tape('trimGvTermsForSave(): a trimmed tw refills to the same tw', async test => {
	/* a session is serialized without the derived properties of a geneVariant term, so
	whatever is dropped there has to be rebuilt by fill() when the session is opened */
	for (const idx of [0, 1, 2, 3, 4, 5]) {
		const tw: any = getGsTw({ isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: idx })
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
	const cnvIdx = 2
	const tw: any = getGsTw({
		isAtomic: true,
		type: 'predefined-groupset',
		predefined_groupset_idx: cnvIdx,
		dtLst: [dtsnvindel]
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

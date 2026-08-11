import tape from 'tape'
import { getCategories } from '../routes/termdb.categories.ts'

/*
Tests
	getCategories: geneVariant classes and mnames tally
	getCategories: geneVariant tally with byOrigin
	getCategories: mname sample-level dedupe
	getCategories: mnames partition by dt
	getCategories: same mname in both origins
	getCategories: origin bucket without mnames stays empty
	getCategories: gene of variants in a geneset term
	getCategories: mnames are omitted without withMnames
	getCategories: sv/fusion breakpoint tally
	getCategories: breakpoints of two events of one sample
	getCategories: breakpoints of events without coordinates
	getCategories: breakpoints are omitted without withMnames
*/

tape('\n', t => {
	t.pass('-***- termdb.categories unit tests -***-')
	t.end()
})

const $id = '_'

function getQ() {
	return {
		tw: {
			$id,
			term: { type: 'geneVariant', name: 'KRAS' },
			q: { type: 'values' }
		}
	}
}

tape('getCategories: geneVariant classes and mnames tally', t => {
	const data = {
		samples: {
			1: { sample: 1, [$id]: { values: [{ dt: 1, class: 'M', mname: 'G12D' }] } },
			2: { sample: 2, [$id]: { values: [{ dt: 1, class: 'M', mname: 'G12D' }] } },
			3: { sample: 3, [$id]: { values: [{ dt: 1, class: 'M', mname: 'G12V' }] } },
			4: { sample: 4, [$id]: { values: [{ dt: 1, class: 'F', mname: 'K100fs' }] } },
			5: { sample: 5, [$id]: { values: [{ dt: 1, class: 'WT' }] } },
			6: { sample: 6, [$id]: { values: [{ dt: 4, class: 'CNV_amp' }] } }
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(snvindel.classes, { M: 3, F: 1, WT: 1 }, 'classes tallied per sample')
	t.deepEqual(
		snvindel.mnames,
		[
			{ mname: 'G12D', class: 'M', samplecount: 2 },
			{ mname: 'G12V', class: 'M', samplecount: 1 },
			{ mname: 'K100fs', class: 'F', samplecount: 1 }
		],
		'mnames tallied per sample, sorted by descending sample count; WT row has no mname'
	)
	const cnv = lst.find(e => e.dt == 4)
	t.equal(cnv.mnames, undefined, 'no mnames property for dt without mname data')
	t.end()
})

tape('getCategories: geneVariant tally with byOrigin', t => {
	const ds = { assayAvailability: { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } } }
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' },
						{ dt: 1, class: 'WT', origin: 'germline' }
					]
				}
			},
			2: {
				sample: 2,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' },
						{ dt: 1, class: 'M', mname: 'P34R', origin: 'germline' }
					]
				}
			}
		}
	}
	const [lst] = getCategories(data, getQ(), ds, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(
		snvindel.mnames.byOrigin,
		{
			somatic: [{ mname: 'G12D', class: 'M', samplecount: 2 }],
			germline: [{ mname: 'P34R', class: 'M', samplecount: 1 }]
		},
		'mnames tallied separately by origin'
	)
	t.end()
})

tape('getCategories: mname sample-level dedupe', t => {
	// a sample with the same mutation reported twice should count once
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D' },
						{ dt: 1, class: 'M', mname: 'G12D' }
					]
				}
			}
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(snvindel.mnames, [{ mname: 'G12D', class: 'M', samplecount: 1 }], 'sample counted once per mname')
	t.end()
})

tape('getCategories: mnames partition by dt', t => {
	// mnames of different dts (e.g. snvindel and fusion) must not mix
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D' },
						{ dt: 2, class: 'Fuserna', mname: 'BCR-ABL1' }
					]
				}
			}
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	const fusion = lst.find(e => e.dt == 2)
	t.deepEqual(snvindel.mnames, [{ mname: 'G12D', class: 'M', samplecount: 1 }], 'snvindel entry has only its mname')
	// the fusion value here carries no breakpoint, as events of a svfusion byname query
	// may, so it is reported by noPositionCount instead of by a breakpoints list
	t.deepEqual(
		fusion.mnames,
		[{ mname: 'BCR-ABL1', class: 'Fuserna', samplecount: 1, noPositionCount: 1 }],
		'fusion entry has only its mname'
	)
	t.end()
})

tape('getCategories: same mname in both origins', t => {
	const ds = { assayAvailability: { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } } }
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' },
						{ dt: 1, class: 'M', mname: 'G12D', origin: 'germline' }
					]
				}
			}
		}
	}
	const [lst] = getCategories(data, getQ(), ds, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(
		snvindel.mnames.byOrigin,
		{
			somatic: [{ mname: 'G12D', class: 'M', samplecount: 1 }],
			germline: [{ mname: 'G12D', class: 'M', samplecount: 1 }]
		},
		'same mname counted independently per origin'
	)
	t.end()
})

tape('getCategories: origin bucket without mnames stays empty', t => {
	// all mutations are somatic; germline bucket must still be present and empty
	const ds = { assayAvailability: { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } } }
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' },
						{ dt: 1, class: 'WT', origin: 'germline' }
					]
				}
			}
		}
	}
	const [lst] = getCategories(data, getQ(), ds, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(snvindel.mnames.byOrigin.somatic, [{ mname: 'G12D', class: 'M', samplecount: 1 }], 'somatic has mname')
	t.deepEqual(snvindel.mnames.byOrigin.germline, [], 'germline bucket is an empty list')
	t.end()
})

tape('getCategories: mnames are omitted without withMnames', t => {
	// the mname tally is opt-in, so that data requests (which call this for
	// every geneVariant term and never read mnames) do not carry it
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS' },
						{ dt: 1, class: 'WT' }
					]
				}
			}
		}
	}
	{
		const [lst] = getCategories(data, getQ(), {}, $id)
		const snvindel = lst.find(e => e.dt == 1)
		t.deepEqual(snvindel.classes, { M: 1, WT: 1 }, 'classes are tallied as usual')
		t.equal('mnames' in snvindel, false, 'no mnames property by default')
	}
	{
		const ds = { assayAvailability: { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } } }
		const originData = {
			samples: {
				1: { sample: 1, [$id]: { values: [{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' }] } }
			}
		}
		const [lst] = getCategories(originData, getQ(), ds, $id)
		const snvindel = lst.find(e => e.dt == 1)
		t.equal('mnames' in snvindel, false, 'no mnames property by default, byOrigin dataset')
	}
	t.end()
})

/* fusion fixtures follow the shape of a geneVariant value of a sv/fusion event (see
mayGetGeneVariantData): .chr/.pos are the breakpoint on the queried gene AKT1, .mname is
the partner gene TP53, and .pairlst[0] holds both points with .pairlstIdx=1 telling that
the queried gene is the b{} point. modeled on TermdbTest_Fusion data, where AKT1 is fused
to TP53 at two distinct breakpoints */
function makeFusion(selfPos: number | undefined, partnerPos: number | undefined) {
	return {
		dt: 2,
		class: 'Fuserna',
		gene: 'AKT1',
		chr: 'chr14',
		pos: selfPos,
		mname: 'TP53',
		pairlstIdx: 1,
		pairlst: [
			{
				a: { chr: 'chr17', pos: partnerPos, name: 'TP53' },
				b: { chr: 'chr14', pos: selfPos, name: 'AKT1' }
			}
		]
	}
}

tape('getCategories: sv/fusion breakpoint tally', t => {
	// three samples fused at one AKT1 breakpoint, two of them sharing a TP53
	// breakpoint and the third having the other one
	const data = {
		samples: {
			1: { sample: 1, [$id]: { values: [makeFusion(104779348, 7674289)] } },
			2: { sample: 2, [$id]: { values: [makeFusion(104779348, 7674289)] } },
			3: { sample: 3, [$id]: { values: [makeFusion(104779348, 7674915)] } }
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const fusion = lst.find(e => e.dt == 2)
	t.deepEqual(
		fusion.mnames,
		[
			{
				mname: 'TP53',
				class: 'Fuserna',
				samplecount: 3,
				gene: 'AKT1',
				breakpoints: [
					{ pos: 104779348, partnerChr: 'chr17', partnerPos: 7674289, samplecount: 2 },
					{ pos: 104779348, partnerChr: 'chr17', partnerPos: 7674915, samplecount: 1 }
				]
			}
		],
		'breakpoint pairs tallied per sample, sorted by ascending position'
	)
	t.end()
})

tape('getCategories: breakpoints of two events of one sample', t => {
	/* a sample fused to the same partner twice, at different breakpoints. the mname
	entry counts the sample once, but both breakpoints must be charted, so the
	breakpoint tally must not be skipped by the mname dedupe */
	const data = {
		samples: {
			1: { sample: 1, [$id]: { values: [makeFusion(104779348, 7674289), makeFusion(104700000, 7674915)] } }
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const fusion = lst.find(e => e.dt == 2)
	t.equal(fusion.mnames[0].samplecount, 1, 'sample counted once for the mname')
	t.deepEqual(
		fusion.mnames[0].breakpoints,
		[
			{ pos: 104700000, partnerChr: 'chr17', partnerPos: 7674915, samplecount: 1 },
			{ pos: 104779348, partnerChr: 'chr17', partnerPos: 7674289, samplecount: 1 }
		],
		'both breakpoints of the sample are tallied'
	)
	t.end()
})

tape('getCategories: breakpoints of events without coordinates', t => {
	// events of a svfusion byname query may lack coordinates; they cannot be charted
	// and cannot satisfy a breakpoint range, so are reported as a separate count
	const data = {
		samples: {
			1: { sample: 1, [$id]: { values: [makeFusion(104779348, 7674289)] } },
			2: { sample: 2, [$id]: { values: [makeFusion(undefined, undefined)] } },
			3: { sample: 3, [$id]: { values: [makeFusion(104779348, undefined)] } }
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const fusion = lst.find(e => e.dt == 2)
	t.deepEqual(
		fusion.mnames[0].breakpoints,
		[{ pos: 104779348, partnerChr: 'chr17', partnerPos: 7674289, samplecount: 1 }],
		'only the event with both breakpoints is charted'
	)
	t.equal(fusion.mnames[0].noPositionCount, 2, 'samples of events missing either breakpoint are counted')
	t.equal(fusion.mnames[0].samplecount, 3, 'all samples still counted for the mname')
	t.end()
})

tape('getCategories: breakpoints are omitted without withMnames', t => {
	// the breakpoint tally rides on the mname entries, which data requests do not ask for
	const data = {
		samples: { 1: { sample: 1, [$id]: { values: [makeFusion(104779348, 7674289)] } } }
	}
	const [lst] = getCategories(data, getQ(), {}, $id)
	const fusion = lst.find(e => e.dt == 2)
	t.equal('mnames' in fusion, false, 'no mnames property, so no breakpoints either')
	t.deepEqual(fusion.classes, { Fuserna: 1 }, 'classes are tallied as usual')
	t.end()
})

tape('getCategories: gene of variants in a geneset term', t => {
	// a geneVariant term with multiple genes; the same mname in two genes
	// must be reported as two entries, each with its gene
	const data = {
		samples: {
			1: {
				sample: 1,
				[$id]: {
					values: [
						{ dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS' },
						{ dt: 1, class: 'M', mname: 'G12D', gene: 'NRAS' }
					]
				}
			},
			2: { sample: 2, [$id]: { values: [{ dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS' }] } }
		}
	}
	const [lst] = getCategories(data, getQ(), {}, $id, { withMnames: true })
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(
		snvindel.mnames,
		[
			{ mname: 'G12D', class: 'M', samplecount: 2, gene: 'KRAS' },
			{ mname: 'G12D', class: 'M', samplecount: 1, gene: 'NRAS' }
		],
		'same mname of different genes tallied separately, each with its gene'
	)
	t.end()
})

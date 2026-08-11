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
	const [lst] = getCategories(data, getQ(), {}, $id)
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
	const [lst] = getCategories(data, getQ(), ds, $id)
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
	const [lst] = getCategories(data, getQ(), {}, $id)
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
	const [lst] = getCategories(data, getQ(), {}, $id)
	const snvindel = lst.find(e => e.dt == 1)
	const fusion = lst.find(e => e.dt == 2)
	t.deepEqual(snvindel.mnames, [{ mname: 'G12D', class: 'M', samplecount: 1 }], 'snvindel entry has only its mname')
	t.deepEqual(
		fusion.mnames,
		[{ mname: 'BCR-ABL1', class: 'Fuserna', samplecount: 1 }],
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
	const [lst] = getCategories(data, getQ(), ds, $id)
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
	const [lst] = getCategories(data, getQ(), ds, $id)
	const snvindel = lst.find(e => e.dt == 1)
	t.deepEqual(snvindel.mnames.byOrigin.somatic, [{ mname: 'G12D', class: 'M', samplecount: 1 }], 'somatic has mname')
	t.deepEqual(snvindel.mnames.byOrigin.germline, [], 'germline bucket is an empty list')
	t.end()
})

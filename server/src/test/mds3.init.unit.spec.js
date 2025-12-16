import test from 'tape'
import { filterByItem, filterByTvsLst } from '../mds3.init.js'

/*
Tests:
	filterByItem: mutated sample matches filter
	filterByItem: tested sample, but no match
	filterByItem: sample not tested
	filterByItem: wildtype sample matches wildtype filter
	filterByItem: mutated sample does not match wildtype filter
	filterByItem: mcount=any
	filterByItem: mcount=single
	filterByItem: mcount=multiple
	filterByItem: mutation, origin
	filterByItem: wildtype, origin
	filterByItem: continuous CNV
	filterByTvsLst: single tvs
	filterByTvsLst: multiple tvs, OR join
	filterByTvsLst: multiple tvs, AND join
	filterByTvsLst: in=false
	filterByTvsLst: nested tvslst
*/

test('\n', t => {
	t.pass('-***- mds3.init unit tests -***-')
	t.end()
})

test('filterByItem: mutated sample matches filter', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'any'
		}
	}
	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [
		{ dt: 1, class: 'L' },
		{ dt: 1, class: 'M' }
	]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	t.end()
})

test('filterByItem: tested sample, but no match', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'any'
		}
	}
	const mlst1 = [{ dt: 1, class: 'WT' }]
	const mlst2 = [{ dt: 1, class: 'L' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	t.end()
})

test('filterByItem: sample not tested', t => {
	t.plan(8)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'any'
		}
	}
	const mlst1 = []
	const mlst2 = [{ dt: 1, class: 'Blank' }]
	const mlst3 = [{ dt: 4, class: 'CNV_amp' }]
	const mlst4 = [
		{ dt: 1, class: 'Blank' },
		{ dt: 4, class: 'CNV_amp' }
	]
	for (const mlst of [mlst1, mlst2, mlst3, mlst4]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByItem: wildtype sample matches wildtype filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			wt: true
		}
	}
	const mlst = [{ dt: 1, class: 'WT' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, true, 'Sample is tested')
	t.end()
})

test('filterByItem: mutated sample does not match wildtype filter', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			wt: true
		}
	}

	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [{ dt: 1, class: 'F' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}

	const mlst3 = [{ dt: 1, class: 'Blank' }]
	const [pass, tested] = filterByItem(filter, mlst3)
	t.equal(pass, false, 'Sample does not pass filter')
	t.equal(tested, false, 'Sample is not tested')

	t.end()
})

test('filterByItem: mcount=any', t => {
	t.plan(14)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'any'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}

	t.end()
})

test('filterByItem: mcount=single', t => {
	t.plan(12)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'single'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}

	t.end()
})

test('filterByItem: mcount=multiple', t => {
	t.plan(16)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'multiple'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}

	t.end()
})

test('filterByItem: mutation, origin', t => {
	t.plan(10)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			mcount: 'any'
		}
	}

	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'Blank', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByItem: wildtype, origin', t => {
	t.plan(10)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [],
			wt: true
		}
	}

	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'Blank', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByItem: continuous CNV', t => {
	t.plan(20)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			continuousCnv: true,
			cnvGainCutoff: 0.5,
			cnvLossCutoff: -0.5,
			cnvMaxLength: 100,
			values: [],
			cnvWT: false
		}
	}
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes cnv gain cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv gain cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes cnv loss cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv loss cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 150 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv max length')
		t.equal(tested, true, 'Sample is tested')
	}

	// wildtype filter
	filter.tvs.cnvWT = true
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass wildtype filter (cnv gain above cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes wildtype filter (cnv gain below cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass wildtype filter (cnv loss below cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes wildtype filter (cnv loss above cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}

	// not tested sample
	{
		const mlst = [{ dt: 1, class: 'M', origin: 'somatic' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter (not tested)')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByTvsLst: single tvs', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [
						{ key: 'M', label: 'MISSENSE', value: 'M' },
						{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
						{ key: 'D', label: 'PROTEINDEL', value: 'D' }
					],
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation type')
	}
	t.end()
})

test('filterByTvsLst: multiple tvs, OR join', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByTvsLst: multiple tvs, AND join', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByTvsLst: in=false', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: false,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [
						{ key: 'M', label: 'MISSENSE', value: 'M' },
						{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
						{ key: 'D', label: 'PROTEINDEL', value: 'D' }
					],
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation type')
	}
	t.end()
})

test('filterByTvsLst: nested tvslst', t => {
	t.plan(10)
	const tvslst_snvindel = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel', origin: 'germline' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					mcount: 'any'
				}
			}
		]
	}

	const tvs_cnv = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
			mcount: 'any'
		}
	}

	const filter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [tvslst_snvindel, tvs_cnv]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'Blank', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

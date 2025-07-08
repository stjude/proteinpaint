import test from 'tape'
import { filterByItem, filterByTvsLst } from '../mds3.init.js'

/*
Tests:
	filterByItem: sample has mutation for dt
	filterByItem: sample tested for dt but no mutation
	filterByItem: sample not tested for dt
	filterByItem: .isnot flag
	filterByItem: mutation origin
	filterByItem: continuous CNV
	filterByTvsLst: single tvs
	filterByTvsLst: multiple tvs, AND join
	filterByTvsLst: multiple tvs, OR join
	filterByTvsLst: in=false
	filterByTvsLst: nested tvslst
*/

test('\n', t => {
	t.pass('-***- mds3.init unit tests -***-')
	t.end()
})

test('filterByItem: sample has mutation for dt', t => {
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M' }]
		}
	}
	const mlst = [{ dt: 1, class: 'M' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, true, 'Sample is tested')
	t.end()
})

test('filterByItem: sample tested for dt but no mutation', t => {
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M' }]
		}
	}
	const mlst1 = [{ dt: 1, class: 'WT' }]
	const mlst2 = [{ dt: 1, class: 'F' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	t.end()
})

test('filterByItem: sample not tested for dt', t => {
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M' }]
		}
	}
	const mlst1 = []
	const mlst2 = [{ dt: 1, class: 'Blank' }]
	const mlst3 = [{ dt: 4, class: 'CNV_amp' }]
	for (const mlst of [mlst1, mlst2, mlst3]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	t.end()
})

test('filterByItem: .isnot flag', t => {
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M' }],
			isnot: true
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample with matching mutation should not pass when .isnot=true')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'F' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample with mismatching mutation should pass when .isnot=true')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst1 = [{ dt: 1, class: 'Blank' }]
		const mlst2 = [{ dt: 4, class: 'CNV_amp' }]
		for (const mlst of [mlst1, mlst2]) {
			const [pass, tested] = filterByItem(filter, mlst)
			t.equal(pass, false, 'Not tested sample should not pass when .isnot=true')
			t.equal(tested, false, 'Sample is not tested')
		}
	}
	t.end()
})

test('filterByItem: mutation origin', t => {
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, origin: 'somatic', type: 'dtsnvindel' },
			values: [{ key: 'M' }]
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M', origin: 'somatic' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample with matching mutation and matching origin should pass filter')
		t.equal(tested, true, 'Sample is tested for mutation+origin')
	}
	{
		const mlst = [{ dt: 1, class: 'M', origin: 'germline' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample with matching mutation but mismatching origin should not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation+origin')
	}
	{
		const mlst = [{ dt: 1, class: 'F', origin: 'somatic' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample with matching origin but mismatching mutation should not pass filter')
		t.equal(tested, true, 'Sample is tested for mutation+origin')
	}
	t.end()
})

test('filterByItem: continuous CNV', t => {
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
	const filter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: { dt: 1, type: 'dtsnvindel' }, values: [{ key: 'M' }] } }]
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested for mutation type')
	}
	{
		const mlst = [{ dt: 1, class: 'F' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested for mutation type')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation type')
	}
	t.end()
})

test('filterByTvsLst: multiple tvs, AND join', t => {
	const filter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{ type: 'tvs', tvs: { term: { dt: 1, type: 'dtsnvindel' }, values: [{ key: 'M' }] } },
			{ type: 'tvs', tvs: { term: { dt: 4, type: 'dtcnv' }, values: [{ key: 'CNV_amp' }] } }
		]
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with matches to both tvs should pass')
		t.equal(tested, true, 'Sample is tested for both mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with match to only one tvs should not pass')
		t.equal(tested, false, 'Sample is not tested for all mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_loss' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with match to one tvs and partial match to second tvs should not pass')
		t.equal(tested, true, 'Sample is tested for all mutation types')
	}
	t.end()
})

test('filterByTvsLst: multiple tvs, OR join', t => {
	const filter = {
		type: 'tvslst',
		join: 'or',
		in: true,
		lst: [
			{ type: 'tvs', tvs: { term: { dt: 1, type: 'dtsnvindel' }, values: [{ key: 'M' }] } },
			{ type: 'tvs', tvs: { term: { dt: 4, type: 'dtcnv' }, values: [{ key: 'CNV_amp' }] } }
		]
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with matches to both tvs should pass')
		t.equal(tested, true, 'Sample is tested for both mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with match to at least one tvs should pass')
		t.equal(tested, false, 'Sample is not tested for both mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_loss' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with match to one tvs and partial match to second tvs should pass')
		t.equal(tested, true, 'Sample is tested for both mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with partial match to one tvs should not pass')
		t.equal(tested, false, 'Sample is not tested for both mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F' },
			{ dt: 4, class: 'CNV_loss' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with partial match to both tvs should not pass')
		t.equal(tested, true, 'Sample is tested for both mutation types')
	}
	t.end()
})

test('filterByTvsLst: in=false', t => {
	const filter = {
		type: 'tvslst',
		join: 'and',
		in: false,
		lst: [{ type: 'tvs', tvs: { term: { dt: 1, type: 'dtsnvindel' }, values: [{ key: 'M' }] } }]
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Matching sample should not pass filter with in=false')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'F' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Mismatching sample should pass filter with in=false')
		t.equal(tested, true, 'Sample is tested')
	}
	t.end()
})

test('filterByTvsLst: nested tvslst', t => {
	const filter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				type: 'tvslst',
				join: 'or',
				in: true,
				lst: [
					{ type: 'tvs', tvs: { term: { dt: 1, origin: 'somatic', type: 'dtsnvindel' }, values: [{ key: 'M' }] } },
					{ type: 'tvs', tvs: { term: { dt: 1, origin: 'germline', type: 'dtsnvindel' }, values: [{ key: 'M' }] } }
				]
			},
			{ type: 'tvs', tvs: { term: { dt: 4, type: 'dtcnv' }, values: [{ key: 'CNV_amp' }] } }
		]
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with matches to both mutation types should pass (somatic)')
		t.equal(tested, false, 'Sample is not tested for all origins')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample with matches to both mutation types should pass (germline)')
		t.equal(tested, false, 'Sample is not tested for all origins')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 4, class: 'CNV_loss' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with match to one mutation should not pass')
		t.equal(tested, false, 'Sample is not tested for all origins')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with match to one mutation should not pass')
		t.equal(tested, false, 'Sample is not tested for all mutation types')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F', origin: 'somatic' },
			{ dt: 4, class: 'CNV_loss' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample with no match should not pass')
		t.equal(tested, false, 'Sample is not tested for all origins')
	}
	t.end()
})

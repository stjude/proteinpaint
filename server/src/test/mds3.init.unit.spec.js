import test from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { filterByItem, filterByTvsLst, mayFilterByMaf, mayValidateBcfMafFilter, setFile } from '../mds3.init.js'
import serverconfig from '../serverconfig.js'

/*
Tests:
	filterByItem: mutated sample matches filter
	filterByItem: tested sample, but no match
	filterByItem: sample not tested
	filterByItem: wildtype sample matches wildtype filter
	filterByItem: mutated sample does not match wildtype filter
	filterByItem: not tested sample matches not tested filter
	filterByItem: wildtype/mutated samples do not match not tested filter
	filterByItem: mcount=any
	filterByItem: mcount=single
	filterByItem: mcount=multiple
	filterByItem: mcount=all
	filterByItem: mutation, origin
	filterByItem: wildtype, origin
	filterByItem: continuous CNV
	filterByTvsLst: single tvs
	filterByTvsLst: multiple tvs, OR join
	filterByTvsLst: multiple tvs, AND join
	filterByTvsLst: in=false
	filterByTvsLst: nested tvslst
	mayFilterByMaf: basic mafFilter
	mayFilterByMaf: mafFilter with child ids
	mayFilterByMaf: basic mafFilter, min allelic depth
	mayFilterByMaf: mafFilter with child ids, min allelic depth
	setFile: validates and resolves files
*/

test('\n', t => {
	t.pass('-***- mds3.init unit tests -***-')
	t.end()
})

test('setFile: validates and resolves files', async t => {
	const originalTpMasterDir = serverconfig.tpmasterdir
	const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pp-setfile-'))
	serverconfig.tpmasterdir = tmpdir

	try {
		await fs.promises.mkdir(path.join(tmpdir, 'nested'))
		await fs.promises.writeFile(path.join(tmpdir, 'relative.txt'), '')
		await fs.promises.writeFile(path.join(tmpdir, 'nested', 'custom.txt'), '')
		await fs.promises.writeFile(path.join(tmpdir, 'absolute.txt'), '')

		{
			const q = { file: 'relative.txt' }
			await setFile(q, 'testType')
			t.equal(q.file, path.join(tmpdir, 'relative.txt'), 'resolves relative file against tpmasterdir')
		}
		{
			const file = path.join(tmpdir, 'absolute.txt')
			const q = { file }
			await setFile(q, 'testType')
			t.equal(q.file, file, 'keeps absolute file path under tpmasterdir')
		}
		{
			const q = { jsonFile: 'nested/custom.txt' }
			await setFile(q, 'testType', 'jsonFile')
			t.equal(q.jsonFile, path.join(tmpdir, 'nested', 'custom.txt'), 'supports custom file key')
		}

		for (const [q, expected] of [
			[{ file: 1 }, 'testType.file not string'],
			[{ file: '' }, 'testType.file empty string']
		]) {
			try {
				await setFile(q, 'testType')
				t.fail('setFile should reject invalid file value')
			} catch (e) {
				t.equal(e, expected, `throws "${expected}"`)
			}
		}

		try {
			await setFile({ file: 'missing.txt' }, 'testType')
			t.fail('setFile should reject unreadable file')
		} catch (e) {
			t.ok(String(e).includes('No such file or directory'), 'throws for unreadable file')
		}
	} finally {
		serverconfig.tpmasterdir = originalTpMasterDir
		await fs.promises.rm(tmpdir, { recursive: true, force: true })
		t.end()
	}
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
			genotype: 'variant',
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
			genotype: 'variant',
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
			genotype: 'variant',
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
})

test('filterByItem: wildtype sample matches wildtype filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'wt'
		}
	}
	const mlst = [{ dt: 1, class: 'WT' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, true, 'Sample is tested')
})

test('filterByItem: mutated sample does not match wildtype filter', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'wt'
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
})

test('filterByItem: not tested sample matches not tested filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'nt'
		}
	}
	const mlst = [{ dt: 1, class: 'Blank' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, false, 'Sample is not tested')
})

test('filterByItem: wildtype/mutated samples do not match not tested filter', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'nt'
		}
	}
	const mlst = [{ dt: 1, class: 'WT' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, false, 'Sample does not pass filter')
	t.equal(tested, true, 'Sample is tested')

	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [{ dt: 1, class: 'F' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
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
			genotype: 'variant',
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
			genotype: 'variant',
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
			genotype: 'variant',
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
})

test('filterByItem: mcount=all', t => {
	t.plan(22)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'all'
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
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, false, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, false, 'Sample is tested')
	}
})

test('filterByItem: isnot=true', t => {
	t.plan(18)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any',
			isnot: true
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
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}

	const filter2 = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'single',
			isnot: true
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
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
			genotype: 'variant',
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
})

test('filterByItem: wildtype, origin', t => {
	t.plan(10)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [],
			genotype: 'wt'
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
					genotype: 'variant',
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
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					genotype: 'variant',
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
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					genotype: 'variant',
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
					genotype: 'variant',
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
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel', origin: 'germline' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					genotype: 'variant',
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
			genotype: 'variant',
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
})

test('mayFilterByMaf: basic mafFilter', t => {
	t.plan(12)

	// start bounded, stop unbounded
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// start and stop bounded
	const mafFilter2 = structuredClone(mafFilter)
	mafFilter2.lst[0].tvs.ranges = [
		{
			start: 0.1,
			stop: 0.6,
			startinclusive: true,
			stopinclusive: true,
			startunbounded: false,
			stopunbounded: false
		}
	]

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// start unbounded, stop bounded
	const mafFilter3 = structuredClone(mafFilter)
	mafFilter3.lst[0].tvs.ranges = [{ stop: 0.6, stopinclusive: true, startunbounded: true }]

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,2' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: mafFilter with child ids', t => {
	t.plan(7)

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10', tumor_DNA_WES: '70,2' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,2', tumor_DNA_WES: '70,10' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: basic mafFilter, min allelic depth', t => {
	t.plan(11)

	// default allelic depth
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,1' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,0' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// min allelic depth = 100
	const mafFilter_100 = structuredClone(mafFilter)
	mafFilter_100.lst[0].tvs.minAllelicDepth = 100

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,40' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '140,20' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}
})

test('mayFilterByMaf: mafFilter with child ids, min allelic depth', t => {
	t.plan(14)

	// default allelic depth
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '1,1' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '1,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,1', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,0', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0', tumor_DNA_WES: '1,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// min allelic depth = 100
	const mafFilter_100 = structuredClone(mafFilter_childIds)
	mafFilter_100.lst[0].tvs.minAllelicDepth = 100

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '30,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '20,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '10,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '90,15', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '90,15', tumor_DNA_WES: '90,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: total depth filter', t => {
	t.plan(4)
	// total depth >= 100
	t.equal(mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,40' }), true, '110 passes')
	t.equal(
		mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }),
		false,
		'90 does not pass'
	)
	t.equal(
		mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }),
		true,
		'100 passes (inclusive)'
	)
	t.equal(mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M' }), false, 'unannotated does not pass')
})

test('mayFilterByMaf: alt allele depth filter', t => {
	t.plan(3)
	// alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '10,25' }), true, 'alt 25 passes')
	t.equal(
		mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }),
		false,
		'alt 15 does not pass'
	)
	t.equal(mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M' }), false, 'unannotated does not pass')
})

test('mayFilterByMaf: AND combination of maf and alt depth', t => {
	t.plan(4)
	// maf > 0.1 AND alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }), true, 'both pass')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }), false, 'only maf passes')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '300,25' }), false, 'only alt depth passes')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '300,5' }), false, 'neither passes')
})

test('mayFilterByMaf: OR combination of maf and alt depth', t => {
	t.plan(4)
	// maf > 0.1 OR alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }), true, 'both pass')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }), true, 'only maf passes')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '300,25' }), true, 'only alt depth passes')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '300,5' }), false, 'neither passes')
})

test('mayValidateBcfMafFilter: validate and auto-populate depth terms', t => {
	t.plan(11)

	const format = {
		tumor_DNA_WGS: { ID: 'tumor_DNA_WGS', Number: 'R', Type: 'Integer', Description: 'Tumor DNA WGS' },
		GT: { ID: 'GT', Number: '1', Type: 'String', isGT: true }
	}
	const makeQ = () => ({
		byrange: { _tk: { format } },
		mafFilter: {
			opts: { joinWith: ['and', 'or'] },
			filter: { type: 'tvslst', join: '', in: true, lst: [] },
			terms: [{ id: 'tumor_DNA_WGS', name: 'Tumor DNA WGS', parent_id: null, isleaf: true, type: 'float' }]
		}
	})

	const q = makeQ()
	t.doesNotThrow(() => mayValidateBcfMafFilter(q), 'does not throw on valid filter')
	t.equal(q.mafFilter.terms.length, 3, 'appended exactly 2 depth terms (1 user term + 2 generated)')
	const generated = q.mafFilter.terms.filter(tm => tm.mafFilterMode)
	t.deepEqual(
		generated.map(tm => tm.mafFilterMode).sort(),
		['altDepth', 'totalDepth'],
		'generated totalDepth and altDepth terms'
	)
	t.ok(
		generated.every(tm => tm.mafFormatKey == 'tumor_DNA_WGS'),
		'generated terms reference the source FORMAT key, GT skipped'
	)

	// idempotency: a second call does not double-append
	mayValidateBcfMafFilter(q)
	t.equal(q.mafFilter.terms.length, 3, 'second call does not double-append')

	// missing FORMAT key throws
	const qBad = makeQ()
	qBad.mafFilter.terms[0].id = 'no_such_field'
	t.throws(() => mayValidateBcfMafFilter(qBad), /unknown FORMAT key/, 'throws on unknown FORMAT key')

	// no FORMAT anywhere (neither byrange._tk.format nor q.format) throws when mafFilter present
	const qNoFormat = makeQ()
	delete qNoFormat.byrange._tk.format
	t.throws(() => mayValidateBcfMafFilter(qNoFormat), /no FORMAT/, 'throws when format missing')

	// a dataset-configured depth term with a valid mafFormatKey passes validation
	const qDepth = makeQ()
	qDepth.mafFilter.terms.push({
		id: 'my_total_depth',
		name: 'my total depth',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'totalDepth',
		mafFormatKey: 'tumor_DNA_WGS'
	})
	t.doesNotThrow(() => mayValidateBcfMafFilter(qDepth), 'configured depth term with valid mafFormatKey passes')

	// a configured depth term missing mafFormatKey throws
	const qNoKey = makeQ()
	qNoKey.mafFilter.terms.push({
		id: 'bad_depth',
		name: 'bad',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'altDepth'
	})
	t.throws(
		() => mayValidateBcfMafFilter(qNoKey),
		/missing mafFormatKey/,
		'configured depth term without mafFormatKey throws'
	)

	// a configured depth term with an unknown mafFormatKey throws
	const qBadKey = makeQ()
	qBadKey.mafFilter.terms.push({
		id: 'bad_depth',
		name: 'bad',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'totalDepth',
		mafFormatKey: 'no_such_field'
	})
	t.throws(
		() => mayValidateBcfMafFilter(qBadKey),
		/unknown FORMAT key/,
		'configured depth term with unknown mafFormatKey throws'
	)

	// an unknown mafFilterMode throws
	const qBadMode = makeQ()
	qBadMode.mafFilter.terms[0].mafFilterMode = 'bogus'
	t.throws(() => mayValidateBcfMafFilter(qBadMode), /unknown mafFilterMode/, 'unknown mafFilterMode throws')
})

const mafFilter = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS',
					name: 'Tumor DNA WGS',
					parent_id: null,
					isleaf: true,
					type: 'float',
					default: true,
					min: 0,
					max: 1
				},
				ranges: [
					{
						start: 0.1,
						startinclusive: false,
						startunbounded: false,
						stopunbounded: true
					}
				],
				minAllelicDepth: 1
			}
		}
	]
}

const mafFilter_totalDepth = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS__totalDepth',
					name: 'Tumor DNA WGS total depth',
					parent_id: null,
					isleaf: true,
					type: 'integer',
					mafFilterMode: 'totalDepth',
					mafFormatKey: 'tumor_DNA_WGS',
					min: 0
				},
				ranges: [{ start: 100, startinclusive: true, startunbounded: false, stopunbounded: true }]
			}
		}
	]
}

const mafFilter_altDepth = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS__altDepth',
					name: 'Tumor DNA WGS alt depth',
					parent_id: null,
					isleaf: true,
					type: 'integer',
					mafFilterMode: 'altDepth',
					mafFormatKey: 'tumor_DNA_WGS',
					min: 0
				},
				ranges: [{ start: 20, startinclusive: true, startunbounded: false, stopunbounded: true }]
			}
		}
	]
}

// maf > 0.1 combined with alt depth >= 20, used for AND/OR combination tests
const mafComboLst = [structuredClone(mafFilter.lst[0]), structuredClone(mafFilter_altDepth.lst[0])]
const mafFilter_and = { type: 'tvslst', join: 'and', in: true, lst: structuredClone(mafComboLst) }
const mafFilter_or = { type: 'tvslst', join: 'or', in: true, lst: structuredClone(mafComboLst) }

const mafFilter_childIds = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA',
					name: 'Tumor DNA',
					parent_id: null,
					child_ids: ['tumor_DNA_WGS', 'tumor_DNA_WES'],
					isleaf: true,
					type: 'float',
					default: true,
					min: 0,
					max: 1
				},
				ranges: [
					{
						start: 0.1,
						startinclusive: false,
						startunbounded: false,
						stopunbounded: true
					}
				],
				minAllelicDepth: 1
			}
		}
	]
}

import tape from 'tape'
import { hicData } from './hicData.ts'
import { Positions } from '../data/Positions.ts'
import { Resolution } from '../data/Resolution.ts'
import type { ChrPosition } from '../../../types/hic.ts'
import { ParseFragData } from '../data/ParseFragData.ts'
import { GridElementsFormattedData } from '../data/GridElementsFormattedData.ts'
import { FirstChrX } from '../data/FirstChrX.ts'
import { DetailCoordinates } from '../data/DetailCoodinates.ts'
import { DataMapper } from '../data/DataMapper.ts'
import * as d3s from 'd3-selection'
import { CutoffControl } from '../controls/CutoffControl.ts'
import { MatrixTypeControl } from '../controls/MatrixTypeControl.ts'
import { NormalizationMethodControl } from '../controls/NormalizationMethodControl.ts'
import type { Elem } from '../../../types/d3'
import { DetailDataFetcher } from '../../../tracks/hic/data/DetailDataFetcher.ts'

function getHolder() {
	return d3s.select('body').append('div')
}

type MockState = {
	currView: string
	x: ChrPosition
	y: ChrPosition
	minBinNum_bp: number
}

const mockHic = {
	genome: {
		chrlookup: {
			CHR1: { len: 243199373, name: 'chr1' },
			CHR2: { len: 249250621, name: 'chr2' }
		}
	},
	bpresolution: [2500000, 1000000, 500000, 250000, 100000, 50000, 25000, 10000, 5000]
}
const errLst = []
const mockError = () => errLst

const mockGenomeData = [
	{
		items: [
			[0, 0, 84176],
			[0, 2500000, 12954],
			[2500000, 2500000, 109690]
		],
		lead: 'chr1',
		follow: 'chr1'
	},
	{
		items: [
			[0, 0, 439],
			[2500000, 0, 343],
			[5000000, 0, 366]
		],
		lead: 'chr2',
		follow: 'chr1'
	},
	{
		items: [
			[0, 0, 116455],
			[0, 2500000, 19165],
			[2500000, 2500000, 83203]
		],
		lead: 'chr2',
		follow: 'chr2'
	},
	{ items: [], lead: 'chrM', follow: 'chr2' },
	{ items: [], lead: 'chrY', follow: 'chr2' }
]

const mockChrPairData = {
	items: [
		[0, 0, 90],
		[1000000, 0, 112],
		[2000000, 0, 84],
		[3000000, 0, 58],
		[4000000, 0, 77],
		[5000000, 0, 67]
	]
}

const mockDetailData = {
	items: [
		[2500000, 89550000, 1],
		[3450000, 89550000, 1],
		[4000000, 89550000, 1],
		[4050000, 89550000, 1],
		[4350000, 89550000, 1]
	]
}

const mockItems4Frag = {
	items: [
		[305702, 305703, 5],
		[305702, 305704, 3],
		[305703, 305704, 6],
		[305704, 305705, 10],
		[305705, 305706, 5],
		[305705, 305707, 3],
		[305706, 305707, 2],
		[305705, 305708, 2],
		[305706, 305708, 3],
		[305704, 305709, 1],
		[305706, 305709, 4],
		[305703, 305712, 1]
	]
}

const mockFragData = {
	x: {
		id2coord: new Map([
			[305702, [128782687, 128783313]],
			[305703, [128783313, 128783740]],
			[305704, [128783740, 128784252]],
			[305705, [128784252, 128784852]]
		]),
		start: 305702,
		stop: 305743
	},
	y: {
		id2coord: new Map([
			[305702, [128782687, 128783313]],
			[305703, [128783313, 128783740]],
			[305704, [128783740, 128784252]],
			[305705, [128784252, 128784852]]
		]),
		start: 305702,
		stop: 305743
	}
}

tape('\n', test => {
	test.comment('-***- hic app unit tracks/hic -***-')
	test.end()
})
/************* General data tests *************/

tape('DataMapper - sortData()', test => {
	test.timeoutAfter(300)
	//No need to test the differences between version 8 and 9
	test.plan(11)
	const mapper = new DataMapper(hicData.hic.v8)
	let data: any

	//Genome view
	data = mockGenomeData
	const [genomeMin, genomeMax, genomeAbsMax] = mapper.sortData(data)
	const findM = hicData.hic.v8.chrlst.indexOf('chrM')
	const findY = hicData.hic.v8.chrlst.indexOf('chrY')
	test.equal(genomeMin, 343, 'Should return the smallest number in test set for genome view min.')
	test.equal(genomeMax, 116455, 'Should return the 99 percentile of the max value for genome view max.')
	test.equal(genomeAbsMax, 116455, 'Should return the max value for genome view.')
	test.equal(findM, -1, 'Should remove chrM from hic.chrlst.')
	test.equal(findY, -1, 'Should remove chrY from hic.chrlst.')

	//Chrpair view
	data = mockChrPairData
	const [chrpairMin, chrpairMax, chrpairAbsMax] = mapper.sortData(data)
	test.equal(chrpairMin, 58, 'Should return the smallest number in test set for chrpair view min')
	test.equal(chrpairMax, 112, 'Should returnthe 99 percentile of the max value for chrpair view max')
	test.equal(chrpairAbsMax, 112, 'Should return the max value for chrpair view')

	//Detail view
	data = mockDetailData
	const [detailMin, detailMax, detailAbsMax] = mapper.sortData(data)
	test.equal(detailMin, 1, 'Should return the smallest number in test set for detail view min')
	test.equal(detailMax, 1, 'Should return the 99 percentile of the max value for detail view max')
	test.equal(detailAbsMax, 1, 'Should return the max value for detail view')
})

//TODOs
// tape.skip('parseData - parseSV()', test => {
// 	//test.plan(2)
// 	//TODO
// })

// tape.skip('parseData - parseSVheader()', test => {
// 	//test.plan(2)
// 	//TODO
// })

// tape.skip('parseData - parseSVline()', test => {
// 	//test.plan(2)
// 	//TODO
// })

tape('Positions - class and setPositions()', test => {
	test.timeoutAfter(300)
	test.plan(4)

	const positions = new Positions(mockError, 200)
	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	let result: any

	test.ok(positions instanceof Positions, 'Should construct positions class properly.')
	test.equal(positions.error, mockError, 'Should set error lst correctly.')

	result = positions.setPosition(260.12890625, 62.7734375, 3, chrx, chry, mockHic, 20)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 76709635, stop: 96709635 },
			{ chr: 'chr2', start: 10924479, stop: 30924479 }
		],
		'Should set position correctly'
	)

	//Out of bounds
	result = positions.setPosition(1000, 1000, 3, chrx, chry, mockHic, 20)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 223199373, stop: 243199373 },
			{ chr: 'chr2', start: 229250621, stop: 249250621 }
		],
		'Should handle out of bounds positions'
	)
})

tape('Resolution class', test => {
	test.timeoutAfter(300)
	test.plan(3)

	const resolution = new Resolution(mockError)
	test.ok(resolution instanceof Resolution, 'Should construct resolution class properly.')
	test.equal(
		typeof resolution.getChrPairResolution,
		'function',
		'Should have a Resolution.getChrPairResolution function'
	)
	test.equal(typeof resolution.getDefaultViewSpan, 'function', 'Should have a Resolution.getDefaultViewSpan function.')
})

tape('Resolution - getResolution()', test => {
	test.timeoutAfter(300)
	test.plan(7)
	const resolution = new Resolution(mockError)

	let result: number
	let state = {
		currView: 'genome'
	} as MockState

	//Genome view
	result = resolution.getResolution(state, mockHic)
	test.ok(Number.isInteger(result), 'Should return number for genome view resolution from general function.')
	test.equal(result, mockHic.bpresolution[0], 'Should return the first bp resolution for genome view.')

	//Chr pair
	state = {
		currView: 'chrpair',
		x: { chr: 'chr1' },
		y: { chr: 'chr2' },
		minBinNum_bp: 200
	} as MockState
	result = resolution.getResolution(state, mockHic)
	test.ok(Number.isInteger(result), 'Should return number for chr pair view resolution from general function')
	test.equal(result, 1000000, 'Should return the correct resolution for chr pair view')

	//Detail
	state = {
		currView: 'detail',
		x: { chr: 'chr2', start: 182001302, stop: 202001302 },
		y: { chr: 'chr1', start: 7626953, stop: 27626953 },
		minBinNum_bp: 200
	} as MockState
	result = resolution.getResolution(state, mockHic)
	test.ok(Number.isInteger(result), 'Should return number for detail view resolution from general function')
	test.equal(result, 50000, 'Should return the correct resolution for detail view')

	//Invalid view
	state.currView = 'abc'
	const message = 'Should throw an error for invalid view'
	try {
		result = resolution.getResolution(state, mockHic)
		test.fail(message)
	} catch (e) {
		test.pass(`${e}: ${message}`)
	}
})

tape('Resolution - getChrPairResolution()', test => {
	test.timeoutAfter(300)
	test.plan(2)
	const resolution = new Resolution(mockError)

	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	const result = resolution.getChrPairResolution(mockHic, chrx, chry, 200)
	test.ok(Number.isInteger(result), 'Should return number for chr pair resolution.')
	test.equal(result, 1000000, 'Should return the correct resolution for chr pair.')
})

tape('Resolution - getDefaultViewSpan()', test => {
	test.timeoutAfter(300)
	test.plan(2)
	const resolution = new Resolution(mockError)

	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	const result = resolution.getDefaultViewSpan(mockHic, chrx, chry, 20, 200)
	test.ok(Number.isInteger(result), 'Should return number for default span.')
	test.equal(result, 20000000, 'Should return the correct resolution for default span.')
})

/************* Data tests specific to genome and chrpair view *************/

tape('GridElementsFormattedData - formatData()', test => {
	test.timeoutAfter(300)
	test.plan(9)

	const formattedData = new GridElementsFormattedData()
	let result: number[][],
		expected: number[][],
		items = [
			[0, 0, 90],
			[1000000, 0, 112],
			[2000000, 0, 84],
			[3000000, 0, 58],
			[4000000, 0, 77],
			[5000000, 0, 67]
		],
		binpx = 3,
		resolution = 1000000,
		isFirstChrX = true,
		isIntraChr = false

	//No isFirstChrX or isIntraChr supplied, applicable for the genome view
	result = formattedData.formatData('genome', items, binpx, resolution)
	test.notEqual(result, items, 'Should return a new formated array.')
	expected = [
		[0, 0, 90],
		[3, 0, 112],
		[6, 0, 84],
		[9, 0, 58],
		[12, 0, 77],
		[15, 0, 67]
	]
	test.deepEqual(
		result,
		expected,
		`Should return the correct formatted data when neither isFirstChrX nor isIntraChr is provided.`
	)

	//X first but not intra-chromosomal
	result = formattedData.formatData('chrpair', items, binpx, resolution, isFirstChrX, isIntraChr)
	let badValues = 0
	let badCoords = 0
	for (const item of result) {
		const i = result.indexOf(item)
		if (item[2] != items[i][2]) {
			++badValues
		}
		if ((item[0] == items[i][0] && item[0] != 0) || (item[1] == items[i][1] && item[1] != 0)) {
			++badCoords
		}
	}
	test.equal(badValues, 0, 'Should return the same values in the same order.')
	test.equal(badCoords, 0, 'Should return the different coordinates for each value in the same order.')
	expected = [
		[0, 0, 90],
		[3, 0, 112],
		[6, 0, 84],
		[9, 0, 58],
		[12, 0, 77],
		[15, 0, 67]
	]
	test.deepEqual(result, expected, `Should return the correct formatted data for X first but not intra-chromosomal`)

	//Intrachromosomal and X first
	items = [
		[0, 0, 13263],
		[0, 500000, 9454],
		[500000, 50000, 20787],
		[0, 1000000, 2562]
	]
	binpx = 2
	resolution = 500000
	isFirstChrX = true
	isIntraChr = true
	result = formattedData.formatData('chrpair', items, binpx, resolution, isFirstChrX, isIntraChr)

	test.equal(result.length, items.length * 2, 'Should double size for reversed coorindates')
	let noReverse = 0
	for (const r of result) {
		const findReverse = result.find(item => item[0] == r[1] && item[1] == r[0])
		if (!findReverse) {
			++noReverse
		}
	}
	test.equal(noReverse, 0, 'Should have a reverse coordinate for each item')
	expected = [
		[0, 0, 13263],
		[0, 0, 13263],
		[0, 2, 9454],
		[2, 0, 9454],
		[2, 0, 20787],
		[0, 2, 20787],
		[0, 4, 2562],
		[4, 0, 2562]
	]
	test.deepEqual(result, expected, 'Should return the correct formatted data for intrachromosomal and X first')

	//Neither X first nor intra-chromosomal
	items = [
		[0, 0, 311],
		[1000000, 0, 94],
		[2000000, 0, 34],
		[3000000, 0, 59]
	]
	binpx = 4
	resolution = 1000000
	isFirstChrX = false
	isIntraChr = false
	result = formattedData.formatData('chrpair', items, binpx, resolution, isFirstChrX, isIntraChr)
	expected = [
		[0, 0, 311],
		[0, 4, 94],
		[0, 8, 34],
		[0, 12, 59]
	]
	test.deepEqual(result, expected, 'Should simply process the array if neither X first nor intra-chromosomal')
})

/************* Data tests specific to detail view *************/

tape('ParseFragData class', test => {
	// test.timeoutAfter(300)
	test.plan(6)
	const mockData = [
		{
			rest: ['305702'],
			chr: 'chr8',
			start: 128782687,
			stop: 128783313,
			rglst: [
				{
					idx: 0
				}
			]
		},
		{
			rest: ['305703'],
			chr: 'chr8',
			start: 128783313,
			stop: 128783740,
			rglst: [
				{
					idx: 0
				}
			]
		},
		{
			rest: ['305704'],
			chr: 'chr8',
			start: 128783740,
			stop: 128784252,
			rglst: [
				{
					idx: 0
				}
			]
		},
		{
			rest: ['305705'],
			chr: 'chr8',
			start: 128784252,
			stop: 128784852,
			rglst: [
				{
					idx: 0
				}
			]
		}
	]

	//Check class construction
	const parseFragData = new ParseFragData(errLst, mockData)
	test.ok(parseFragData instanceof ParseFragData, 'Should construct ParseFragData class properly.')
	test.ok(Array.isArray(parseFragData.errLst), 'Should set error list correctly.')
	test.ok(Array.isArray(parseFragData.items), 'Should set items array correctly.')
	test.ok(parseFragData.id2coord instanceof Map, 'Should generate a .id2coord Map.')
	test.ok(
		Number.isInteger(parseFragData.min) && parseFragData.min == 305702,
		'Should generate the correct .min as a number.'
	)
	test.ok(
		Number.isInteger(parseFragData.max) && parseFragData.max == 305705,
		'Should generate the correct .max as a number.'
	)
})

tape('FirstChrX - class and isFirstX()', test => {
	test.timeoutAfter(300)
	test.plan(5)

	let chrx = { chr: 'chr2' },
		chry = { chr: 'chr1' },
		result: any

	result = new FirstChrX(hicData.hic.v8.chrlst, chrx.chr, chry.chr)
	test.ok(result instanceof FirstChrX, 'Should construct FirstChrX class properly.')
	test.equal(typeof result.isFirstX, 'function', 'Should have a FirstChrX.isFirstX function.')

	//Not x
	result = new FirstChrX(hicData.hic.v8.chrlst, chrx.chr, chry.chr).isFirstX()
	test.equal(result, false, 'Should return false when the index of x chr is greater than y chr.')

	//X
	chrx = { chr: 'chr1' }
	chry = { chr: 'chr2' }
	result = new FirstChrX(hicData.hic.v8.chrlst, chrx.chr, chry.chr).isFirstX()
	test.equal(result, true, 'Should return true when the index of x chr is lesser than y chr.')

	//Intra-chromosomal
	chry = { chr: 'chr1' }
	result = new FirstChrX(hicData.hic.v8.chrlst, chrx.chr, chry.chr).isFirstX()
	test.equal(result, true, 'Should return true when intra-chromosomal.')
})

tape('DetailCoordinates - getCoordinates()', test => {
	test.timeoutAfter(300)
	test.plan(1)

	const coordinates = new DetailCoordinates(hicData.hic.v8, errLst)
	const chrx = { chr: 'chr2', start: 182001302, stop: 202001302 }
	const chry = { chr: 'chr1', start: 7626953, stop: 27626953 }

	let result: (number | any[])[], expected: (number | any)[]

	//No frag data
	result = coordinates.getCoordinates(chrx, chry, mockDetailData, 50000, 800)
	expected = [
		[-3699, -206, 2, 2, 1],
		[-3699, -168, 2, 2, 1],
		[-3699, -146, 2, 2, 1],
		[-3699, -144, 2, 2, 1],
		[-3699, -132, 2, 2, 1]
	]
	test.deepEqual(result, expected, 'Should return the correct coordinates when no frag data is supplied.')

	//Frag Data
	result = coordinates.getCoordinates(chrx, chry, mockItems4Frag, 50000, 800, mockFragData)
	expected = [
		[-2129, 4846, 1, 15],
		[-2129, 4846, 1, 1, 3],
		[-2129, 4846, 1, 1, 6],
		[-2129, 4846, 1, 1, 10]
	]
})

tape('DetailCoordinates - calculateCoordinates()', test => {
	test.timeoutAfter(300)
	test.plan(3)

	const coordinates = new DetailCoordinates(hicData.hic.v8, errLst)
	const xpxbp = 0.00004
	const ypxbp = 0.00004
	const resolution = 50000

	let isFirstX = false,
		isintrachr = false,
		chrx = { chr: 'chr2', start: 182001302, stop: 202001302 },
		chry = { chr: 'chr1', start: 7626953, stop: 27626953 },
		data = mockDetailData,
		result: any,
		expected: any

	//No frag data, not first x, nor intra-chromosomal
	result = coordinates.calculateCoordinates(isFirstX, isintrachr, xpxbp, ypxbp, resolution, chrx, chry, data)
	expected = [
		[-3699, -206, 2, 2, 1],
		[-3699, -168, 2, 2, 1],
		[-3699, -146, 2, 2, 1],
		[-3699, -144, 2, 2, 1],
		[-3699, -132, 2, 2, 1]
	]
	test.deepEqual(
		result,
		expected,
		'Should return the correct coordinates when no frag data is supplied and not first x or intra-chromosomal.'
	)

	//First x
	isFirstX = true
	data = {
		items: [
			[30400000, 30650000, 89],
			[30450000, 30650000, 64],
			[30500000, 30650000, 97]
		]
	}
	result = coordinates.calculateCoordinates(isFirstX, isintrachr, xpxbp, ypxbp, resolution, chrx, chry, data)
	expected = [
		[-6065, 920, 2, 2, 89],
		[-6063, 920, 2, 2, 64],
		[-6061, 920, 2, 2, 97]
	]
	test.deepEqual(
		result,
		expected,
		'Should return the correct coordinates when first x but not intra-chromosomal and no frag data provided.'
	)

	// Intra-chromosomal and First X
	isintrachr = true
	chrx = { chr: 'chr8', start: 128782746, stop: 128795246 }
	chry = { chr: 'chr8', start: 128782746, stop: 128795246 }
	result = coordinates.calculateCoordinates(
		isFirstX,
		isintrachr,
		xpxbp,
		ypxbp,
		resolution,
		chrx,
		chry,
		mockItems4Frag,
		mockFragData
	)
	expected = [
		[-1, 0, 1, 1, 5],
		[-1, 0, 1, 1, 3],
		[0, 0, 1, 1, 6],
		[0, 0, 1, 1, 6],
		[0, 0, 1, 1, 10],
		[0, 0, 1, 1, 10]
	]
	test.deepEqual(
		result,
		expected,
		'Should return the correct coordinates when is first x, intra-chromosomal, and no frag data provided.'
	)
})

tape('DetailDataFetcher - class and isFragData()', test => {
	test.timeoutAfter(300)
	test.plan(3)

	let resolution

	const fetcher = new DetailDataFetcher([])
	test.ok(fetcher instanceof DetailDataFetcher, 'Should construct DetailDataFetcher class properly.')

	//Null resolution
	resolution = null
	fetcher.isFragData(hicData.hic.v8, null)
	test.equal(resolution, null, `Should return a null resolution because hic.enzyme is present.`)

	// With resolution
	resolution = 1000000
	fetcher.isFragData(hicData.hic.v8, resolution)
	test.equal(resolution, 1000000, 'Resolution should remain unchanged.')

	// Without enzyme and null resolution
	// resolution = null
	// const copyHic = hicData.hic.v8
	// copyHic.enzyme = 'none'
	// result = fetcher.isFragData(copyHic, null)
	// test.equal(result, 5000, 'Should return the last bp resolution when enzyme is none and resolution is null.')
})

tape('DetailDataFetcher - formatFragArgs()', test => {
	test.timeoutAfter(300)
	test.plan(1)

	const fetcher = new DetailDataFetcher([])
	const copyHic = hicData.hic.v8
	copyHic['enzymefile'] = 'anno/hicFragment/hic.MboI.hg38.gz'
	const chr = { chr: 'chr1', start: 0, stop: 1000000 }
	const result = fetcher.formatFragArgs(copyHic['enzymefile'], chr)
	const expected = {
		getdata: 1,
		getBED: 1,
		file: 'anno/hicFragment/hic.MboI.hg38.gz',
		rglst: [chr]
	}
	test.deepEqual(result, expected, 'Should return the correct formatted arguments.')
})

tape('DetailDataFetcher - determinePosition()', test => {
	test.timeoutAfter(300)
	test.plan(2)

	let result: any

	const fetcher = new DetailDataFetcher([])
	const chr = { chr: 'chr1', start: 0, stop: 1000000 }
	const frag = { start: 500, stop: 5000 }
	result = fetcher.determinePosition(hicData.hic.v8, chr, frag)
	test.equal(result, '1:500:5000', 'Should return the correct position for fragment.')

	const mockHic = Object.assign(hicData.hic.v8, { nochr: false })
	result = fetcher.determinePosition(mockHic, chr, frag)
	test.equal(result, 'chr1:500:5000', 'Should return the correct position for fragment and "chr" positions.')
})

/************* Controls rendering *************/

//Test callback from Controls?
tape('CutoffControl - render()', test => {
	test.timeoutAfter(300)
	test.plan(2)
	const holder: any = getHolder()
	const value = 3
	const callback = () => {
		//TODO: Add test for callback
	}

	const cutoff = new CutoffControl(holder as Elem, value, callback)
	cutoff.render()

	const input = holder.select('input')
	test.equal(input.size(), 1, 'Should render an input element.')
	test.equal(
		input.property('value'),
		value.toString(),
		'Should set the value of the input element to the value provided.'
	)

	if (test['_ok']) holder.remove()
})

//Test callback from Controls?
tape('MatrixTypeControl - render()', test => {
	test.timeoutAfter(300)
	test.plan(2)
	const holder: any = getHolder()
	const callback = () => {
		//TODO: Add test for callback
	}

	const matrixType = new MatrixTypeControl(holder as Elem, callback)
	matrixType.render()

	const options = matrixType.matrixSelect.node().options
	test.equal(matrixType.values.length, options.length, 'Should render the correct number of options.')
	test.ok(options[0].value == 'observed' && options[0].selected, 'Should show observed as the default selected option.')

	if (test['_ok']) holder.remove()
})

//Test callback from Controls?
tape('NormalizationMethodControl - render() and update()', test => {
	test.timeoutAfter(300)
	test.plan(4)
	const holder: any = getHolder()
	const normalization = ['VC', 'VC_SQRT', 'VC_SQRT_VC']
	const defaultNmeth = 'NONE'
	const callback = () => {
		//TODO: Add test for callback
	}

	//With normalization methods
	const nmeth1 = new NormalizationMethodControl(holder as Elem, normalization, defaultNmeth, callback)
	nmeth1.render()
	test.equal(nmeth1.nmethSelect.node().tagName, 'SELECT', 'Should render a dropdown element.')
	const options = nmeth1.nmethSelect.node().options
	const includeNone = Array.from(options).some((o: any) => o.value == 'NONE')
	test.ok(!includeNone, 'Should not include a NONE option. None is set in app.')

	//No normalization methods
	const nmeth2 = new NormalizationMethodControl(holder, [], defaultNmeth, callback)
	nmeth2.render()
	test.equal(
		nmeth2.nmethSelect.node().tagName,
		'DIV',
		'Should display a simple div element when no normalization methods are available.'
	)
	test.equal(nmeth2.nmethSelect.node().innerHTML, defaultNmeth, `Should display only the default value=${defaultNmeth}`)

	if (test['_ok']) holder.remove()
})

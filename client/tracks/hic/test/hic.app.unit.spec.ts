import tape from 'tape'
import { Positions } from '../data/Positions.ts'
import { Resolution } from '../data/Resolution.ts'
import { ChrPosition } from 'types/hic.ts'

type MockState = {
	currView: string
	x: ChrPosition
	y: ChrPosition
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

const mockError = () => []

tape('\n', test => {
	test.pass('-***- app hic unit -***-')
	test.end()
})

tape('Positions - setPositions()', test => {
	test.plan(4)

	const positions = new Positions(mockError)
	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	let result: any

	test.ok(positions instanceof Positions, 'Should construct positions class properly')
	test.equal(positions.error, mockError, 'Should set error lst correctly')

	result = positions.setPosition(260.12890625, 62.7734375, 3, chrx, chry, mockHic)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 76709635, stop: 96709635 },
			{ chr: 'chr2', start: 10924479, stop: 30924479 }
		],
		'Should set position correctly'
	)

	//Out of bounds
	result = positions.setPosition(1000, 1000, 3, chrx, chry, mockHic)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 223199373, stop: 243199373 },
			{ chr: 'chr2', start: 229250621, stop: 249250621 }
		],
		'Should handle out of bounds positions'
	)

	test.end()
})

tape('Resolution class', test => {
	test.plan(5)

	const resolution = new Resolution(mockError)
	test.ok(resolution instanceof Resolution, 'Should construct resolution class properly')
	test.equal(resolution.initialBinNum, 20, 'Should set Resolution.initialBinNum to 20')
	test.equal(resolution.minBinNum_bp, 200, 'Should set Resolution.minBinNum_bp to 200')
	test.equal(
		typeof resolution.getChrPairResolution,
		'function',
		'Should have a Resolution.getChrPairResolution function'
	)
	test.equal(typeof resolution.getDefaultViewSpan, 'function', 'Should have a Resolution.getDefaultViewSpan function')

	test.end()
})

tape('Resolution - getResolution()', test => {
	test.plan(2)
	const resolution = new Resolution(mockError)

	let result: number
	let state = {
		currView: 'genome'
	}

	//Genome view
	result = resolution.getResolution(state, mockHic)
	test.equal(result, mockHic.bpresolution[0], 'Should return the first bp resolution for genome view')

	//Chr pair
	state = {
		currView: 'chrpair',
		x: { chr: 'chr1' },
		y: { chr: 'chr2' }
	} as MockState
	result = resolution.getResolution(state, mockHic)
	test.equal(result, 1000000, 'Should return the correct resolution for chr pair')

	//TODO: Detail

	//TODO: Horizontal

	test.end()
})

tape('Resolution - getChrPairResolution()', test => {
	test.plan(1)
	const resolution = new Resolution(mockError)

	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	const result = resolution.getChrPairResolution(mockHic, chrx, chry)
	test.equal(result, 1000000, 'Should return the correct resolution for chr pair')
})

tape.skip('Resolution - getDefaultViewSpan()', test => {
	test.plan(1)
	const resolution = new Resolution(mockError)
	//let result: any

	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }
})

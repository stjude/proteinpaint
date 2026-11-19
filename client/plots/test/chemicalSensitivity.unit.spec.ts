import tape from 'tape'
import { getLog10Ticks, formatPower10, getDrugIndexAtAngle, getFreeColorIndex } from '../chemicalSensitivity.ts'
import {
	getLogTicks,
	getMeasuredValues,
	getOverlayColors,
	getCurveColors
} from '../chemicalSensitivity.doseResponse.ts'
import { getColorScheme } from '#shared/common.js'

/**
 * Table of contents — chemicalSensitivity unit tests
 *
 * getLog10Ticks() / formatPower10()
 *   • integer exponents, every other one when many; 1e-4 / 0.01 / 10000 labels
 *
 * getDrugIndexAtAngle()
 *   • the first drug at 3 o'clock, the next ones anticlockwise, wrapping around
 *
 * getFreeColorIndex()
 *   • the smallest index not used, so removing a drug does not recolor the others
 *
 * getOverlayColors()
 *   • the shared scheme for the count, by color index; no limit on the number of drugs
 *
 * getCurveColors()
 *   • the replicates in the shared scheme for their count, the average in dark gray
 *
 * getLogTicks()
 *   • powers of 10, adding 2x and 5x when there are fewer than 3
 *
 * getMeasuredValues()
 *   • groups the raw values by concentration, then curve, skipping curves without raw points
 */

tape('\n', function (test) {
	test.comment('-***- plots/chemicalSensitivity -***-')
	test.end()
})

tape('getLog10Ticks() / formatPower10()', function (test) {
	test.deepEqual(getLog10Ticks(-1.5, 2.5), [-1, 0, 1, 2], 'all integer exponents when few')
	test.deepEqual(getLog10Ticks(-4, 4.4), [-4, -2, 0, 2, 4], 'even exponents when many')
	test.deepEqual([-4, -2, 0, 4].map(formatPower10), ['1e-4', '0.01', '1', '10000'], 'labels')
	test.end()
})

tape('getDrugIndexAtAngle()', function (test) {
	const n = 40,
		step = (2 * Math.PI) / n
	test.equal(getDrugIndexAtAngle(Math.PI / 2, n), 0, "3 o'clock is the first drug")
	test.equal(getDrugIndexAtAngle(Math.PI / 2 + step * 0.49, n), 0, 'just clockwise of it is still the first drug')
	test.equal(getDrugIndexAtAngle(Math.PI / 2 - step * 0.51, n), 1, 'anticlockwise is the next drug')
	test.equal(getDrugIndexAtAngle(0, n), 10, "12 o'clock")
	test.equal(getDrugIndexAtAngle(Math.PI / 2 + step, n), 39, 'clockwise of the first drug is the last one')
	test.equal(getDrugIndexAtAngle(-Math.PI, n), 30, "6 o'clock, from atan2")
	test.end()
})

tape('getFreeColorIndex()', function (test) {
	test.equal(getFreeColorIndex([]), 0, 'first drug')
	test.equal(getFreeColorIndex([{ colorIndex: 0 }, { colorIndex: 1 }]), 2, 'next index')
	test.equal(getFreeColorIndex([{ colorIndex: 0 }, { colorIndex: 2 }]), 1, 'the index of a removed drug')
	test.end()
})

tape('getOverlayColors()', function (test) {
	const drugs = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `D${i}`, colorIndex: i }))
	const three = getOverlayColors(drugs(3))
	test.deepEqual([...three.values()], getColorScheme(3).slice(0, 3), 'the scheme of 3 colors, in index order')
	const kept = getOverlayColors([
		{ name: 'D0', colorIndex: 0 },
		{ name: 'D2', colorIndex: 2 }
	])
	test.equal(kept.get('D2'), three.get('D2'), 'removing a drug keeps the colors of the others')
	const many = getOverlayColors(drugs(30))
	test.equal(new Set(many.values()).size, 30, '30 drugs get 30 distinct colors')
	test.end()
})

tape('getCurveColors()', function (test) {
	const fit = { conc: [], act: [] }
	const raw = { conc: [], act: [] }
	const colors = getCurveColors([
		{ name: 'Rep1', ic50: 1, aoc: 1, raw, fit },
		{ name: 'Rep2', ic50: 1, aoc: 1, raw, fit },
		{ name: 'Average', ic50: 1, aoc: 1, fit }
	])
	test.deepEqual(
		[colors.get('Rep1'), colors.get('Rep2')],
		getColorScheme(2).slice(0, 2),
		'replicates in the scheme of 2 colors'
	)
	test.equal(colors.get('Average'), '#333', 'the average in dark gray')
	test.end()
})

tape('getLogTicks()', function (test) {
	test.deepEqual(getLogTicks(-0.5, 4.5), [0, 1, 2, 3, 4], 'powers of 10')
	test.deepEqual(
		getLogTicks(1.9, 3.5).map(v => Math.round(10 ** v)),
		[100, 200, 500, 1000, 2000],
		'2x and 5x added for a narrow range'
	)
	test.end()
})

tape('getMeasuredValues()', function (test) {
	const curves = [
		{ name: 'Rep1', ic50: 1, aoc: 1, raw: { conc: [1, 1, 2], act: [0.9, 0.8, 0.5] }, fit: { conc: [], act: [] } },
		{ name: 'Rep2', ic50: 1, aoc: 1, raw: { conc: [1, 2], act: [0.7, 0.4] }, fit: { conc: [], act: [] } },
		{ name: 'Average', ic50: 1, aoc: 1, fit: { conc: [1], act: [0.8] } }
	]
	const m = getMeasuredValues(curves)
	test.deepEqual(
		[...m.get(1)!],
		[
			['Rep1', [0.9, 0.8]],
			['Rep2', [0.7]]
		],
		'concentration 1'
	)
	test.deepEqual(
		[...m.get(2)!],
		[
			['Rep1', [0.5]],
			['Rep2', [0.4]]
		],
		'concentration 2'
	)
	test.equal(m.size, 2, 'only raw concentrations')
	test.end()
})

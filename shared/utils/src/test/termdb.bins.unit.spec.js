import tape from 'tape'
import * as b from '../termdb.bins.js'

/**************
 test sections

validate_bins()
***************/
tape('\n', function (test) {
	test.comment('-***- termdb.bins specs -***-')
	test.end()
})

tape('compute_bins() error handling, type=regular-bin', function (test) {
	tryBin(test, null, 'should throw on empty config', 'bin schema must be an object')

	tryBin(test, {}, 'should throw on missing bin_size', 'non-numeric bin_size')

	tryBin(test, { bin_size: 'abc' }, 'should throw on non-numeric bin_size', 'non-numeric bin_size')

	tryBin(test, { bin_size: 0 }, 'should throw on bin_size <= 0', 'bin_size must be greater than 0')

	tryBin(test, { bin_size: 5 }, 'should throw on missing first_bin', 'first_bin{} missing')

	tryBin(
		test,
		{ bin_size: 5, first_bin: 'abc' },
		'should throw on a non-object first_bin',
		'first_bin{} is not an object'
	)

	tryBin(
		test,
		{ bin_size: 5, first_bin: {} },
		'should throw on an empty first_bin object',
		'first_bin is an empty object'
	)

	tryBin(
		test,
		{ bin_size: 5, first_bin: { startunbounded: 1 } },
		'should throw if missing first_bin.stop, or stop_percentile, or start',
		'first_bin.stop not a number when stop_percentile is not set'
	)

	test.end()
})

tape('compute_bins() error handling, type=custom-bin', function (test) {
	tryBin(test, null, 'should throw on empty config', 'bin schema must be an object')

	tryBin(test, { type: 'custom-bin' }, 'should throw on missing lst', 'binconfig.lst must be an array')

	tryBin(test, { type: 'custom-bin', lst: [] }, 'should throw on empty lst', 'binconfig.lst must have entries')

	tryBin(
		test,
		{ type: 'custom-bin', lst: [{}] },
		'should throw on missing *inclusive keys',
		'custom bin.startinclusive and/or bin.stopinclusive must be defined'
	)

	// first bin
	tryBin(
		test,
		{ type: 'custom-bin', lst: [{ startinclusive: 1, startunbounded: false, stop: 3 }] },
		'should throw on a custom first bin having .startunbounded: false',
		'a custom first bin must not set bin.startunbounded to false'
	)

	tryBin(
		test,
		{ type: 'custom-bin', lst: [{ startinclusive: 1, start: 0, stop: 3 }] },
		'should throw on a custom first bin having .start',
		'a custom first bin must not set a bin.start value'
	)

	tryBin(
		test,
		{ type: 'custom-bin', lst: [{ startinclusive: 1 }] },
		'should throw on a missing first bin.start value',
		'a custom first bin must define a bin.stop value'
	)

	tryBin(
		test,
		{ type: 'custom-bin', lst: [{ startinclusive: 1, stop: 'abc' }] },
		'should throw on non-numeric stop value for a first bin',
		'a custom first bin.stop value should be numeric'
	)

	// last bin
	tryBin(
		test,
		{ type: 'custom-bin', lst: [{ startinclusive: 1, stop: 2 }, { startinclusive: 1 }] },
		'should throw on a missing last bin.start value',
		'a custom last bin must define a bin.start value'
	)

	tryBin(
		test,
		{
			type: 'custom-bin',
			lst: [
				{ startinclusive: 1, stop: 2 },
				{ startinclusive: 1, start: 'abc' }
			]
		},
		'should throw on non-numeric start for a bounded last bin',
		'a custom last bin.start must be numeric'
	)

	tryBin(
		test,
		{
			type: 'custom-bin',
			lst: [
				{ startinclusive: 1, stop: 2 },
				{ startinclusive: 1, start: 3, stop: 6 }
			]
		},
		'should throw on a custom last bin having a .stop value',
		'a custom last bin must not set a bin.stop value'
	)

	tryBin(
		test,
		{
			type: 'custom-bin',
			lst: [
				{ startinclusive: 1, stop: 3 },
				{ startinclusive: 1, start: 3, stopunbounded: false }
			]
		},
		'should throw on a custom last bin having .stopunbounded: false',
		'a custom last bin must not set bin.stopunbounded to false'
	)

	// middle bin
	tryBin(
		test,
		{
			type: 'custom-bin',
			lst: [
				{ startinclusive: 1, stop: 2 },
				{ startinclusive: 1, stop: 6 },
				{ startinclusive: 1, start: 7 }
			]
		},
		'should throw on a non-numeric middle bin.start value',
		'bin.start must be numeric for a non-first bin'
	)

	tryBin(
		test,
		{
			type: 'custom-bin',
			lst: [
				{ startinclusive: 1, stop: 2 },
				{ startinclusive: 1, start: 2, stop: 'abc' },
				{ startinclusive: 1, start: 7 }
			]
		},
		'should throw on a non-numeric middle bin.stop value',
		'bin.stop must be numeric for a non-last bin'
	)

	test.end()
})

tape('get_bin_label(), label_offset>0', function (test) {
	// test smaller helper functions first since they
	// tend to get used in larger functions and the
	// testing sequence would help isolate the cause(s)
	// of multiple failing tests
	const binconfig = {
		bin_size: 3,
		startinclusive: true,
		first_bin: {},
		label_offset: 1,
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(b.get_bin_label({ startunbounded: 1, stop: 3 }, binconfig), '<3', 'startunbounded')

	test.equal(
		b.get_bin_label({ startunbounded: 1, stop: 3, stopinclusive: 1 }, binconfig),
		'≤3',
		'startunbounded + stopinclusive'
	)

	test.deepEqual(b.get_bin_label({ stopunbounded: 1, start: 30 }, binconfig), '>30', 'stopunbounded')

	test.equal(
		b.get_bin_label({ stopunbounded: 1, start: 25, startinclusive: 1 }, binconfig),
		'≥25',
		'stopunbounded + startinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, startinclusive: 1 }, binconfig),
		'1 to 4',
		'startinclusive and not stopinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, stopinclusive: 1, startinclusive: false }, binconfig),
		'>1 to 5',
		'not startinclusive but stopinclusive, so IGNORE label_offset'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, stopinclusive: 1, startinclusive: 1 }, binconfig),
		'1 to 5',
		'both startinclusive and stopinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5 }, Object.assign({}, binconfig, { startinclusive: false })),
		'>1 to <5',
		'neither startinclusive nor stopinclusive'
	)

	const binconfig2 = {
		bin_size: 1,
		startinclusive: true,
		label_offset: 1,
		first_bin: {},
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(
		b.get_bin_label({ start: 1, stop: 2 }, binconfig2),
		'1',
		'single-number label when label_offset == abs(start - stop)'
	)

	const binconfig3 = {
		label_offset: 0.01,
		rounding: '.1f',
		bin_size: 3.0,
		first_bin: {},
		startinclusive: true,
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(b.get_bin_label({ start: 0.1, stop: 0.5 }, binconfig3), '0.1 to 0.5', 'label_offset=0.1')

	test.equal(
		b.get_bin_label({ start: 30, stopunbounded: true, startinclusive: true }, binconfig),
		'≥30',
		'stopunbounded'
	)

	test.end()
})

tape('get_bin_label(), label_offset=0', function (test) {
	const binconfig = {
		bin_size: 3,
		startinclusive: true,
		first_bin: {},
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(b.get_bin_label({ startunbounded: 1, stop: 3 }, binconfig), '<3', 'startunbounded')

	test.equal(
		b.get_bin_label({ startunbounded: 1, stop: 3, stopinclusive: 1 }, binconfig),
		'≤3',
		'startunbounded + stopinclusive'
	)

	test.deepEqual(b.get_bin_label({ stopunbounded: 1, start: 30 }, binconfig), '>30', 'stopunbounded')

	test.equal(
		b.get_bin_label({ stopunbounded: 1, start: 25, startinclusive: 1 }, binconfig),
		'≥25',
		'stopunbounded + startinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, startinclusive: 1 }, binconfig),
		'1 to <5',
		'startinclusive (IGNORED) and not stopinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, stopinclusive: 1, startinclusive: false }, binconfig),
		'>1 to 5',
		'not startinclusive but stopinclusive, so IGNORE label_offset'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5, stopinclusive: 1, startinclusive: 1 }, binconfig),
		'1 to 5',
		'both startinclusive and stopinclusive'
	)

	test.equal(
		b.get_bin_label({ start: 1, stop: 5 }, Object.assign({}, binconfig, { startinclusive: false })),
		'>1 to <5',
		'neither startinclusive nor stopinclusive'
	)

	const binconfig2 = {
		bin_size: 1,
		startinclusive: true,
		label_offset: 1,
		first_bin: {},
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(
		b.get_bin_label({ start: 1, stop: 2 }, binconfig2),
		'1',
		'single-number label when label_offset == abs(start - stop)'
	)

	const binconfig3 = {
		rounding: '.1f',
		bin_size: 3.0,
		first_bin: {},
		startinclusive: true,
		results: {
			summary: {
				min: 0
			}
		}
	}
	test.equal(b.get_bin_label({ start: 0.1, stop: 0.5 }, binconfig3), '0.1 to <0.5', 'startinclusive IGNORED')

	test.equal(
		b.get_bin_label({ start: 30, stopunbounded: true, startinclusive: true }, binconfig),
		'≥30',
		'stopunbounded'
	)

	test.end()
})

tape('get_bin_label(), last bin start === stop', test => {
	const summary = {
		min: -0.0232,
		max: 0.06
	}
	const binconfig = {
		rounding: '.2f',
		bin_size: 0.03,
		startinclusive: true,
		first_bin: { startunbounded: true, stop: -0.0645461 },
		label_offset: 1
	}
	const bins = b.compute_bins(binconfig, () => summary)
	const last_bin = bins.pop()
	test.deepEqual(
		last_bin,
		{
			stopunbounded: true,
			startinclusive: true,
			stopinclusive: undefined,
			start: 0.0554539,
			label: '≥0.06',
			color: last_bin.color
		},
		'should simplify the last bin label to a one-sided value when bin start === stop'
	)
	test.end()
})

tape('get_bin_label(), force label_offset == 1', function (test) {
	const binconfig = {
		termtype: 'integer',
		bin_size: 1,
		startinclusive: true,
		first_bin: {},
		label_offset: 1,
		results: {
			summary: {
				min: 0
			}
		}
	}

	test.equal(
		b.get_bin_label({ start: 1, stop: 2 }, binconfig),
		'1',
		'should force label_offset=1 when type=="integer" && bin_size=1'
	)
	binconfig.termtype = 'float'
	test.equal(
		b.get_bin_label({ start: 1, stop: 2 }, binconfig),
		'1',
		'should NOT force label_offset=1 when type=="float" && bin_size=1'
	)
	test.end()
})

tape('get_bin_label(), user-assigned custom bin label', function (test) {
	const binconfig = {
		type: 'custom-bin',
		lst: [
			{
				startunbounded: true,
				stopinclusive: true,
				stop: 10,
				label: 'TEST ABC'
			},
			{
				start: 20,
				startinclusive: true,
				stopunbounded: true,
				label: 'TEST XYZ'
			}
		]
	}

	test.equal(
		b.get_bin_label(binconfig.lst[0], binconfig),
		binconfig.lst[0].label,
		`should apply the user-assigned bin[0] label='${binconfig.lst[0].label}'`
	)
	test.equal(
		b.get_bin_label(binconfig.lst[1], binconfig),
		binconfig.lst[1].label,
		`should apply the user-assigned bin[1] label='${binconfig.lst[1].label}'`
	)
	test.end()
})

tape('compute_bins() unbounded', function (test) {
	let bins = b.compute_bins({ bin_size: 5, label_offset: 1, first_bin: { startunbounded: 1, stop: 5 } }, get_summary)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 5, startinclusive: 1, stopinclusive: 0, label: '<5' },
			{ startinclusive: 1, stopinclusive: 0, start: 5, stop: 10, label: '5 to 9' },
			{ startinclusive: 1, stopinclusive: 0, start: 10, stop: 15, label: '10 to 14' },
			{ startinclusive: 1, stopinclusive: 0, start: 15, stopunbounded: 1, label: '≥15' }
		],
		'should default to unbounded firt and last bins, equally sized bins'
	)
	bins = b.compute_bins({ bin_size: 4, label_offset: 1, first_bin: { startunbounded: 1, stop: 2 } }, get_summary)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 2, startinclusive: 1, stopinclusive: 0, label: '<2' },
			{ startinclusive: 1, stopinclusive: 0, start: 2, stop: 6, label: '2 to 5' },
			{ startinclusive: 1, stopinclusive: 0, start: 6, stop: 10, label: '6 to 9' },
			{ startinclusive: 1, stopinclusive: 0, start: 10, stop: 14, label: '10 to 13' },
			{ startinclusive: 1, stopinclusive: 0, start: 14, stop: 18, label: '14 to 17' },
			{ startinclusive: 1, stopinclusive: 0, start: 18, stopunbounded: 1, label: '≥18' }
		],
		'should default to unbounded firt and last bins, not equally sized bins'
	)
	bins = b.compute_bins(
		{ bin_size: 6, label_offset: 1, first_bin: { startunbounded: 1, start_percentile: 4, start: 5, stop: 10 } },
		get_summary
	)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 10, startinclusive: 1, stopinclusive: 0, label: '<10' },
			{ startinclusive: 1, stopinclusive: 0, start: 10, stop: 16, label: '10 to 15' },
			{ startinclusive: 1, stopinclusive: 0, start: 16, stopunbounded: 1, label: '≥16' }
		],
		'should override start_percentile or start with startunbounded'
	)
	bins = b.compute_bins({ bin_size: 1, first_bin: { stop: 22, startinclusive: true } }, get_summary)
	removeColorAttr(bins)
	test.deepEqual(
		bins,
		[
			{
				startunbounded: true,
				start: undefined,
				stop: 22,
				startinclusive: 1,
				stopinclusive: 0,
				stopunbounded: true,
				label: '<22'
			}
		],
		'should have a valid bin.stop when there is only one bin (first bin === last bin)'
	)

	test.end()
})
function removeColorAttr(bins) {
	for (const bin of bins) delete bin.color
}

tape('compute_bins() non-percentile', function (test) {
	let bins = b.compute_bins({ bin_size: 3, label_offset: 1, first_bin: { stop: 8 } }, get_summary)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: true, start: undefined, stop: 8, startinclusive: 1, stopinclusive: 0, label: '<8' },
			{ startinclusive: 1, stopinclusive: 0, start: 8, stop: 11, label: '8 to 10' },
			{ startinclusive: 1, stopinclusive: 0, start: 11, stop: 14, label: '11 to 13' },
			{ startinclusive: 1, stopinclusive: 0, start: 14, stop: 17, label: '14 to 16' },
			{ stopunbounded: true, startinclusive: 1, stopinclusive: 0, start: 17, label: '≥17' }
		],
		'should handle first_bin.stop'
	)
	bins = b.compute_bins({ bin_size: 4, label_offset: 1, first_bin: { stop: 8 }, last_bin: { start: 12 } }, get_summary)
	removeColorAttr(bins)

	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: true, start: undefined, stop: 8, startinclusive: 1, stopinclusive: 0, label: '<8' },
			{ startinclusive: 1, stopinclusive: 0, start: 8, stop: 12, label: '8 to 11' },
			{ stopunbounded: true, startinclusive: 1, stopinclusive: 0, start: 12, label: '≥12' }
		],
		'should handle last_bin.start'
	)
	bins = b.compute_bins(
		{ bin_size: 3, label_offset: 1, first_bin: { startunbounded: 1, stop: 3 }, last_bin: { start: 15 } },
		get_summary
	)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 3, startinclusive: 1, stopinclusive: 0, label: '<3' },
			{ startinclusive: 1, stopinclusive: 0, start: 3, stop: 6, label: '3 to 5' },
			{ startinclusive: 1, stopinclusive: 0, start: 6, stop: 9, label: '6 to 8' },
			{ startinclusive: 1, stopinclusive: 0, start: 9, stop: 12, label: '9 to 11' },
			{ startinclusive: 1, stopinclusive: 0, start: 12, stop: 15, label: '12 to 14' },
			{ stopunbounded: 1, startinclusive: 1, stopinclusive: 0, start: 15, label: '≥15' }
		],
		'should handle last_bin.start + stop'
	)
	bins = b.compute_bins(
		{
			bin_size: 1,
			label_offset: 1,
			first_bin: { start: 5, stopunbounded: 1, stop: 7, stopinclusive: 1 },
			last_bin: { start: 12, stopunbounded: 1 }
		},
		get_summary
	)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 7, startinclusive: 1, stopinclusive: 0, label: '<7' },
			{ startinclusive: 1, stopinclusive: 0, start: 7, stop: 8, label: 7 },
			{ startinclusive: 1, stopinclusive: 0, start: 8, stop: 9, label: 8 },
			{ startinclusive: 1, stopinclusive: 0, start: 9, stop: 10, label: 9 },
			{ startinclusive: 1, stopinclusive: 0, start: 10, stop: 11, label: 10 },
			{ startinclusive: 1, stopinclusive: 0, start: 11, stop: 12, label: 11 },
			{ startinclusive: 1, stopinclusive: 0, start: 12, stopunbounded: true, label: '≥12' }
		],
		'should handle first_bins, last_bin'
	)

	test.end()
})

tape('target_percentiles()', function (test) {
	test.deepLooseEqual(
		b.target_percentiles(
			{ bin_size: 3, label_offset: 1, first_bin: { startunbounded: 1, stop_percentile: 4 } },
			get_summary
		),
		[4],
		'should find the first_bin.stop_percentile'
	)

	test.deepLooseEqual(
		b.target_percentiles(
			{
				bin_size: 3,
				label_offset: 1,
				first_bin: { stopunbounded: 1, start_percentile: 80 }
			},
			get_summary
		),
		[80],
		'should find the first_bin.stop_percentile'
	)

	test.deepLooseEqual(
		b.target_percentiles(
			{
				bin_size: 3,
				label_offset: 1,
				first_bin: { startunbounded: 1, start_percentile: 10, stop_percentile: 20 },
				last_bin: { stopunbounded: 1, start_percentile: 80, stop_percentile: 95 }
			},
			get_summary
		),
		[10, 20, 80, 95],
		'should find all configured percentiles'
	)

	test.end()
})

tape('compute_bins() percentile', function (test) {
	let bins = b.compute_bins({ bin_size: 3, label_offset: 1, first_bin: { stop_percentile: 25 } }, get_summary)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 5, startinclusive: 1, stopinclusive: 0, label: '<5' },
			{ startinclusive: 1, stopinclusive: 0, start: 5, stop: 8, label: '5 to 7' },
			{ startinclusive: 1, stopinclusive: 0, start: 8, stop: 11, label: '8 to 10' },
			{ startinclusive: 1, stopinclusive: 0, start: 11, stop: 14, label: '11 to 13' },
			{ startinclusive: 1, stopinclusive: 0, start: 14, stop: 17, label: '14 to 16' },
			{ startinclusive: 1, stopinclusive: 0, start: 17, stopunbounded: 1, label: '≥17' }
		],
		'should handle first_bin.stop_percentile'
	)
	bins = b.compute_bins(
		{ bin_size: 4, label_offset: 1, first_bin: { stop: 8 }, last_bin: { start_percentile: 90 } },
		get_summary
	)
	removeColorAttr(bins)
	test.deepLooseEqual(
		bins,
		[
			{ startunbounded: 1, start: undefined, stop: 8, startinclusive: 1, stopinclusive: 0, label: '<8' },
			{ startinclusive: 1, stopinclusive: 0, start: 8, stop: 12, label: '8 to 11' },
			{ startinclusive: 1, stopinclusive: 0, start: 12, stop: 16, label: '12 to 15' },
			{ startinclusive: 1, stopinclusive: 0, start: 16, stop: 18, label: '16 to 17' },
			{ startinclusive: 1, stopinclusive: 0, start: 18, stopunbounded: 1, label: '≥18' }
		],
		'should handle last_bin.start_percentile'
	)
	/*
	test.deepLooseEqual(
		b.compute_bins(
			{
				bin_size: 4,
				label_offset: 1,
				first_bin: { start: 5 },
				last_bin: { start_percentile: 80, stop_percentile: 95 }
			},
			get_summary
		),
		[
			{ startunbounded: 1, start: 5, stop: 9, startinclusive: 1, stopinclusive: 0, label: '5 to 8' },
			{ startinclusive: 1, stopinclusive: 0, start: 9, stop: 13, label: '9 to 12' },
			{ startinclusive: 1, stopinclusive: 0, start: 13, stop: 16, label: '13 to 15' },
			{ startinclusive: 1, stopinclusive: 0, start: 16, stop: 19, label: '16 to 18' }
		],
		'should handle last_bin.start_percentile + stop_percentile'
	)
*/
	test.end()
})

tape('compute_bins() wgs_sample_age', function (test) {
	const stop = 17.1834269032
	const binconfig = {
		type: 'regular-bin',
		bin_size: 13,
		label_offset: 1,
		startinclusive: true,
		rounding: 'd',
		first_bin: {
			startunbounded: true,
			stop,
			stopinclusive: true
		}
	}
	const bins = b.compute_bins(binconfig, () => {
		return { vmin: 4, vmax: 66, max: 66, min: 4 }
	})
	test.equal(bins.length, 5, 'should create 5 bins')
	test.equal(bins[0].label, '<' + Math.round(stop), 'should include the rounded first bin stop value in the bin label')
	test.equal(bins[4].label, '≥56', 'should include decimals in the last bin label')
	test.end()
})

tape('compute_bins() custom', function (test) {
	const binconfig = {
		type: 'custom-bin',
		lst: [
			{
				startunbounded: true,
				stopinclusive: true,
				stop: 10
			},
			{
				start: 20,
				startinclusive: true,
				stopunbounded: true
			}
		]
	}
	test.deepEqual(b.compute_bins(binconfig), binconfig.lst, 'should simply copy binconfig.lst')
	test.end()
})

tape('compute_bins() single unique value (0)', function (test) {
	const binconfig = {
		type: 'custom-bin',
		lst: [
			{ stop: 0, stopinclusive: false, startunbounded: true, label: '<' + 0 },
			{ start: 0, stop: 0, startinclusive: true, stopinclusive: true, label: '=' + 0 },
			{ start: 0, startinclusive: false, stopunbounded: true, label: '>' + 0 }
		]
	}
	let bins = b.compute_bins(binconfig)
	removeColorAttr(bins)
	test.deepEqual(
		bins,
		[
			{ stop: 0, stopinclusive: false, startunbounded: true, label: '<' + 0 },
			{ start: 0, stop: 0, startinclusive: true, stopinclusive: true, label: '=' + 0 },
			{ start: 0, startinclusive: false, stopunbounded: true, label: '>' + 0 }
		],
		'should create 3 bins: one less than value, one equal to value, and one greater than value'
	)
	test.end()
})

tape('compute_bins() single unique value (3)', function (test) {
	const binconfig = {
		type: 'custom-bin',
		lst: [
			{ stop: 3, stopinclusive: false, startunbounded: true, label: '<' + 3 },
			{ start: 3, stop: 3, startinclusive: true, stopinclusive: true, label: '=' + 3 },
			{ start: 3, startinclusive: false, stopunbounded: true, label: '>' + 3 }
		]
	}
	let bins = b.compute_bins(binconfig)
	removeColorAttr(bins)
	test.deepEqual(
		bins,
		[
			{ stop: 3, stopinclusive: false, startunbounded: true, label: '<' + 3 },
			{ start: 3, stop: 3, startinclusive: true, stopinclusive: true, label: '=' + 3 },
			{ start: 3, startinclusive: false, stopunbounded: true, label: '>' + 3 }
		],
		'should create 3 bins: one less than value, one equal to value, and one greater than value'
	)
	test.end()
})

tape('validate_bins()', function (test) {
	const bc = {
		type: 'custom-bin',
		lst: [
			{ stop: 3, stopinclusive: false, startunbounded: true, label: '<' + 3 },
			{ start: 3, stop: 3, startinclusive: true, stopinclusive: true, label: '=' + 3 },
			{ start: 3, startinclusive: false, stopunbounded: true, label: '>' + 3 }
		]
	}
	test.throws(
		function () {
			bc.lst[1].stopunbounded = true
			b.default(bc)
		},
		/bin.startunbounded and bin.stopunbounded must not be set for non-first\/non-last bins/,
		'throws when middle bin has stopunbounded=true'
	)
	test.throws(
		function () {
			delete bc.lst[1].stopunbounded
			bc.lst[1].startunbounded = true
			b.default(bc)
		},
		/bin.startunbounded and bin.stopunbounded must not be set for non-first\/non-last bins/,
		'throws when middle bin has startunbounded=true'
	)
	test.end()
})

/*************************
 reusable helper functions
**************************/

const get_summary = (() => {
	const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
	const n = values.length / 100
	return percentiles => {
		const summary = {
			min: Math.min(...values),
			max: Math.max(...values)
		}

		const pct = []
		for (const num of percentiles) {
			summary['p' + num] = values[Math.floor(num * n)]
		}

		return summary
	}
})()

function tryBin(test, arg, testMssg, expectedErrMssg) {
	try {
		b.compute_bins(arg, get_summary)
		test.fail(testMssg)
	} catch (e) {
		test.equal(e, expectedErrMssg, testMssg)
	}
}

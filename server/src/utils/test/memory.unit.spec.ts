import tape from 'tape'
import {
	getCgroupInactiveFileBytes,
	estimatePeakMB,
	runFitsInMemory,
	largestSizeThatFits,
	lowMemoryError,
	reserveMemoryMB,
	memoryReservedMB,
	admitRun,
	memoryBudgetMB,
	memoryAdmissionMessage,
	RUN_MEMORY_FRACTION,
	RUN_MEMORY_MAX_MB,
	DEFAULT_MAX_MB
} from '../memory.ts'

tape('getCgroupInactiveFileBytes', test => {
	const files: Record<string, string> = {
		'/proc/self/cgroup': '0::/\n',
		'/sys/fs/cgroup/memory.stat': 'anon 1000\nfile 1300\nactive_file 100\ninactive_file 1200\n',
		'/sys/fs/cgroup/system.slice/pp.service/memory.stat': 'inactive_file 500\n'
	}
	const readFile = (f: string) => {
		if (!(f in files)) throw new Error('ENOENT ' + f)
		return files[f]
	}
	test.equal(getCgroupInactiveFileBytes(readFile), 1200, 'container cgroup namespace root => its inactive_file')
	files['/proc/self/cgroup'] = '0::/system.slice/pp.service\n'
	test.equal(getCgroupInactiveFileBytes(readFile), 500, 'nested cgroup => that cgroup, not the root')
	files['/proc/self/cgroup'] = '12:memory:/docker/abc\n1:name=systemd:/docker/abc\n'
	test.equal(getCgroupInactiveFileBytes(readFile), 0, 'cgroup v1 => 0')
	test.equal(
		getCgroupInactiveFileBytes(() => {
			throw new Error('ERR_ACCESS_DENIED')
		}),
		0,
		'unreadable => 0'
	)
	test.end()
})

tape('estimatePeakMB, runFitsInMemory', test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 2, pairs: 0.5 } }
	test.equal(estimatePeakMB(cost, { rows: 10, pairs: 40 }), 140, 'base + 2 × 10 rows + 0.5 × 40 pairs')
	test.throws(() => estimatePeakMB(cost, { rows: 10 }), /needs the run's pairs/, 'a size left out => throws')
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 40 }, 140), true, '140 MB in all of 140 MB free => fits')
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 42 }, 140), false, '141 MB in 140 MB => does not fit')
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 42 }, 350, 0.4), false, '141 MB in 40% of 350 MB => does not fit')
	test.end()
})

tape("a cost's own maxMB", test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 1 }, maxMB: 300 }
	test.equal(runFitsInMemory(cost, { rows: 200 }, 100000), true, '300 MB run, maxMB 300 => fits')
	test.equal(runFitsInMemory(cost, { rows: 201 }, 100000), false, '301 MB run in a large budget, maxMB 300 => refused')
	test.equal(
		runFitsInMemory(cost, { rows: 200 }, 200),
		false,
		'the budget below maxMB (200 MB free) => the budget decides'
	)
	test.equal(largestSizeThatFits(100000, cost, 'rows'), 200, 'a large budget => trimmed to maxMB, 200 rows')
	test.end()
})

tape('memoryAdmissionMessage', test => {
	// label, admitted, needed, available, fraction, report only, run maxMB, maxMB, reserved
	test.equal(
		memoryAdmissionMessage('DMR scan', true, 1133, 14285, 0.4, true, undefined, 9318, 0),
		'[memory] DMR scan fits (report only): needs 1,133 MB, under the 9,318 MB maxMB, of a 5,714 MB budget ' +
			'(40% of 14,285 MB free), 0 MB reserved by runs in progress',
		'under maxMB, the budget is the share'
	)
	test.equal(
		memoryAdmissionMessage('DM', false, 10000, 100000, 0.4, false, undefined, 9318, 500),
		'[memory] DM refused: needs 10,000 MB, over the 9,318 MB maxMB, of a 9,318 MB budget ' +
			'(maxMB, below 40% of 100,000 MB free), 500 MB reserved by runs in progress',
		'over maxMB, the budget is maxMB'
	)
	test.equal(
		memoryAdmissionMessage('DE limma', false, 4579, 100000, 0.4, false, 2200, 9318, 0),
		'[memory] DE limma refused: needs 4,579 MB, over the 2,200 MB per-run maxMB, of a 9,318 MB budget ' +
			'(maxMB, below 40% of 100,000 MB free), 0 MB reserved by runs in progress',
		"a run's own maxMB below serverconfig's => the per-run maxMB"
	)
	// fraction 1: serverconfig sets maxMB alone
	test.equal(
		memoryAdmissionMessage('DMR scan', true, 1133, 14285, 1, false, undefined, 9318, 0),
		'[memory] DMR scan admitted: needs 1,133 MB, under the 9,318 MB maxMB, of a 9,318 MB budget ' +
			'(maxMB, below 14,285 MB free), 0 MB reserved by runs in progress',
		'maxMB alone, more memory free => the budget is maxMB, and the free memory is the total'
	)
	test.equal(
		memoryAdmissionMessage('DMR scan', true, 1133, 5000, 1, false, undefined, 9318, 0),
		'[memory] DMR scan admitted: needs 1,133 MB, under the 9,318 MB maxMB, of a 5,000 MB budget ' +
			'(5,000 MB free), 0 MB reserved by runs in progress',
		'maxMB alone, less memory free => the budget is all the free memory'
	)
	test.end()
})

tape('memoryBudgetMB', test => {
	test.equal(RUN_MEMORY_MAX_MB, DEFAULT_MAX_MB, 'DEFAULT_MAX_MB when serverconfig sets no maxMB')
	test.equal(DEFAULT_MAX_MB, 3072, 'the default maxMB is 3 GB')
	test.equal(RUN_MEMORY_FRACTION, 1, 'no fraction by default: all the free memory, up to maxMB')
	test.equal(memoryBudgetMB(16000), DEFAULT_MAX_MB, '16,000 MB free => the default maxMB')
	test.equal(memoryBudgetMB(2000), 2000, '2,000 MB free => all of it, below the default maxMB')
	test.equal(memoryBudgetMB(16000, 0.4, 4096), 4096, 'maxMB below the share => maxMB')
	test.equal(memoryBudgetMB(8000, 0.4, 4096), 3200, 'the share below maxMB => the share')
	test.end()
})

tape('largestSizeThatFits', test => {
	const cost = { baseMB: 100, perUnitMB: { units: 1 } }
	test.equal(largestSizeThatFits(1000, cost, 'units', 0.5), 400, 'budget 500 MB - base 100 MB => 400 units')
	test.equal(largestSizeThatFits(200, cost, 'units', 0.5), 0, 'budget equal to the base => 0 units')
	test.equal(largestSizeThatFits(100, cost, 'units', 0.5), 0, 'budget below the base => 0, not negative')
	test.equal(
		largestSizeThatFits(1000, { baseMB: 100, perUnitMB: { units: 0.3 } }, 'units', 0.5),
		1333,
		'a fraction of a unit is dropped'
	)
	test.equal(
		largestSizeThatFits(1000, cost, 'units'),
		900,
		'the defaults => all 1,000 MB free - base 100 MB => 900 units'
	)
	test.throws(
		() => largestSizeThatFits(1000, { baseMB: 100, perUnitMB: { genes: 2, pairs: 1 } }, 'genes'),
		/needs the run's pairs/,
		'a cost with a second size => throws rather than leaving it out'
	)
	test.end()
})

tape('reserveMemoryMB', test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 1 } }
	test.equal(memoryReservedMB(), 0, 'nothing reserved at the start')
	// 400 MB free => a 400 MB budget; a 300 MB run fits alone
	test.equal(runFitsInMemory(cost, { rows: 200 }, 400), true, 'one 300 MB run in a 400 MB budget => fits')
	const release = reserveMemoryMB(300)
	test.equal(memoryReservedMB(), 300, 'its 300 MB is reserved')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 400), false, 'a second 300 MB run while the first runs => refused')
	test.equal(runFitsInMemory(cost, { rows: 0 }, 400), true, 'a 100 MB run still fits in the 100 MB left')
	test.equal(largestSizeThatFits(400, cost, 'rows'), 0, 'a trimmed run gets what is left after the base => 0 rows')
	release()
	release()
	test.equal(memoryReservedMB(), 0, 'released, and a second release does not release twice')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 400), true, 'after the release => fits again')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 400, RUN_MEMORY_FRACTION, 300), false, 'reservedMB can be passed')
	test.end()
})

tape('admitRun', test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 1 } }
	let built = 0
	const refusal = () => (built++, 'Select a smaller cohort.')
	// 400 MB free => a 400 MB budget
	const release = admitRun('test', cost, { rows: 200 }, 400, refusal)
	test.equal(memoryReservedMB(), 300, 'admitted => its 300 MB estimate is reserved')
	test.equal(built, 0, 'the refusal message is not built for an admitted run')
	try {
		admitRun('test', cost, { rows: 200 }, 400, refusal)
		test.fail('a second 300 MB run beside the first => should throw')
	} catch (e: any) {
		test.equal(e.code, 'LOW_MEMORY', 'a second 300 MB run beside the first => refused with LOW_MEMORY')
		test.equal(e.message, 'Select a smaller cohort.', 'with the refusal message')
	}
	test.equal(memoryReservedMB(), 300, 'a refused run reserves nothing')
	const reported = admitRun('test', cost, { rows: 200 }, 400, refusal, true)
	test.equal(memoryReservedMB(), 600, 'report mode => a run that does not fit is not refused, and is reserved')
	reported()
	release()
	test.equal(memoryReservedMB(), 0, 'released')
	test.end()
})

tape('lowMemoryError', test => {
	const e: any = lowMemoryError('Select a smaller cohort.')
	test.ok(e instanceof Error, 'is an Error, so the route handler logs its stack')
	test.equal(e.message, 'Select a smaller cohort.', 'keeps the message for the user')
	test.equal(e.status, 503, 'status 503, which the route handler sends')
	test.equal(e.code, 'LOW_MEMORY', 'code LOW_MEMORY')
	test.end()
})

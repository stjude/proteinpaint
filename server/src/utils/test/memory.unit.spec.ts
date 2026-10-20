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
	RUN_MEMORY_FRACTION
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
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 40 }, 350), true, '140 MB in 40% of 350 MB (140) => fits')
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 42 }, 350), false, '141 MB in 140 MB => does not fit')
	test.equal(runFitsInMemory(cost, { rows: 10, pairs: 42 }, 350, 1), true, 'the whole 350 MB => fits')
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
	test.equal(RUN_MEMORY_FRACTION, 0.4, 'default share of the available memory')
	test.equal(
		largestSizeThatFits(1000, cost, 'units'),
		300,
		'the default share => budget 400 MB - base 100 MB => 300 units'
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
	// 1000 MB free => a 400 MB budget; a 300 MB run fits alone
	test.equal(runFitsInMemory(cost, { rows: 200 }, 1000), true, 'one 300 MB run in a 400 MB budget => fits')
	const release = reserveMemoryMB(300)
	test.equal(memoryReservedMB(), 300, 'its 300 MB is reserved')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 1000), false, 'a second 300 MB run while the first runs => refused')
	test.equal(runFitsInMemory(cost, { rows: 0 }, 1000), true, 'a 100 MB run still fits in the 100 MB left')
	test.equal(largestSizeThatFits(1000, cost, 'rows'), 0, 'a trimmed run gets what is left after the base => 0 rows')
	release()
	release()
	test.equal(memoryReservedMB(), 0, 'released, and a second release does not release twice')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 1000), true, 'after the release => fits again')
	test.equal(runFitsInMemory(cost, { rows: 200 }, 1000, RUN_MEMORY_FRACTION, 300), false, 'reservedMB can be passed')
	test.end()
})

tape('admitRun', test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 1 } }
	let built = 0
	const refusal = () => (built++, 'Select a smaller cohort.')
	// 1000 MB free => a 400 MB budget
	const release = admitRun('test', cost, { rows: 200 }, 1000, refusal)
	test.equal(memoryReservedMB(), 300, 'admitted => its 300 MB estimate is reserved')
	test.equal(built, 0, 'the refusal message is not built for an admitted run')
	try {
		admitRun('test', cost, { rows: 200 }, 1000, refusal)
		test.fail('a second 300 MB run beside the first => should throw')
	} catch (e: any) {
		test.equal(e.code, 'LOW_MEMORY', 'a second 300 MB run beside the first => refused with LOW_MEMORY')
		test.equal(e.message, 'Select a smaller cohort.', 'with the refusal message')
	}
	test.equal(memoryReservedMB(), 300, 'a refused run reserves nothing')
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

import tape from 'tape'
import {
	getCgroupInactiveFileBytes,
	memoryNeededMB,
	fitsInMemory,
	maxUnitsThatFit,
	lowMemoryError,
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

tape('memoryNeededMB, fitsInMemory', test => {
	const cost = { baseMB: 100, perUnitMB: { rows: 2, pairs: 0.5 } }
	test.equal(memoryNeededMB(cost, { rows: 10, pairs: 40 }), 140, 'base + 2 × 10 rows + 0.5 × 40 pairs')
	test.throws(() => memoryNeededMB(cost, { rows: 10 }), /needs the run's pairs/, 'a size left out => throws')
	test.equal(fitsInMemory(cost, { rows: 10, pairs: 40 }, 350), true, '140 MB in 40% of 350 MB (140) => fits')
	test.equal(fitsInMemory(cost, { rows: 10, pairs: 42 }, 350), false, '141 MB in 140 MB => does not fit')
	test.equal(fitsInMemory(cost, { rows: 10, pairs: 42 }, 350, 1), true, 'the whole 350 MB => fits')
	test.end()
})

tape('maxUnitsThatFit', test => {
	const cost = { baseMB: 100, perUnitMB: { units: 1 } }
	test.equal(maxUnitsThatFit(1000, cost, 'units', 0.5), 400, 'budget 500 MB - base 100 MB => 400 units')
	test.equal(maxUnitsThatFit(200, cost, 'units', 0.5), 0, 'budget equal to the base => 0 units')
	test.equal(maxUnitsThatFit(100, cost, 'units', 0.5), 0, 'budget below the base => 0, not negative')
	test.equal(
		maxUnitsThatFit(1000, { baseMB: 100, perUnitMB: { units: 0.3 } }, 'units', 0.5),
		1333,
		'a fraction of a unit is dropped'
	)
	test.equal(RUN_MEMORY_FRACTION, 0.4, 'default share of the available memory')
	test.equal(maxUnitsThatFit(1000, cost, 'units'), 300, 'the default share => budget 400 MB - base 100 MB => 300 units')
	test.throws(
		() => maxUnitsThatFit(1000, { baseMB: 100, perUnitMB: { genes: 2, pairs: 1 } }, 'genes'),
		/needs the run's pairs/,
		'a cost with a second size => throws rather than leaving it out'
	)
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

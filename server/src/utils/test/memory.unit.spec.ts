import tape from 'tape'
import { getCgroupInactiveFileBytes } from '../memory.ts'

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

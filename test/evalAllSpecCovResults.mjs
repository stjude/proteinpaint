import { evalSpecCovResults } from '@sjcrh/augen'

const workspaces = ['client', 'server', 'shared/utils', 'shared/types', 'augen']
const failures = []
for (const workspace of workspaces) {
	const result = await evalSpecCovResults({ workspace })
	if (!result.ok) {
		console.log(`\n!!! ${workspace} failed spec coverage !!!`)
		console.log(result.failedCoverage, '\n')
		failures.push(result)
	}
}

if (failures.length) process.exit(1)

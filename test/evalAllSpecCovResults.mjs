import { evalSpecCovResults } from '@sjcrh/augen'

const workspaces = ['client', 'server', 'shared/utils', 'augen']

if (process.argv[2]) evalAllSpecCovResults(Number(process.argv[2]))

export async function evalAllSpecCovResults(errorCode = 0) {
	const failures = []
	const relevantWs = []
	for (const workspace of workspaces) {
		const result = await evalSpecCovResults({ workspace })
		if (result.workspace) relevantWs.push(result.workspace)
		if (!result.ok) {
			console.log(`\n!!! ${workspace} failed spec coverage !!!`)
			console.log(result.failedCoverage, '\n')
			failures.push(result)
		}
	}

	if (errorCode) {
		if (failures.length) process.exit(failures.length ? errorCode : 0)
	}
	return { failures, workspaces: relevantWs }
}

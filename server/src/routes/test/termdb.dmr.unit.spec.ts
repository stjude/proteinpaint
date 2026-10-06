import tape from 'tape'
import serverconfig from '#src/serverconfig.js'
import { genomes } from '#src/initGenomesDs.js'
import { api } from '../termdb.dmr.ts'

/*
Tests:
	termdb/dmr runs the R backend only in debugmode
*/

// the route is only set up when a ds has ds.queries.dnaMethylation, see methylation.mount.unit.spec.ts
function getHandler() {
	Object.assign(genomes, { hg38: { datasets: { A: { queries: { dnaMethylation: {} } } } } })
	try {
		const payload: any = api.methods.get
		return payload.init({ genomes: {} })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
}

// the handler is given no genomes, so a request that gets past the backend check answers 'unknown genome'
async function request(backend, debugmode) {
	const original = serverconfig.debugmode
	serverconfig.debugmode = debugmode
	try {
		return await new Promise<any>(resolve => getHandler()({ query: { backend } }, { send: resolve }))
	} finally {
		serverconfig.debugmode = original
	}
}

tape('\n', test => {
	test.comment('-***- routes/termdb.dmr specs -***-')
	test.end()
})

tape('termdb/dmr runs the R backend only in debugmode', async test => {
	test.equal(
		(await request('r', false)).error,
		'The R backend is not available.',
		'should not accept the R backend when not in debugmode'
	)
	test.equal((await request('r', true)).error, 'unknown genome', 'should accept the R backend in debugmode')
	test.equal((await request('rust', false)).error, 'unknown genome', 'should accept the Rust backend')
	test.equal((await request(undefined, false)).error, 'unknown genome', 'should accept a request with no backend')
	test.end()
})

import tape from 'tape'
import { listMafFiles } from '../gdc.maf.ts'

/*
listMafFiles() lists the GDC MAF files for a cohort. The GDC /files query is injected (MafFilesQuery) so
these specs drive it deterministically in-process, with no GDC/network — same pattern as gdc.mafBuild's
injected fetchGzStream/queryMeta. They cover the two behaviors that matter here: the request abort signal
is actually forwarded to (and cancels) the GDC query, and the hits are flattened + sorted for the client.

test sections:
- forwards q.__abortSignal to the GDC query and a client disconnect cancels a stalled request
- flattens hits into file rows and sorts them by descending file size
*/

// a minimal ds stub: only getHostHeaders is exercised by listMafFiles
const ds = { getHostHeaders: () => ({ host: { rest: 'https://gdc.example/' }, headers: {} }) }

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.maf listMafFiles -***-')
	test.end()
})

tape('forwards the abort signal so a client disconnect cancels a stalled GDC files query', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// The middleware sets q.__abortSignal for /gdc/maf and aborts it on client disconnect. The injected
	// query stands in for a stalled GDC /files request: it never resolves on its own, only rejecting when
	// the forwarded signal aborts. Asserts (a) the signal reaches the query, and (b) aborting it rejects
	// the call instead of hanging listMafFiles indefinitely.
	const controller = new AbortController()
	let forwardedSignal: AbortSignal | undefined
	const stalledQuery = (_host: any, _headers: any, _body: any, signal: AbortSignal | undefined) => {
		forwardedSignal = signal
		return new Promise<{ hits: any[]; total: number }>((_resolve, reject) => {
			signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')), { once: true })
		})
	}

	const q: any = { experimentalStrategy: 'WXS', __abortSignal: controller.signal }
	const pending = listMafFiles(q, ds, stalledQuery)
	controller.abort() // client disconnected mid-request

	let threw = false
	try {
		await pending
	} catch (e: any) {
		threw = true
		test.match(String(e?.message || e), /abort/i, 'a stalled files query rejects once the signal aborts')
	}
	test.ok(threw, 'aborting cancels the pending GDC query rather than hanging')
	test.equal(forwardedSignal, controller.signal, 'q.__abortSignal is forwarded to the GDC files query')
	test.end()
})

tape('flattens hits into file rows and sorts by descending file size', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// injected query returns unsorted hits in the GDC shape; listMafFiles should flatten cases[0] into a
	// row and sort largest-file-first (the client's default table order)
	const hits = [
		{
			id: 'small',
			file_size: 100,
			cases: [{ submitter_id: 'C1', case_id: 'u1', project: { project_id: 'P1' }, samples: [] }]
		},
		{
			id: 'big',
			file_size: 900,
			cases: [{ submitter_id: 'C2', case_id: 'u2', project: { project_id: 'P2' }, samples: [] }]
		}
	]
	const query = async () => ({ hits, total: 2 })

	const q: any = { experimentalStrategy: 'WXS' } // no __abortSignal → forwarded as undefined, fine
	const res = await listMafFiles(q, ds, query)

	test.equal(res.filesTotal, 2, 'filesTotal comes from the query pagination total')
	test.deepEqual(
		res.files.map(f => f.id),
		['big', 'small'],
		'files are sorted by descending file_size'
	)
	test.equal(res.files[0].case_submitter_id, 'C2', 'cases[0].submitter_id is flattened into the row')
	test.end()
})

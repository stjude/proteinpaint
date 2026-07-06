import tape from 'tape'
import { listMafFiles, init } from '../gdc.maf.ts'

/*
listMafFiles() lists the GDC MAF files for a cohort. The GDC /files query is injected (MafFilesQuery) so
these specs drive it deterministically in-process, with no GDC/network — same pattern as gdc.mafBuild's
injected fetchGzStream/queryMeta. They cover the behaviors that matter here: the request abort signal is
forwarded to (and cancels) the GDC query, the requested case filter is applied, the hits are flattened +
sorted for the client, and init()'s route-handler guards surface setup failures as JSON errors.

Not unit-covered by design: queryMafFiles() (the real ky.post to GDC) and init()'s success res.send — both
cross the live GDC boundary and belong to the integration spec; the injected-query seam exists so these
specs never touch the network.

test sections:
- forwards q.__abortSignal to the GDC query and a client disconnect cancels a stalled request
- applies q.filter0 as a GDC case_filter (and omits it when absent)
- flattens hits into file rows and sorts them by descending file size
- init() handler surfaces setup failures as JSON errors (no network)
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

tape('applies q.filter0 as a GDC case_filter, and omits it when absent', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// the invisible cohort filter (q.filter0) must be forwarded to GDC as body.case_filters so the file list
	// is scoped to the cohort; when absent, no case_filters should be sent at all
	const filter0 = { op: 'in', content: { field: 'cases.case_id', value: ['case-1'] } }
	let withBody: any
	await listMafFiles({ experimentalStrategy: 'WXS', filter0 } as any, ds, async (_h, _hd, body) => {
		withBody = body
		return { hits: [], total: 0 }
	})
	test.deepEqual(withBody.case_filters?.content, [filter0], 'q.filter0 is pushed into body.case_filters')

	let withoutBody: any
	await listMafFiles({ experimentalStrategy: 'WXS' } as any, ds, async (_h, _hd, body) => {
		withoutBody = body
		return { hits: [], total: 0 }
	})
	test.notOk(withoutBody.case_filters, 'no case_filters sent when q.filter0 is absent')
	test.end()
})

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.maf init handler -***-')
	test.end()
})

tape('init() handler surfaces setup failures as JSON errors (no network)', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// exercises the route-handler guards + catch without touching GDC: a missing genome/dataset, or any
	// downstream throw before the network call, must come back as a { status:'error' } JSON response.
	const run = async (genomes: any) => {
		const sent: any[] = []
		const res: any = { send: (x: any) => sent.push(x) }
		await init({ genomes })({ query: {} } as any, res)
		return sent[0]
	}

	test.match(String((await run({})).error), /hg38 missing/, 'missing hg38 genome → JSON error')
	test.match(
		String((await run({ hg38: { datasets: {} } })).error),
		/hg38 GDC missing/,
		'missing GDC dataset → JSON error'
	)

	// ds present but getHostHeaders throws → listMafFiles rejects → caught → JSON error, still no network
	const throwingDs = {
		hg38: {
			datasets: {
				GDC: {
					getHostHeaders: () => {
						throw 'boom'
					}
				}
			}
		}
	}
	test.match(String((await run(throwingDs)).error), /boom/, 'a downstream throw is surfaced as a JSON error')
	test.end()
})

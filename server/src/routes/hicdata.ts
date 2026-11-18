import type { RouteApi, RoutePayload, HicdataRequest, HicdataResponse, HicdataPairResult, XYZCoord } from '#types'
import { fileurl } from '#src/utils.js'
import readline from 'readline'
import { runTool } from '#src/tools/index.ts'
import { mapConcurrent } from '#src/utils/concurrencyLimiter.ts'
import { getStrawArgs, validHicPos, STRAW_CONCURRENCY } from '#src/utils/hicStraw.ts'
import serverconfig from '#src/serverconfig.js'

export const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_hictk
	get init() {
		return serverconfig.features.disableFeature_hictk ? null : init
	},
	request: { typeId: 'HicdataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HicdataResponse' }
}

export const api: RouteApi = {
	endpoint: 'hicdata',
	methods: {
		get: payload,
		post: payload
	}
}

export const batchLimits = {
	/** at most this many position pairs may be requested in one batch */
	pairs: 200,
	/** a batch response has at most this many data points in total, so that building and sending the response
	 * does not block the event loop for long; JSON.stringify() of 300k items takes about 40 ms */
	items: 300_000
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const q: HicdataRequest = req.query
			const payload = q.pairs === undefined ? await handle_hicdata(q) : await handle_batch(q)
			res.send(payload satisfies HicdataResponse)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

type StrawQuery = {
	file: string
	strawArgs: ReturnType<typeof getStrawArgs>
	q: HicdataRequest
}

/** returns the validated file and straw arguments that are shared by all position pairs of a request */
function getStrawQuery(q: HicdataRequest): StrawQuery {
	const [e, file] = fileurl({ query: q })
	if (e) throw { error: 'illegal file name' }
	try {
		return { file, strawArgs: getStrawArgs(q), q }
	} catch (e) {
		// the client reads the error message from data.error.error
		throw { error: e }
	}
}

/** spawns straw for one position pair; onItem() returns false to stop reading and kill the straw process */
function runStraw(
	sq: StrawQuery,
	pos1: string,
	pos2: string,
	onItem: (item: XYZCoord) => boolean
): Promise<{ stopped: boolean }> {
	const { file, strawArgs, q } = sq
	return new Promise((resolve, reject) => {
		/*Value passed from client is not the proper straw parameter.
		Must convert to straw parameter and apply the corresponding maths to the result.
		Use 'observed' as default if not provided.
		*/
		let ps: ReturnType<typeof runTool>
		try {
			ps = runTool('hicstraw.query', {
				matrixType: strawArgs.strawMatrixType,
				normalization: strawArgs.nmeth,
				file,
				pos1: validHicPos(pos1),
				pos2: validHicPos(pos2),
				unit: q.isfrag ? 'FRAG' : 'BP',
				resolution: Number(strawArgs.resolution)
			})
		} catch (e) {
			return reject({ error: e })
		}

		const rl = readline.createInterface({ input: ps.stdout })

		const erroutput = [] as string[]
		let linenot3fields = 0
		let fieldnotnumerical = 0
		let stopped = false

		rl.on('line', line => {
			if (stopped) return
			// straw output: pos1 \t pos2 \t value
			const l = line.split('\t')
			if (l.length != 3) {
				linenot3fields++
				return
			}
			const n1 = Number.parseInt(l[0])
			const n2 = Number.parseInt(l[1])
			const v = q.matrixType == 'log(oe)' ? Math.log(Number.parseFloat(l[2])) : Number.parseFloat(l[2])
			if (Number.isNaN(n1) || Number.isNaN(n2) || Number.isNaN(v)) {
				fieldnotnumerical++
				return
			}
			if (q.mincutoff != undefined && v <= q.mincutoff) {
				return
			}
			if (!onItem([n1, n2, v] satisfies XYZCoord)) {
				stopped = true
				rl.close()
				ps.kill()
			}
		})

		ps.stderr.on('data', i => erroutput.push(i))
		// such as when the straw binary cannot be spawned; an unhandled 'error' event would throw
		ps.on('error', e => reject({ error: 'cannot run straw: ' + e.message }))
		ps.on('close', () => {
			if (stopped) return resolve({ stopped })

			const err = erroutput.join('')
			if (err) reject({ error: err })

			if (linenot3fields) reject({ error: linenot3fields + ' lines have other than 3 fields' })

			if (fieldnotnumerical)
				reject({ error: fieldnotnumerical + ' lines have non-numerical values in any of the 3 fields' })

			resolve({ stopped })
		})
	})
}

async function handle_hicdata(q: HicdataRequest): Promise<HicdataResponse> {
	const sq = getStrawQuery(q)
	const items: XYZCoord[] = []
	await runStraw(sq, q.pos1 as string, q.pos2 as string, item => {
		items.push(item)
		return true
	})
	return { items }
}

/** validates the pairs[] of a batch request, which are each checked again by runTool() before straw is spawned */
function validPairs(pairs: any): [string, string][] {
	if (!Array.isArray(pairs) || !pairs.length) throw 'pairs must be a non-empty array'
	if (pairs.length > batchLimits.pairs) throw `pairs must not have more than ${batchLimits.pairs} items`
	for (const p of pairs) {
		if (!Array.isArray(p) || p.length != 2) throw 'each item of pairs must be [pos1, pos2]'
		validHicPos(p[0])
		validHicPos(p[1])
	}
	return pairs
}

/*
Queries each position pair of a batch, with at most STRAW_CONCURRENCY straw processes at once.

The response has at most batchLimits.items data points in total. When a pair would exceed that limit, its straw
process is stopped and the pair is marked as skipped, and the pairs that are not started yet are also skipped;
the client may request the skipped pairs again. A pair that alone has more data points than the limit has an error.
A pair is skipped only while other pairs have data points, so each batch returns the data or the error of at least
one pair, and requesting the skipped pairs again eventually returns all pairs.
*/
async function handle_batch(q: HicdataRequest): Promise<HicdataResponse> {
	let sq: StrawQuery
	try {
		sq = getStrawQuery(q)
	} catch (e: any) {
		// a batch response has the error message in data.error
		throw e.error
	}
	const pairs = validPairs(q.pairs)
	const results: HicdataPairResult[] = pairs.map(() => ({ items: [] }))
	// the number of data points in results[], including those of the pairs that are still running
	let total = 0
	let limitReached = false

	const settled = await mapConcurrent(
		pairs,
		STRAW_CONCURRENCY,
		async ([pos1, pos2], i) => {
			const result = results[i]
			try {
				await runStraw(sq, pos1, pos2, item => {
					if (total < batchLimits.items) {
						result.items.push(item)
						total++
						return true
					}
					// stop this pair; its data points are released now, instead of when its straw process closes,
					// so that the pairs that are still running may use them and are not also stopped
					limitReached = true
					if (result.items.length >= batchLimits.items) {
						// this pair alone has more data points than the limit
						result.error = `more than ${batchLimits.items} data points`
					} else {
						result.skipped = true
					}
					total -= result.items.length
					result.items = []
					return false
				})
			} catch (e) {
				// the data points of a pair with an error are not returned
				total -= result.items.length
				result.items = []
				throw e
			}
		},
		{ stopWhen: () => limitReached }
	)

	for (const [i, s] of settled.entries()) {
		if (!s) {
			// not started after the limit was reached
			results[i].skipped = true
		} else if (s.status == 'rejected') {
			const e = s.reason
			results[i] = { items: [], error: String(e?.error?.message || e?.error || e?.message || e) }
		}
	}
	return { pairs: results }
}

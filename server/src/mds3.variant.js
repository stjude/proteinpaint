/*

q{}
	.chr/start/stop
	.filter{}       -- bona fide filter obj
	.details{}

ds.queries.snvindel.byrange.get()
*/

export async function get_mds3variantData(q, res, ds, genome) {
	if (!q.chr) throw 'q.chr missing'
	q.start = Number(q.start)
	q.stop = Number(q.stop) // somehow q.stop can be string
	if (!Number.isInteger(q.start) || !Number.isInteger(q.stop)) throw 'q.start/stop is not integer'
	if (typeof q.details != 'object') throw 'q.details{} not object'

	const param = {
		rglst: [{ chr: q.chr, start: q.start, stop: q.stop }],
		filterObj: q.filter
	}
	const data = await ds.queries.snvindel.byrange.get(param)

	const results = {}

	if (q.details.computeType == 'AF') {
		compute_AF(data, results)
	} else {
		throw 'unknown q.details.computeType'
	}

	res.send(results)
}

function compute_AF(data, results) {}

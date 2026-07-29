/*
Reconstruct the term wrappers that a chart request posts as term0, term1 and term2.

The client posts each wrapper whole. A request that predates that, or one written by hand,
splits a wrapper into term<i>_id, term<i>_q, term<i>_$id and term<i>_type, with a
non-dictionary term posted as a bare term in term<i>; that form is still served, and is the
only reason this is more than a lookup. A wrapper type other than TermCollectionTWFraction
does not survive that split, so it must be inferred back.
*/

export function getTwByIndex(q: any) {
	const twByIndex = new Map<number, any>()
	for (const i of [0, 1, 2]) {
		const tw = getTw(q, 'term' + i)
		if (tw) twByIndex.set(i, tw)
	}
	return twByIndex
}

function getTw(q: any, termnum: string) {
	// a whole wrapper has tw.term, while the split form posts a bare term under this key
	const posted = mayParseJson(q[termnum])
	const tw = posted?.term ? posted : getSplitTw(q, posted, termnum)
	if (!tw) return
	// a route validates the term type before getData() is called, so a term supplied as an
	// id alone must be filled in here rather than by getData()
	if (!tw.term?.type && tw.term?.id) tw.term = q.ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
	// an unknown term id has always been served as if the term were absent
	if (!tw.term) return
	const twType = tw.type || inferTwType(tw)
	if (twType) tw.type = twType
	/* $id is the key that getData() indexes each sample's data by, and that the client reads
	the returned refs by. It is not derived from term.id or term.name here: every tw that the
	client assembles carries one, a custom termCollection has no term.id to fall back on, and
	deriving a second key would silently produce data that the caller cannot find. */
	if (!tw.$id) throw `${termnum} is missing $id`
	return tw
}

/** term<i>_id, term<i>_q, term<i>_$id and term<i>_type, with a bare term in term<i> */
function getSplitTw(q: any, postedTerm: any, termnum: string) {
	const id = q[termnum + '_id']
	// term<i>_id takes precedence over a bare term, as when a route resolved the id first
	const term = typeof id == 'string' ? { id: decodeURIComponent(id) } : postedTerm
	if (!term) return
	return {
		term,
		q: mayParseJson(q[termnum + '_q']),
		$id: q[termnum + '_$id'],
		type: q[termnum + '_type']
	}
}

/** a request parameter is decoded by the urljson middleware, unless it was manually encoded */
function mayParseJson(v: any) {
	return typeof v == 'string' ? JSON.parse(decodeURIComponent(v)) : v
}

/** the tw type may be missing when a request is not assembled by the client tw router */
function inferTwType(tw: any) {
	if (tw.term?.type == 'termCollection' && Array.isArray(tw.q?.denominators)) return 'TermCollectionTWFraction'
	return undefined
}

/** the bins that getData() computed for a tw, under the same key as its sample data.
 *  A numeric, gene expression or fraction term has no term.values to order its keys by:
 *  its keys are the labels of these bins. */
export function getTwBins(tw: any, data: any) {
	if (!tw) return []
	return data.refs?.byTermId?.[tw.$id]?.bins || []
}

import { sql } from './sql.ts'
import type { SampleAccessResult } from '#types'

/*
Applies the ds-supplied ds.cohort.termdb.checkAccessToSampleData{} to the samples that a response is
about to include, see the CheckAccessToSampleData type in shared/types/src/dataset.ts.

assess() is called once for every term, with what is known about the samples that have data for that
term, and the first term it does not allow throws. When every term is allowed, the samples of all
terms combined are allowed too, since combining the terms can only add to the count or the names.

need='count': assess() gets {count}, the number of samples with data for a term, and no db query is made
need='names': assess() gets {names}, the distinct names of the samples with data for a term, which are
	- the values of termId for these samples, when termId is given
	- otherwise the sample names in the sampleidmap table
*/

export type SampleAccessTerm = {
	/** the ids of the samples that have data for a term, as included in the response */
	sampleIds: Iterable<string | number>
}

const needs = new Set(['count', 'names'])

/* called once at server launch, so that a dataset with an unusable setup fails to launch, instead of
having its samples unchecked */
export function validateCheckAccessToSampleData(ds) {
	const check = ds.cohort?.termdb?.checkAccessToSampleData
	if (check === undefined) return
	if (typeof check == 'function')
		throw 'termdb.checkAccessToSampleData must be an object {need, assess(), termId?}, not a function'
	if (!check || typeof check != 'object') throw 'termdb.checkAccessToSampleData is not an object'
	if (typeof check.assess != 'function') throw 'termdb.checkAccessToSampleData.assess() is not a function'
	if (!needs.has(check.need)) throw `termdb.checkAccessToSampleData.need must be one of: ${[...needs].join(', ')}`
	if (check.need == 'count') {
		if (check.termId !== undefined) throw `termdb.checkAccessToSampleData.termId is only used when need='names'`
		return
	}
	const db = ds.cohort.db
	if (!db?.connection) throw `termdb.checkAccessToSampleData.need='names' requires ds.cohort.db`
	if (check.termId === undefined) {
		if (!db.tables?.has('sampleidmap'))
			throw `termdb.checkAccessToSampleData.need='names' without termId requires the sampleidmap table`
		return
	}
	if (typeof check.termId != 'string' || !check.termId)
		throw 'termdb.checkAccessToSampleData.termId is not a non-empty string'
	const row = db.connection.prepare(sql`SELECT 1 FROM anno_categorical WHERE term_id=${check.termId} LIMIT 1`).get()
	if (!row) throw `termdb.checkAccessToSampleData.termId='${check.termId}' has no categorical values in the db`
}

/* throws {message, code:'ERR_MIN_SIZE'} for the first term that assess() does not allow */
export function mayCheckSampleAccess(q, ds, terms: SampleAccessTerm[]) {
	const check = ds.cohort?.termdb?.checkAccessToSampleData
	if (!check) return
	const lst = terms.map(t => ({ sampleIds: toIdSet(t.sampleIds) })).filter(t => t.sampleIds.size)
	if (!lst.length) return

	if (check.need == 'count') {
		for (const t of lst) assertAccess(check.assess(q, { count: t.sampleIds.size }))
		return
	}
	if (check.need != 'names') throw 'invalid termdb.checkAccessToSampleData.need'
	const id2names = getId2Names(ds, check.termId)
	for (const t of lst) {
		const names = new Set<string>()
		for (const id of t.sampleIds) {
			for (const n of id2names.get(id) || []) names.add(n)
		}
		assertAccess(check.assess(q, { names: [...names] }))
	}
}

function toIdSet(ids: Iterable<string | number>) {
	return new Set([...ids].map(String))
}

function assertAccess(access: SampleAccessResult) {
	if (access?.canAccess === true) return
	throw {
		message:
			access?.message ||
			(access?.minSize === undefined
				? 'The sample data is not accessible.'
				: `One or more terms has less than ${access.minSize} samples with data.`),
		code: 'ERR_MIN_SIZE'
	}
}

/*
sample id -> names, read once for each db connection and termId, and reused by later requests,
so that a request does not need to bind its sample ids, which may be more than sqlite allows in one statement
*/
const cache = new WeakMap<object, Map<string, Map<string, string[]>>>()

function getId2Names(ds, termId?: string) {
	const cn = ds.cohort.db.connection
	if (!cache.has(cn)) cache.set(cn, new Map())
	const byTermId = cache.get(cn)!
	const key = termId || ''
	if (!byTermId.has(key)) {
		const rows = termId
			? cn.prepare(sql`SELECT sample, value FROM anno_categorical WHERE term_id=${termId}`).all()
			: cn.prepare(sql`SELECT id AS sample, name AS value FROM sampleidmap`).all()
		const id2names = new Map<string, string[]>()
		for (const r of rows) {
			const id = String(r.sample)
			if (!id2names.has(id)) id2names.set(id, [])
			id2names.get(id)!.push(String(r.value))
		}
		byTermId.set(key, id2names)
	}
	return byTermId.get(key)!
}

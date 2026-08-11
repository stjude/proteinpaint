import type { RoutePayload, RouteApi } from '#types'
import type { CategoriesRequest, CategoriesResponse } from '#types'
import type { ReqQueryAddons } from '../../routes/types.ts'
import { getOrderedLabels } from '#src/termdb.barchart.js'
import { getData } from '#src/termdb.matrix.js'
import { getSelfBreakpoint, getPartnerBreakpoints } from '#src/svfusion.breakpoint.ts'
import { dtsv, dtfusionrna } from '#shared/common.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'CategoriesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'CategoriesResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/categories',
	methods: {
		get: payload,
		post: payload
	}
}

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: CategoriesRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_getcategories(q, res, tdb, ds)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getcategories(
	q: CategoriesRequest & ReqQueryAddons,
	res: any,
	tdb: any,
	ds: { assayAvailability: { byDt: { [s: string]: any } | ArrayLike<any> } }
) {
	// only one term per request, so can hardcode a known string tw.$id if missing
	// and $id is not used in the response payload/metadata
	if (!q.tw.$id) q.tw.$id = '_'
	const $id = q.tw.$id
	const arg = {
		filter: q.filter,
		filter0: q.filter0,
		terms: [q.tw],
		currentGeneNames: q.currentGeneNames, // optional, from mds3 mayAddGetCategoryArgs()
		rglst: q.rglst, // optional, from mds3 mayAddGetCategoryArgs()
		__protected__: q.__protected__,
		__abortSignal: q.__abortSignal
	}

	const data = await getData(arg, ds)
	if (data.error) throw data.error
	// only this route serves the term-editing UIs that list amino acid changes,
	// so it is the only caller that asks for the mname tally
	const [lst, orderedLabels] = getCategories(data, q, ds, $id, { withMnames: true })
	res.send({
		lst: lst as any,
		orderedLabels: orderedLabels as any
	} satisfies CategoriesResponse)
}

/* opts.withMnames: tally the amino acid changes of each dt, in addition to the
mutation classes. Off by default because getData() calls this for every
geneVariant term of every matrix/barchart request (see mayGetCategories() in
termdb.matrix.js), where the mname list is unused and can be large: it holds one
entry per distinct dt/origin/class/gene/mname of the cohort */
export function getCategories(data, q, ds, $id, opts: { withMnames?: boolean } = {}) {
	const lst: any[] = []
	if (q.tw.term.type == 'geneVariant' && q.tw.q.type != 'predefined-groupset' && q.tw.q.type != 'custom-groupset') {
		// specialized data processing for geneVariant term when
		// groupsetting is not in use
		const samples = data.samples as { [sampleId: string]: any }
		const dtClassMap = new Map()
		// tally of amino acid changes (m.mname, e.g. "G12D") per dt/origin/class/gene
		// k: `mname:${dt}|${origin}|${class}|${gene}|${mname}`
		// v: { dt, origin, class, gene, mname, samplecount }
		// gene is tracked so that variants of a geneVariant term with multiple
		// genes can be told apart, e.g. KRAS G12D vs NRAS G12D
		const mnameCountMap = new Map()
		/* tally of the breakpoints of the sv/fusion events of each mname entry, so that the
		term-editing UIs can chart them and select a range (see BreakpointEntry)
		k: `${mnameKey}|${pos}|${partnerChr}|${partnerPos}`
		v: { mnameKey, pos, partnerChr, partnerPos, samplecount }
		the tally is per distinct pair of breakpoints, so it is bounded by the number of
		sv/fusion events of the queried gene in the cohort */
		const breakpointCountMap = new Map()
		// samples whose events of an mname entry lack a breakpoint coordinate, k: mnameKey
		const noPositionCountMap = new Map()
		if (ds.assayAvailability?.byDt) {
			for (const [dtType, _dtValue] of Object.entries(ds.assayAvailability.byDt)) {
				const dtValue: any = _dtValue
				if (dtValue.byOrigin) {
					dtClassMap.set(parseInt(dtType), { byOrigin: { germline: {}, somatic: {} } })
				}
			}
		}
		const sampleCountedFor = new Set() // if the sample is counted
		for (const sampleData of Object.values(samples)) {
			const key = $id
			if (!Object.keys(sampleData).includes(key)) continue
			const values = sampleData[key].values
			sampleCountedFor.clear()
			/* values here is an array of result entires, one or more entries for each dt. e.g.
			[
				{ dt: 1, class: 'Blank', _SAMPLEID_: 1, origin: 'germline' },
				{ dt: 1, class: 'WT', _SAMPLEID_: 1, origin: 'somatic' },
				{ dt: 2, class: 'Blank', _SAMPLEID_: 1 },
				{ dt: 4, class: 'WT', _SAMPLEID_: 1 }
			]
			*/
			for (const value of values) {
				if (!dtClassMap.has(value.dt)) {
					dtClassMap.set(value.dt, {})
				}
				const dtClasses = dtClassMap.get(value.dt)
				if (dtClasses.byOrigin) {
					if (!dtClasses.byOrigin[value.origin][value.class]) {
						dtClasses.byOrigin[value.origin][value.class] = 1
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.origin} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
						dtClasses.byOrigin[value.origin][value.class] += 1
					}
				} else {
					if (!dtClasses[value.class]) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] = 1
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] += 1
					}
				}
				if (opts.withMnames && value.mname != undefined) {
					// synthetic WT/Blank rows lack mname, so are naturally skipped
					const origin = dtClasses.byOrigin ? value.origin : ''
					const gene = value.gene || ''
					const mnameKey = `mname:${value.dt}|${origin}|${value.class}|${gene}|${value.mname}`
					if (!sampleCountedFor.has(mnameKey)) {
						// count each sample once per dt/origin/class/gene/mname
						sampleCountedFor.add(mnameKey)
						const entry = mnameCountMap.get(mnameKey)
						if (entry) entry.samplecount += 1
						else
							mnameCountMap.set(mnameKey, {
								key: mnameKey,
								dt: value.dt,
								origin,
								class: value.class,
								gene,
								mname: value.mname,
								samplecount: 1
							})
					}
					/* tally the breakpoints of a sv/fusion. deliberately outside the
					mnameKey dedup above, as a sample may have two events of the same
					mname at different breakpoints and both are to be charted */
					if (value.dt == dtsv || value.dt == dtfusionrna) {
						const self = getSelfBreakpoint(value)
						const partner = getPartnerBreakpoints(value)[0]
						if (Number.isFinite(self.pos) && Number.isFinite(partner?.pos)) {
							const bpKey = `${mnameKey}|${self.pos}|${partner!.chr}|${partner!.pos}`
							if (!sampleCountedFor.has(bpKey)) {
								// count each sample once per distinct pair of breakpoints
								sampleCountedFor.add(bpKey)
								const bp = breakpointCountMap.get(bpKey)
								if (bp) bp.samplecount += 1
								else
									breakpointCountMap.set(bpKey, {
										mnameKey,
										pos: self.pos,
										partnerChr: partner!.chr,
										partnerPos: partner!.pos,
										samplecount: 1
									})
							}
						} else {
							/* event has no breakpoint coordinate, e.g. from a svfusion byname
							query, or of the not-yet-supported multi-gene pairlst shape. such an
							event cannot be charted and cannot satisfy a breakpoint range, so is
							counted separately for the ui to caveat the chart with */
							const noPosKey = `nopos:${mnameKey}`
							if (!sampleCountedFor.has(noPosKey)) {
								sampleCountedFor.add(noPosKey)
								noPositionCountMap.set(mnameKey, 1 + (noPositionCountMap.get(mnameKey) || 0))
							}
						}
					}
				}
			}
		}
		// breakpoints of each mname entry, k: mnameKey, v: BreakpointEntry[]
		const breakpointsByMname = new Map<string, any[]>()
		for (const b of breakpointCountMap.values()) {
			if (!breakpointsByMname.has(b.mnameKey)) breakpointsByMname.set(b.mnameKey, [])
			breakpointsByMname.get(b.mnameKey)!.push({
				pos: b.pos,
				partnerChr: b.partnerChr,
				partnerPos: b.partnerPos,
				samplecount: b.samplecount
			})
		}
		for (const lst of breakpointsByMname.values()) {
			lst.sort((a, b) => a.pos - b.pos || a.partnerPos - b.partnerPos)
		}
		// gene is only reported when annotated on the mutation data
		const formatMname = (e: any) => {
			const m: any = { mname: e.mname, class: e.class, samplecount: e.samplecount }
			if (e.gene) m.gene = e.gene
			const breakpoints = breakpointsByMname.get(e.key)
			if (breakpoints) m.breakpoints = breakpoints
			const noPositionCount = noPositionCountMap.get(e.key)
			if (noPositionCount) m.noPositionCount = noPositionCount
			return m
		}
		for (const [dt, classes] of dtClassMap) {
			const entry: any = { dt, classes }
			const mnameEntries = opts.withMnames
				? [...mnameCountMap.values()].filter(e => e.dt == dt).sort((a, b) => b.samplecount - a.samplecount)
				: []
			if (mnameEntries.length) {
				if (classes.byOrigin) {
					const byOrigin: { [origin: string]: any[] } = {}
					for (const origin of Object.keys(classes.byOrigin)) byOrigin[origin] = []
					for (const e of mnameEntries) {
						byOrigin[e.origin]?.push(formatMname(e))
					}
					entry.mnames = { byOrigin }
				} else {
					entry.mnames = mnameEntries.map(formatMname)
				}
			}
			lst.push(entry)
		}
	} else {
		const key2count = new Map()
		// k: category key
		// v: number of samples
		for (const sid in data.samples) {
			const v = data.samples[sid][$id]
			if (!v) continue
			if (!('key' in v)) continue
			key2count.set(v.key, 1 + (key2count.get(v.key) || 0))
		}
		for (const [key, count] of key2count) {
			lst.push({
				samplecount: count,
				key,
				label:
					data.refs?.byTermId?.[$id]?.events?.find((e: { event: any }) => e.event === key)?.label ||
					q.tw.term?.values?.[key]?.label ||
					key
			})
		}
	}

	const orderedLabels = getOrderedLabels(
		q.tw.term,
		data.refs?.byTermId?.[$id]?.bins || [],
		data.refs?.byTermId?.[$id]?.events,
		q.tw.q
	)
	if (orderedLabels.length) {
		lst.sort((a, b) => orderedLabels.indexOf(a.label) - orderedLabels.indexOf(b.label))
	}
	return [lst, orderedLabels]
}

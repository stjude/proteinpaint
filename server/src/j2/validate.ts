import computePercentile from '#shared/compute.percentile.js'
import { boxplot_getvalue } from '#shared/boxplot.js'
import { JT_na, JT_canonical, JT_ir } from '#shared/common.js'
import * as utils from '../utils.js'
import { mayLimitSamples } from '../mds3.filter.js'
import { setFile, validateSampleHeader, getTermSampleLimiter } from '../mds3.init.js'
import type { Junction, TermdbJunctionsRequest } from '#types'
import { mapParent2ChildrenWithSampleTypes } from '../utils/sampleTypes.ts'
import { getH5samples } from '../utils/h5samples.ts'
import { setQuerySampleTypes } from '#shared/terms.js'

// most junctions that listJunctions() returns read counts by sample for
const maxMatrixTop = 100

export async function validate_query_junction(ds: any, genome: any) {
	const tmp = ds.queries?.junction // fixme: tmp-to-q avoids tsc err
	if (!tmp) return
	const q = tmp
	await setFile(q, 'junction')
	await utils.validate_tabixfile(q.file)
	q.nochr = await utils.tabix_is_nochr(q.file, null, genome)
	{
		const lines = await utils.get_header_tabix(q.file)
		if (!lines[0]) throw 'header line missing from ' + q.file
		const l = lines[0].split('\t')
		if (l[0] != '#chr') throw 'header line not starting with #chr: ' + q.file
		if (l.length <= 5) throw 'junction header line must have more than 5 columns: ' + q.file
		q.samples = l.slice(5).map((i: string) => {
			return { name: i }
		})
		q.samples = validateSampleHeader(ds, q.samples, 'junction')
		// for the sample type selector of the junction term picker; .name is the sample id here
		setQuerySampleTypes(
			q,
			q.samples.map((s: any) => s.name),
			ds
		)
	}

	/*
	called by routes used for j2 tk
	keepLst:
		if provided, only return data on specified junctions
	*/
	q.listJunctions = async (
		param: TermdbJunctionsRequest,
		keepLst?: { start: number; stop: number; strand: string }[]
	) => {
		if (param.readcountCutoff !== undefined && (!Number.isInteger(param.readcountCutoff) || param.readcountCutoff < 0))
			throw new Error('readcountCutoff must be a non-negative integer')
		utils.validateRglst(param, genome)
		let hiddenTypes
		if (param.hiddenTypes) {
			if (typeof param.hiddenTypes != 'string') throw new Error('param.hiddenTypes not string')
			hiddenTypes = new Set(param.hiddenTypes.trim().split(','))
			if (!hiddenTypes.size) throw new Error('param.hiddenTypes invalid')
		}

		// QUICKFIX
		// assuming genomic data in mds3 tk is at sample-level, so setting
		// mapParent2Children=true to allow parent-level term data to be mapped
		// onto tk data (e.g. parent-level terms in variant2sample query or in tk filter)
		// with the sample types chosen in the genome browser
		mapParent2ChildrenWithSampleTypes(param, ds)

		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return { junctions: [], maxReadCount: 0 }
		}

		/* if both sample and readcount are valid and pass filter, return [readcount, samplename, IR ratio]
		str is "n;v1;v2;..": read count, then one value per element of info.events[], in the same order;
		the value of an intron retention event is the sample's IR ratio, blank for none
		irSlot: index in str of the IR ratio, when the junction has an IR event
		*/
		function getSampleReadcount(str, i, irSlot?: number): [number, string | number, number?] | undefined {
			if (!str) return // blank string
			const sname = q.samples[i - 5]?.name
			if (sname == undefined) throw new Error('sample undefined')
			if (limitSamples && !limitSamples.has(sname)) return // filtered out
			const vlst = str.split(';').map(Number) // a blank value becomes 0
			const rc = vlst[0] // first field is read count
			if (!Number.isInteger(rc)) return
			if (rc <= 0) return
			if (param.readcountCutoff && rc < param.readcountCutoff) return
			return [rc, sname, irSlot ? vlst[irSlot] : undefined]
		}

		const junctions: Junction[] = [] // list of junctions to be returned
		let maxReadCount = 0
		if (
			param.matrixTop !== undefined &&
			(!Number.isInteger(param.matrixTop) || param.matrixTop < 1 || param.matrixTop > maxMatrixTop)
		)
			throw new Error(`matrixTop must be an integer from 1 to ${maxMatrixTop}`)
		// with matrixTop, the [column, read count] pairs of the junctions found in the most samples so far
		const rcByJunction = new Map<Junction, [number, number][]>()
		for (const r of param.rglst || []) {
			await utils.readTabixLines({
				file: q.file,
				regions: [{ chr: q.nochr ? r.chr.replace('chr', '') : r.chr, start: r.start, stop: r.stop }],
				callback: (line: string) => {
					const l = line.split('\t')
					const start = Number(l[1])
					const stop = Number(l[2])
					const strand = l[3]
					if (start < r.start && stop > r.stop) return // completely spans r

					if (keepLst?.length) {
						//////////// detour //////////////
						if (!keepLst.find(i => i.start == start && i.stop == stop && i.strand == strand)) return // not in list, skip
						const j: Junction = {
							chr: '.',
							types: ['n'], // just to comply with type
							start,
							stop,
							strand,
							sn2rc: new Map<string | number, number>() // k: sample id, v: read count
						}
						const irSlot = getIRslot(l[4])
						if (irSlot) j.sn2ir = new Map<string | number, number>()
						for (let i = 5; i < l.length; i++) {
							const r = getSampleReadcount(l[i], i, irSlot)
							if (r) {
								j.sn2rc!.set(r[1], r[0])
								// a sample of the junction with no IR ratio retains none of the intron, as for j.IR below
								if (irSlot) j.sn2ir!.set(r[1], Number.isFinite(r[2]) ? r[2]! : 0)
							}
						}
						junctions.push(j)
						return
					}

					let info
					try {
						info = JSON.parse(l[4])
					} catch (_) {
						console.log(`invalid json for a junction: ${r.chr}:${start}-${stop}`)
						return
					}
					// found before computeTypes(), which may remove hidden events and so shift the values of samples
					const irIdx = info?.events?.findIndex((e: any) => e.type == JT_ir) ?? -1
					const types = computeTypes(info, hiddenTypes)
					if (!types.length) return // no visible types. this junction is filtered out by hiddenTypes
					const irSlot = irIdx != -1 && types.includes(JT_ir) ? irIdx + 1 : undefined
					const j: Junction = {
						chr: l[0],
						start,
						stop,
						info,
						types,
						strand
					}
					const readcounts: number[] = [] // array of read counts of samples carrying this junction
					const pairs: [number, number][] = []
					const irRatios: number[] = [] // of samples with intron retention, among those of readcounts[]

					let lastRCcolumn // remembers i for last sample with valid read count. helps to get singleton sample name
					for (let i = 5; i < l.length; i++) {
						const r = getSampleReadcount(l[i], i, irSlot)
						if (!r) continue
						readcounts.push(r[0])
						if (param.matrixTop) pairs.push([i, r[0]])
						lastRCcolumn = i
						if (r[2]! > 0) irRatios.push(r[2]!)
					}
					if (readcounts.length == 0) return
					if (irSlot) {
						if (irRatios.length) {
							j.IR = { sampleCount: irRatios.length, medianRatio: median(irRatios) }
						} else {
							// none of these samples retains the intron
							removeIRtype(j)
							if (!j.types.length) return
						}
					}
					for (const rc of readcounts) maxReadCount = Math.max(maxReadCount, rc)
					j.sampleCount = readcounts.length
					if (readcounts.length == 1) {
						j.medianReadCount = readcounts[0]
						// singleton. attach sample name
						// todo may check permission
						if (Number.isInteger(lastRCcolumn)) {
							const sampleId = q.samples[lastRCcolumn - 5].name
							j.sampleName = ds.cohort?.termdb?.q?.id2sampleName?.(sampleId) || sampleId
						}
					} else {
						readcounts.sort((i, j) => i - j)
						const o = boxplot_getvalue(readcounts)
						if (o.p50 !== undefined) {
							j.medianReadCount = o.p50
							j.readcountBoxplot = [o.p05!, o.p25!, o.p50, o.p75!, o.p95!]
						} else {
							j.medianReadCount = computePercentile(readcounts, 50, true)
						}
					}
					junctions.push(j)
					if (param.matrixTop) {
						rcByJunction.set(j, pairs)
						// no more than the matrix can hold: the junction in the fewest samples goes, of a tie the later one
						if (rcByJunction.size > param.matrixTop) {
							let least = j
							for (const k of rcByJunction.keys()) if (k.sampleCount! <= least.sampleCount!) least = k
							rcByJunction.delete(least)
						}
					}
					// todo terminate when exceeds limit
				}
			})
		}
		// no matrix with keepLst: its junctions carry sn2rc instead, and have no sampleCount to rank by
		if (!param.matrixTop || keepLst?.length) return { junctions, maxReadCount }

		// the columns of the samples that the request covers
		const columns: number[] = []
		q.samples.forEach((s: any, i: number) => {
			if (!limitSamples || limitSamples.has(s.name)) columns.push(i + 5)
		})
		const rowOf = new Map(columns.map((c, row) => [c, row]))
		const top = [...rcByJunction.keys()].sort((a, b) => b.sampleCount! - a.sampleCount!)
		const matrix = {
			samples: columns.map(c => {
				const id = q.samples[c - 5].name
				return ds.cohort?.termdb?.q?.id2sampleName?.(id) || id
			}),
			junctions: top.map(j => {
				const readcounts = new Array(columns.length).fill(0)
				for (const [c, rc] of rcByJunction.get(j)!) readcounts[rowOf.get(c)!] = rc
				return { chr: j.chr, start: j.start, stop: j.stop, strand: j.strand, readcounts }
			})
		}
		return { junctions, maxReadCount, matrix }
	}
	/*
	called by getData() and return sample level numeric values in required format
	*/
	q.get = async (param: { terms?: any[]; [key: string]: any }) => getJunctionData(param, q.listJunctions, ds)

	/*
	get sample details of one junction
	{
		junction{}
		filter
		readcountCutoff
	}
	q.getOneJunction = async (param: TermdbOneJunctionRequest) => {
		if (param.readcountCutoff !== undefined && (!Number.isInteger(param.readcountCutoff) || param.readcountCutoff < 0))
			throw new Error('readcountCutoff must be a non-negative integer')
		const j = param.junction
		if (!j) throw new Error('junction missing')
		if (invalidcoord(genome, j.chr, j.start, j.stop)) throw new Error('invalid coord in .junction{}')



		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			return {} // todo
		}
		const s2r = new Map() // k: sample id, v: read count of query junction
		await utils.readTabixLines({
			file: q.file, regions: [{ chr: (q.nochr ? j.chr.replace('chr', '') : j.chr), start: j.start, stop: j.stop }],
			callback: (line: string) => {
				const l = line.split('\t')
				const start = Number(l[1]) // must always be numbers
				const stop = Number(l[2])
				if (start != j.start || stop != j.stop || l[3] != j.strand) return
				// found this junction. collect read count for sample-level summary
				for (let i = 5; i < l.length; i++) {
					const str = l[i]
					if (!str) continue // blank
					const sname = q.samples[i - 5]?.name
					if (sname == undefined) throw new Error('sample undefined')
					if (limitSamples && !limitSamples.has(sname)) continue // filtered out
					// str is "n;%;%"
					const vlst = str.split(';').map(Number)
					const rc = vlst[0] // first field is read count
					if (!Number.isInteger(rc)) continue
					if (rc <= 0) continue
					if (param.readcountCutoff && rc < param.readcountCutoff) continue
					s2r.set(sname, vlst)
				}
			}
		})
		// todo summarize and return
		return {}
	}
	*/

	await validate_junction_cluster(ds, q)
}

/* Intron clusters for differential splicing: an h5 beside the junction tabix file.
allSampleSet is read by the diffSplice route. */
async function validate_junction_cluster(ds: any, junctionQ: any) {
	const q = junctionQ.cluster
	if (!q) return
	await setFile(q, 'junction.cluster')
	const samples = await getH5samples(q.file, 'samples')
	q.allSampleSet = new Set(samples)
	console.log(q.allSampleSet.size, `junction cluster samples from ${ds.label}`)
}

export async function getJunctionData(
	param: { terms?: any[]; [key: string]: any },
	listJunctions: (param: any, keepList: { start: number; stop: number; strand: string }[]) => Promise<any>,
	/** for the sample types of a term, see getTermSampleLimiter() */
	ds: any
) {
	if (!Array.isArray(param?.terms) || !param.terms.length) throw new Error('junction.get(): terms[] is required')
	const term2sample2value = new Map<string, Record<string, number>>()
	// the samples of each term's own sample types
	const limitSamples = getTermSampleLimiter(param, undefined, ds)
	for (const tw of param.terms) {
		if (!tw?.$id) throw new Error('junction.get(): term wrapper $id is required')
		const term = tw.term
		if (!term || term.type != 'junction') throw new Error('junction.get(): invalid junction term')
		if (!term.chr || !Number.isInteger(term.start) || !Number.isInteger(term.stop) || !term.strand) {
			throw new Error('junction.get(): junction term must include chr, integer start/stop, and strand')
		}
		if (term.measure != undefined && term.measure != JT_ir) {
			throw new Error(`junction.get(): invalid junction term measure='${term.measure}'`)
		}
		const query = {
			...param,
			rglst: [{ chr: term.chr, start: term.start, stop: term.stop }],
			readcountCutoff: tw.q?.readcountCutoff ?? param.readcountCutoff
		}
		delete query.terms
		// the term's own sample types are applied below, not those of the request, which may be for other terms
		delete (query as any).sampleTypes
		const keepList = [{ start: term.start, stop: term.stop, strand: term.strand }]
		const result = await listJunctions(query, keepList)
		const junction = result.junctions.find(
			(j: Junction) => j.start == term.start && j.stop == term.stop && j.strand == term.strand
		)
		/* by sample, the read count of the junction, or for a term of measure IR, the IR ratio. An IR term of a junction
		with no IR event has no value */
		const sn2value = term.measure == JT_ir ? junction?.sn2ir : junction?.sn2rc
		let samples: [string | number, number][] = [...(sn2value || [])]
		/* the samples of the sample types chosen for this term in the term picker. Applied here, per term,
		rather than through the request, whose sample types listJunctions() would apply to every term of it:
		a request may hold terms that chose different sample types */
		if (term.sampleTypes != null) {
			const keep = await limitSamples(term)
			if (keep) samples = samples.filter(([sid]) => keep.has(sid))
		}
		term2sample2value.set(tw.$id, Object.fromEntries(samples))
	}
	return { term2sample2value }
}

/* the index of the IR ratio in the value string of a sample, when the junction has an IR event, of the junction's
info column. Its values follow the read count in the order of info.events[] of the file */
function getIRslot(infoStr: string): number | undefined {
	let info
	try {
		info = JSON.parse(infoStr)
	} catch (_) {
		return // a junction of invalid info still has read counts
	}
	const irIdx = info?.events?.findIndex?.((e: any) => e.type == JT_ir) ?? -1
	return irIdx == -1 ? undefined : irIdx + 1
}

function median(values: number[]): number {
	values.sort((a, b) => a - b)
	const m = Math.floor(values.length / 2)
	return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2
}

/* for a junction with an intron retention event when no sample of the request retains the intron,
so that its types and events are as if it had no such event */
export function removeIRtype(j: Junction) {
	j.types = j.types.filter(t => t != JT_ir)
	if (j.info?.events) {
		j.info.events = j.info.events.filter((e: any) => e.type != JT_ir)
		if (!j.info.events.length) delete j.info.events
	}
}

/*
j: junction annotation
possible annotations:
- undefined. intergenic and no overlap with any isoform
- {..} object lacking events. 
- {canonical:true} 
- {canonical:true, events:[]} alternative exon usage
- {.., events:[]} 
an intron retention (IR) event is listed in types[] like any event. As IR mostly occurs on canonical junctions,
a non-canonical junction with no event other than IR is also na, so its color is that of na rather than IR

hide: set of types to hide
*/
export function computeTypes(j: any, hide: Set<string>): string[] {
	const types: string[] = []
	if (!j) {
		// lacks annotation
		if (!hide?.has(JT_na)) types.push(JT_na)
		return types
	}
	// j is valid object
	// TODO may introduce additional canonical types to annotate junctions using non-canonical-GT sites e.g. GA
	if (j.canonical) {
		if (!hide?.has(JT_canonical)) types.push(JT_canonical)
	}
	if (j.events) {
		if (!j.canonical && j.events.every(e => e.type == JT_ir) && !hide?.has(JT_na)) types.push(JT_na)
		const events: any[] = [] // when filtering using "hide", generate new array to prevent sending excess data
		for (const e of j.events) {
			if (typeof e.type != 'string') throw new Error('event.type missing')
			if (hide?.has(e.type)) continue
			events.push(e)
		}
		if (events.length) {
			j.events = events
			types.push(...new Set(events.map(i => i.type)))
		} else {
			delete j.events
		}
	} else {
		// no events
		if (!j.canonical) {
			// and not canonical. it is na
			if (!hide?.has(JT_na)) types.push(JT_na)
		}
	}
	delete j.canonical // at the end, this property is no longer needed
	return types
}

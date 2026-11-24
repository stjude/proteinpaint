import computePercentile from '#shared/compute.percentile.js'
import { boxplot_getvalue } from '#shared/boxplot.js'
import { JT_na, JT_canonical, JT_ir, junctionShareMeasure } from '#shared/common.js'
import * as utils from '../utils.js'
import { mayLimitSamples, normalizeSampleId } from '../mds3.filter.js'
import { setFile, validateSampleHeader } from '../mds3.init.js'
import type { Junction, TermdbJunctionsRequest } from '#types'
import { mayMapNonDictionaryData } from '../termdb.matrix.js'
import { getH5samples } from '../utils/h5samples.ts'
import { setQuerySampleTypes } from '#shared/terms.js'
import { rankSumP, bh } from '#shared/rankSum.js'

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
	groups:
		with the request's groupTw, each sample's group by sample id of the file, and the two groups in order, the first
		the reference: each junction gets a test between them, see testJunctionGroups(); not with keepLst
	*/
	q.listJunctions = async (
		param: TermdbJunctionsRequest,
		keepLst?: { start: number; stop: number; strand: string }[],
		groups?: JunctionGroups
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

		let limitSamples = await mayLimitSamples(param, q.samples, ds)
		// with groups, the samples of the groups only: the track's counts and medians are then of the samples compared
		if (groups) limitSamples = new Set([...groups.groupOf.keys()].filter(id => !limitSamples || limitSamples.has(id)))
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
		// junctions read from the file in the regions, including those filtered out below, e.g. by read count cutoff
		let totalCount = 0
		if (
			param.matrixTop !== undefined &&
			(!Number.isInteger(param.matrixTop) || param.matrixTop < 1 || param.matrixTop > maxMatrixTop)
		)
			throw new Error(`matrixTop must be an integer from 1 to ${maxMatrixTop}`)
		// with matrixTop, the [column, read count] pairs of the junctions found in the most samples so far
		const rcByJunction = new Map<Junction, [number, number][]>()
		/* with groups: per junction, its gene and the read count of each sample of a group, and per gene and sample the
		reads of all of the gene's junctions (in groups.region, else in view), whether shown or not and below
		readcountCutoff too, as the denominator of the sample's shares of the gene's junctions */
		const groupReads = new Map<Junction, { gene: string; reads: Map<string | number, number> }>()
		const geneTotal = new Map<string, Map<string | number, number>>()
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
					totalCount++

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

					const reads = groups && readGroupedSamples(l)

					let info
					try {
						info = JSON.parse(l[4])
					} catch (_) {
						console.log(`invalid json for a junction: ${r.chr}:${start}-${stop}`)
						return
					}
					const gene = reads ? junctionGene(info) : undefined
					// the totals are of the view's junctions, unless of a region of their own, read below
					if (reads && gene && !groups!.region) addTotals(gene, reads)
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
					if (reads && gene) groupReads.set(j, { gene, reads })
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
		if (groups?.region && !keepLst?.length) {
			// every junction with both ends in the region
			const g = groups.region
			await utils.readTabixLines({
				file: q.file,
				regions: [{ chr: q.nochr ? g.chr.replace('chr', '') : g.chr, start: g.start, stop: g.stop }],
				callback: (line: string) => {
					const l = line.split('\t')
					if (Number(l[1]) < g.start || Number(l[2]) > g.stop) return
					let gene
					try {
						gene = junctionGene(JSON.parse(l[4]))
					} catch (_) {
						return
					}
					if (gene) addTotals(gene, readGroupedSamples(l))
				}
			})
		}
		const tested = groups && !keepLst?.length ? testJunctionGroups(junctions, groupReads, geneTotal, groups) : {}
		// no matrix with keepLst: its junctions carry sn2rc instead, and have no sampleCount to rank by
		if (!param.matrixTop || keepLst?.length) return { junctions, maxReadCount, totalCount, ...tested }

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
		return { junctions, maxReadCount, totalCount, matrix, ...tested }

		function addTotals(gene: string, reads: Map<string | number, number>) {
			if (!geneTotal.has(gene)) geneTotal.set(gene, new Map())
			const t = geneTotal.get(gene)!
			for (const [id, rc] of reads) t.set(id, (t.get(id) || 0) + rc)
		}
		// the read counts of a line of the file of the samples in a group that the request covers, all of them
		function readGroupedSamples(l: string[]): Map<string | number, number> {
			const reads = new Map<string | number, number>()
			for (let i = 5; i < l.length; i++) {
				if (!l[i]) continue
				const id = q.samples[i - 5]?.name
				if (!groups!.groupOf.has(id) || (limitSamples && !limitSamples.has(id))) continue
				const rc = Number(l[i].split(';')[0])
				if (!Number.isInteger(rc) || rc <= 0) continue
				reads.set(id, rc)
			}
			return reads
		}
	}
	/*
	called by getData() and return sample level numeric values in required format
	*/
	q.get = async (param: { terms?: any[]; [key: string]: any }) =>
		getJunctionData(param, q.listJunctions, ds, q.geneJunctionTotals)

	/* by sample, the reads of all the junctions of a gene with both ends in a region (junctionGene()), of every sample:
	the denominator of a junction's share of its gene's junction reads, as testJunctionGroups() takes it */
	q.geneJunctionTotals = async (region: { chr: string; start: number; stop: number }, gene: string) => {
		const total = new Map<string | number, number>()
		await utils.readTabixLines({
			file: q.file,
			regions: [{ chr: q.nochr ? region.chr.replace('chr', '') : region.chr, start: region.start, stop: region.stop }],
			callback: (line: string) => {
				const l = line.split('\t')
				if (Number(l[1]) < region.start || Number(l[2]) > region.stop) return
				try {
					if (junctionGene(JSON.parse(l[4])) != gene) return
				} catch (_) {
					return
				}
				for (let i = 5; i < l.length; i++) {
					if (!l[i]) continue
					const rc = Number(l[i].split(';')[0])
					if (!Number.isInteger(rc) || rc <= 0) continue
					const id = q.samples[i - 5]?.name
					total.set(id, (total.get(id) || 0) + rc)
				}
			}
		})
		return total
	}

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
	ds: any,
	/** for a term of measure share: by sample, the reads of all the junctions of a gene in a region */
	geneJunctionTotals?: (
		region: { chr: string; start: number; stop: number },
		gene: string
	) => Promise<Map<string | number, number>>
) {
	if (!Array.isArray(param?.terms) || !param.terms.length) throw new Error('junction.get(): terms[] is required')
	const term2sample2value = new Map<string, Record<string, number>>()
	const limitSamples = await mayLimitSamples(param, null, ds)
	for (const tw of param.terms) {
		if (!tw?.$id) throw new Error('junction.get(): term wrapper $id is required')
		const term = tw.term
		if (!term || term.type != 'junction') throw new Error('junction.get(): invalid junction term')
		if (!term.chr || !Number.isInteger(term.start) || !Number.isInteger(term.stop) || !term.strand) {
			throw new Error('junction.get(): junction term must include chr, integer start/stop, and strand')
		}
		if (term.measure != undefined && term.measure != JT_ir && term.measure != junctionShareMeasure) {
			throw new Error(`junction.get(): invalid junction term measure='${term.measure}'`)
		}
		if (term.measure == junctionShareMeasure) validateShareTerm(term)
		const query = {
			...param,
			rglst: [{ chr: term.chr, start: term.start, stop: term.stop }],
			// a share counts every read, as the group test does
			readcountCutoff: term.measure == junctionShareMeasure ? 0 : tw.q?.readcountCutoff ?? param.readcountCutoff,
			skipSampleFiltering: true // defer sample filtering until source samples are mapped (see below)
		}
		const keepList = [{ start: term.start, stop: term.stop, strand: term.strand }]
		const result = await listJunctions(query, keepList)
		const junction = result.junctions.find(
			(j: Junction) => j.start == term.start && j.stop == term.stop && j.strand == term.strand
		)
		/* by sample, the read count of the junction; for a term of measure IR, the IR ratio (an IR term of a junction
		with no IR event has no value); for a term of measure share, its share of its gene's junction reads */
		let samples: [string | number, number][]
		if (term.measure == junctionShareMeasure) {
			if (!geneJunctionTotals) throw new Error('junction.get(): no junction reads by gene for a term of measure share')
			const totals = await geneJunctionTotals(term.region, term.gene)
			samples = Object.entries(junctionShares(junction?.sn2rc || new Map(), totals))
		} else {
			samples = [...((term.measure == JT_ir ? junction?.sn2ir : junction?.sn2rc) || [])]
		}
		// filter samples by sample type of term; a share's id is an object key, a string
		const s2v = Object.create(null)
		for (const [sid, value] of samples) {
			if (term.sampleTypes?.length && !term.sampleTypes.includes(ds.sampleId2Type.get(normalizeSampleId(sid)))) continue
			if (!Number.isFinite(value)) continue
			s2v[sid] = value
		}
		// map to target sample type
		const mappedValues = await mayMapNonDictionaryData(tw, { ...param, ds }, s2v)
		// filter samples
		const filteredValues = Object.create(null)
		for (const [sid, value] of Object.entries(mappedValues)) {
			const sampleId = normalizeSampleId(sid)
			if (limitSamples && !limitSamples.has(sampleId)) continue
			filteredValues[sid] = value
		}
		if (Object.keys(filteredValues).length) term2sample2value.set(tw.$id, filteredValues)
	}
	return { term2sample2value }
}

// the largest region whose junction reads are summed for a share
const maxShareRegion = 10_000_000

/* the share of a junction, in percent, of each sample with reads of its gene: the sample's reads of the junction over
its reads of all the gene's junctions, 0 for a sample with none of the junction, as testJunctionGroups() takes it; a
sample without reads of the gene has no share */
export function junctionShares(
	sn2rc: Map<string | number, number>,
	totals: Map<string | number, number>
): Record<string, number> {
	const out: Record<string, number> = {}
	for (const [id, total] of totals) if (total > 0) out[id] = (100 * (sn2rc.get(id) || 0)) / total
	return out
}

function validateShareTerm(term: any) {
	if (typeof term.gene != 'string' || !term.gene) throw new Error('junction.get(): a term of measure share needs .gene')
	const r = term.region
	if (
		r?.chr != term.chr ||
		!Number.isInteger(r.start) ||
		!Number.isInteger(r.stop) ||
		r.start > term.start ||
		r.stop < term.stop ||
		r.stop - r.start > maxShareRegion
	)
		throw new Error(
			`junction.get(): a term of measure share needs .region on its chromosome, around it and at most ${maxShareRegion} bp`
		)
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

export type JunctionGroups = {
	/** each sample's group, by its id in the file */
	groupOf: Map<string | number, string>
	/** the two groups, the first the reference */
	names: [string, string]
	/** the region of a sample's total junction reads; absent, the view */
	region?: { chr: string; start: number; stop: number }
}

/* the least mean share of its gene's junction reads, in either group, of a junction that testJunctionGroups() tests: a
junction of a few reads in some samples of one group gets a tiny p from how often it is there. ponytail: a fixed share;
a minimum sample count if this drops junctions that matter */
export const minJunctionShare = 0.001
/* the fewest samples of the two groups with reads of a junction that testJunctionGroups() tests: of a junction in one
sample and none of the rest, the rank-sum test's tie correction leaves so little variance that the one sample gives a
small p */
export const minJunctionSamples = 5

/* The gene of a junction, whose junctions' reads are the denominator of its share: the gene that both of its ends are
annotated to (in an exon or an intron of it), the first by name of several; else the one gene of its only annotated
end. undefined for a junction joining two genes, e.g. a fusion, or of no gene: those are not tested. */
export function junctionGene(info: any): string | undefined {
	const genes = (keys: string[]) =>
		new Set<string>(keys.flatMap(k => (info?.[k] || []).map((e: any) => e.gene)).filter(Boolean))
	const left = genes(['exonleft', 'exonleftin', 'intronleft']),
		right = genes(['exonright', 'exonrightin', 'intronright'])
	const both = [...left].filter(g => right.has(g)).sort()
	if (both.length) return both[0]
	if (!left.size && right.size == 1) return [...right][0]
	if (!right.size && left.size == 1) return [...left][0]
}

/* Per junction of a gene, a Wilcoxon rank-sum test between two groups of samples of its share of each sample's reads of
the gene's junctions (in groups.region, else in view), 0 for a sample without it, and BH q over the junctions tested:
those with a mean share of at least minJunctionShare in a group and in at least minJunctionSamples samples; each group's
mean share. The share of the gene and not
the read count, as a sample's reads of every junction of a gene rise with its expression and the sequencing depth: a
group that makes more of the gene, e.g. t(4;14) of NSD2, would otherwise have more of every junction; and of the gene
and not of the locus, as then the junctions of a neighbouring gene would lose share as the gene gains. A sample with no
reads of the gene's junctions is left out of its tests. Sets p, q, groupShares and gene of each junction tested; returns
the groups with their numbers of samples with junction reads. */
export function testJunctionGroups(
	junctions: Junction[],
	groupReads: Map<Junction, { gene: string; reads: Map<string | number, number> }>,
	geneTotal: Map<string, Map<string | number, number>>,
	groups: JunctionGroups
): { groups: { name: string; n: number }[]; groupTest: { minSamples: number; minShare: number } } {
	const withReads = new Set([...geneTotal.values()].flatMap(t => [...t.keys()]))
	const out = {
		groups: groups.names.map(name => ({ name, n: [...withReads].filter(id => groups.groupOf.get(id) == name).length })),
		// what is not tested, for the track's legend to state
		groupTest: { minSamples: minJunctionSamples, minShare: minJunctionShare }
	}
	const tested = junctions.filter(j => groupReads.has(j) && geneTotal.has(groupReads.get(j)!.gene))
	const shares = tested.map(j => {
		const { gene, reads } = groupReads.get(j)!
		const total = geneTotal.get(gene)!
		return groups.names.map(g =>
			[...total.keys()].filter(id => groups.groupOf.get(id) == g).map(id => (reads.get(id) || 0) / total.get(id)!)
		)
	})
	const means = shares.map(([a, b]) => (a.length && b.length ? ([mean(a), mean(b)] as [number, number]) : null))
	const p = shares.map(([a, b], i) =>
		!means[i] ||
		Math.max(...means[i]!) < minJunctionShare ||
		[...a, ...b].filter(v => v > 0).length < minJunctionSamples
			? null
			: rankSumP(a, b)
	)
	const q = bh(p)
	tested.forEach((j, i) => {
		if (!means[i]) return
		j.gene = groupReads.get(j)!.gene
		j.groupShares = means[i]!
		if (p[i] === null) return
		j.p = p[i]!
		j.q = q[i]!
	})
	return out
}

function mean(values: number[]): number {
	return values.reduce((a, b) => a + b, 0) / values.length
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

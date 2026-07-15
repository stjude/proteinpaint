import computePercentile from '#shared/compute.percentile.js'
import { boxplot_getvalue } from '#shared/boxplot.js'
import { invalidcoord, JT_na, JT_canonical } from '#shared/common.js'
import * as utils from '../utils.js'
import { mayLimitSamples } from '../mds3.filter.js'
import { setFile, validateSampleHeader } from '../mds3.init.js'
import type { Junction, TermdbJunctionsRequest, TermdbOneJunctionRequest } from '#types'

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
	}

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
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return { junctions: [], maxReadCount: 0 }
		}

		function getSampleReadcount(str, i) {
			// if both sample and readcount are valid and pass filter, return [readcount, samplename]
			if (!str) return // blank string
			const sname = q.samples[i - 5]?.name
			if (sname == undefined) throw new Error('sample undefined')
			if (limitSamples && !limitSamples.has(sname)) return // filtered out
			// str is "n;%;%"
			const vlst = str.split(';').map(Number)
			const rc = vlst[0] // first field is read count
			if (!Number.isInteger(rc)) return
			if (rc <= 0) return
			if (param.readcountCutoff && rc < param.readcountCutoff) return
			return [rc, sname]
		}

		const junctions: Junction[] = [] // list of junctions to be returned
		let maxReadCount = 0
		for (const r of param.rglst || []) {
			await utils.get_lines_bigfile({
				args: [q.file, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
				callback: (line: string) => {
					const l = line.split('\t')
					const start = Number(l[1])
					const stop = Number(l[2])
					const strand = l[3]
					if (start < r.start && stop > r.stop) return // completely spans r

					if (keepLst?.length) {
						// detour
						if (!keepLst.find(i => i.start == start && i.stop == stop && i.strand == strand)) return // not in list, skip
						const j: Junction = {
							chr: '.',
							types: ['n'], // just to comply with type
							start,
							stop,
							strand,
							sn2rc: new Map() // k: sample id, v: read count
						}
						for (let i = 5; i < l.length; i++) {
							const r = getSampleReadcount(l[i], i)
							if (r) {
								j.sn2rc.set(r[1], r[0])
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
					const types = computeTypes(info, hiddenTypes)
					if (!types.length) return // no visible types. this junction is filtered out by hiddenTypes
					const j: Junction = {
						chr: l[0],
						start,
						stop,
						info,
						types,
						strand
					}
					const readcounts: number[] = [] // array of read counts of samples carrying this junction
					for (let i = 5; i < l.length; i++) {
						const r = getSampleReadcount(l[i], i)
						if (!r) continue
						readcounts.push(r[0])
						maxReadCount = Math.max(maxReadCount, r[0])
					}
					if (readcounts.length == 0) return
					j.sampleCount = readcounts.length
					if (readcounts.length == 1) {
						j.medianReadCount = readcounts[0]
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
					// todo terminate when exceeds limit
				}
			})
		}
		return { junctions, maxReadCount }
	}
	/*
	get sample details of one junction
	{
		junction{}
		filter
		readcountCutoff
	}
	*/
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
		await utils.get_lines_bigfile({
			args: [q.file, (q.nochr ? j.chr.replace('chr', '') : j.chr) + ':' + j.start + '-' + j.stop],
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
}
/*
j: junction annotation
possible annotations:
- undefined. intergenic and no overlap with any isoform
- {..} object lacking events. 
- {canonical:true} 
- {canonical:true, events:[]} alternative exon usage
- {.., events:[]} 

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
	if (j.canonical) {
		if (!hide?.has(JT_canonical)) types.push(JT_canonical)
	}
	if (j.events) {
		const events: any[] = [] // when filtering using "hide", generate new array to prevent sending excess data
		for (const e of j.events) {
			// todo migrate attrValue to e.type
			if (typeof e.attrValue != 'string') throw new Error('event.attrValue missing')
			if (hide?.has(e.attrValue)) continue
			events.push(e)
		}
		if (events.length) {
			j.events = events
			types.push(...new Set(events.map(i => i.attrValue)))
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

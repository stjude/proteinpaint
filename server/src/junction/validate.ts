import computePercentile from '#shared/compute.percentile.js'
import { invalidcoord } from '#shared/common.js'
import * as utils from '../utils.js'
import { mayLimitSamples } from '../mds3.filter.js'
import { setFile, validateSampleHeader } from '../mds3.init.js'
import type { TermdbJunctionsRequest, TermdbOneJunctionRequest } from '#types'

type Junction = {
	chr: string
	start: number
	stop: number
	strand: string
	sampleCount?: number
	medianReadCount?: number
	[key: string]: any
}

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

	q.listJunctions = async (param: TermdbJunctionsRequest) => {
		if (param.minReadCount !== undefined && (!Number.isInteger(param.minReadCount) || param.minReadCount < 0))
			throw new Error('minReadCount must be a non-negative integer')
		utils.validateRglst(param, genome)
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, return blank array for no data
			return { junctions: [] }
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
					if (start < r.start && stop > r.stop) return // completely spans r
					let j: Junction
					try {
						j = JSON.parse(l[4])
					} catch (_) {
						return
					}
					computeType(j)
					if (!j.type) throw new Error('no type')
					// skip type by param
					j.chr = l[0]
					j.start = start
					j.stop = stop
					j.strand = l[3]
					const readcounts: number[] = [] // array of read counts of samples carrying this junction
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
						if (param.minReadCount && rc < param.minReadCount) continue
						readcounts.push(rc)
						maxReadCount = Math.max(maxReadCount, rc)
					}
					if (readcounts.length == 0) return
					j.sampleCount = readcounts.length
					j.medianReadCount = computePercentile(readcounts, 50, false)
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
		minReadCount
	}
	*/
	q.getOneJunction = async (param: TermdbOneJunctionRequest) => {
		if (param.minReadCount !== undefined && (!Number.isInteger(param.minReadCount) || param.minReadCount < 0))
			throw new Error('minReadCount must be a non-negative integer')
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
					if (param.minReadCount && rc < param.minReadCount) continue
					s2r.set(sname, vlst)
				}
			}
		})
		// todo summarize and return
		return {}
	}
}
function computeType(j) {
	// todo
	j.type = 'canonical'
}

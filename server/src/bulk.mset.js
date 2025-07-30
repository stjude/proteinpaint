import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { get_samples } from './termdb.sql.js'
import * as bulk from '#shared/bulk.js'
import * as bulksnv from '#shared/bulk.snv.js'
import * as bulkcnv from '#shared/bulk.cnv.js'
import * as bulkdel from '#shared/bulk.del.js'
import * as bulkitd from '#shared/bulk.itd.js'
import * as bulksv from '#shared/bulk.sv.js'
import * as bulksvjson from '#shared/bulk.svjson.js'
import * as bulktrunc from '#shared/bulk.trunc.js'

const handlers = {
	snvindel: bulksnv,
	sv: bulksv,
	fusion: bulksv,
	svjson: bulksvjson,
	cnv: bulkcnv,
	itd: bulkitd,
	deletion: bulkdel,
	truncation: bulktrunc
}

/*
	tw: {
		term: {
			type: 'geneVariant', 
			name: '...'
		}
	}

	q: {
		ds, 
		genome
	}


*/
export async function mayGetGeneVariantData(tw, q) {
	// assumes this function will get attached as a method of a dataset bootstrap object
	const ds = this
	const tname = tw.term.name
	const flagset = await get_flagset(ds, q.genome)
	const bySampleId = new Map()
	if (!flagset) return bySampleId

	let filterSamples
	if (q?.filter?.lst.length > 0) {
		// requires that not only q.filter{} is present, but also filter.lst[] is a non-empty array
		// as client may send filter with blank array of tvs and will break get_samples()
		//!!! DO NOT USE FOR geneVariant filterCTE constructor
		filterSamples = [...new Set((await get_samples(q, ds)).map(i => i.id))]
	}

	for (const flagname in flagset) {
		const flag = flagset[flagname]
		if (!(tname in flag.data)) continue
		for (const d of flag.data[tname]) {
			const sid = d._SAMPLEID_
			if (filterSamples && !filterSamples.includes(sid)) continue
			if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
			const sampleData = bySampleId.get(sid)
			if (!(tname in sampleData)) sampleData[tname] = { key: tname, values: [], label: tname }
			sampleData[tname].values.push(d)
		}
		/*
			process and store each sampleId in bySampleId as below. May only some entries in values[] has origin
				<sampleId> : {
					<gene>: {
						values: [
							{ dt, class, mname, origin }          // a mutation data point
							{ dt, class:'WT', origin }    // if this sample is wildtype
							{ dt, class:'Blank', origin}  // if is not assayed for this dt
						]
					}
				}
		*/
		if (ds.assayAvailability?.byDt) {
			for (const dtKey in ds.assayAvailability.byDt) {
				const dt = ds.assayAvailability.byDt[dtKey]

				if (dt.byOrigin) {
					for (const origin in dt.byOrigin) {
						const sub_dt = dt.byOrigin[origin]
						addDataAvailability(dtKey, sub_dt, bySampleId, tname, origin, filterSamples)
					}
				} else addDataAvailability(dtKey, dt, bySampleId, tname, false, filterSamples)
			}
		}
	}
	return bySampleId
}

function addDataAvailability(dtKey, dt, bySampleId, tname, origin, filterSamples) {
	for (const sid of dt.yesSamples) {
		if (filterSamples && !filterSamples.includes(sid)) continue
		if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
		const sampleData = bySampleId.get(sid)
		if (!(tname in sampleData)) sampleData[tname] = { key: tname, values: [], label: tname }
		if (origin) {
			if (!sampleData[tname].values.some(val => val.dt == dtKey && val.origin == origin))
				sampleData[tname].values.push({ dt: parseInt(dtKey), class: 'WT', _SAMPLEID_: sid, origin: origin })
		} else {
			if (!sampleData[tname].values.some(val => val.dt == dtKey))
				sampleData[tname].values.push({ dt: parseInt(dtKey), class: 'WT', _SAMPLEID_: sid })
		}
	}
	for (const sid of dt.noSamples) {
		if (filterSamples && !filterSamples.includes(sid)) continue
		if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
		const sampleData = bySampleId.get(sid)
		if (!(tname in sampleData)) sampleData[tname] = { key: tname, values: [], label: tname }
		if (origin) {
			if (!sampleData[tname].values.some(val => val.dt == dtKey && val.origin == origin))
				sampleData[tname].values.push({ dt: parseInt(dtKey), class: 'Blank', _SAMPLEID_: sid, origin: origin })
		} else {
			if (!sampleData[tname].values.some(val => val.dt == dtKey))
				sampleData[tname].values.push({ dt: parseInt(dtKey), class: 'Blank', _SAMPLEID_: sid })
		}
	}
}

export async function getTermTypes(q) {
	// assumes this function will get attached as a method of a dataset bootstrap object
	const ds = this
	try {
		const ids = typeof q.ids == 'string' ? JSON.parse(q.ids) : q.ids
		const qmarks = ids.map(() => '?').join(',')
		const sql = `SELECT id, name, type, jsondata, parent_id FROM terms WHERE id IN (${qmarks}) OR name IN (${qmarks})`
		const rows = ds.cohort.db.connection.prepare(sql).all([...ids, ...ids])
		const terms = {}
		for (const r of rows) {
			if (r.jsondata) Object.assign(r, JSON.parse(r.jsondata))
			terms[r.id] = r
		}

		const remainingIds = ids.filter(id => !terms[id])
		const flagset = await get_flagset(ds, q.genome)
		if (flagset) {
			for (const flagname in flagset) {
				const flag = flagset[flagname]
				if (!flag.data) continue
				for (const name of remainingIds) {
					if (name in flag.data && !(name in terms)) terms[name] = { name, type: 'geneVariant' }
				}
			}
		}

		return terms
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

/*
	matches: object to track matching gene names
		{ equals: [], startsWith: [], startsWord: [], includes: [] }

	str: substring to match against gene name

	q: hydrated request object

	maxGeneNameLength: optional, useful to avoid long fused gene strings
*/
export async function mayGetMatchingGeneNames(matches, str, q, maxGeneNameLength = 25) {
	// assumes this function will get attached as a method of a dataset bootstrap object
	const ds = this
	let unmatched = 0
	const flagset = await get_flagset(ds, q.genome)
	if (!flagset) return
	for (const flagname in flagset) {
		const flag = flagset[flagname]
		for (const gene in flag.data) {
			if (gene.length > maxGeneNameLength) continue
			if (!flag.data[gene]?.length) continue
			const d = { name: gene, type: 'geneVariant', isleaf: true }
			if (gene === str) matches.equals.push(d)
			else if (gene.startsWith(str)) matches.startsWith.push(d)
			else if (gene.includes(' ' + str)) matches.startsWord.push(d)
			else if (gene.includes(str)) matches.includes.push(d)
			else {
				if (gene == 'TP53') unmatched++
			}
		}
	}
}

async function get_flagset(ds, genome) {
	const cohort = ds.cohort
	try {
		if (cohort.mutationFlagSet) return cohort.mutationFlagSet
		if (!cohort.mutationset) return
		const flagset = {}
		const smap = ds.sampleName2Id

		for (const [index, mset] of cohort.mutationset.entries()) {
			const flag = await process_mset(index, mset, genome)
			flagset[Math.random()] = flag
			for (const gene in flag.data) {
				for (const d of flag.data[gene]) {
					// TODO: fix the sample names in all mutation text files (PNET may use sample0;sample1; aliases)
					// if there is no semicolon in d.sample, then d.sample === d._SAMPLENAME_
					d._SAMPLENAME_ = d.sample.split(';')[0].trim()
					d._SAMPLEID_ = smap.get(d._SAMPLENAME_) || d._SAMPLENAME_
				}
			}
		}
		cohort.mutationFlagSet = flagset
		return flagset
	} catch (e) {
		throw e
	}
}

async function process_mset(index, mset, genome) {
	const flag = bulk.init_bulk_flag(genome)
	if (!flag) throw 'init_bulk_flag() failed'
	flag.tpsetname = mset.name ? mset.name : 'set' + index
	for (const key in mset) {
		if (!(key in handlers)) throw `unknown mutationset: ${key}`
		const file = mset[key].startsWith('/') ? mset[key] : path.join(serverconfig.tpmasterdir, mset[key])
		try {
			const text = await fs.promises.readFile(file, 'utf8')
			const lines = text.trim().split(/\r?\n/)
			const herr = handlers[key].parseheader(lines[0], flag)
			if (herr) throw `${key} header line error: herr`
			for (let i = 1; i < lines.length; i++) {
				handlers[key].parseline(i, lines[i], flag)
			}
		} catch (e) {
			throw e
		}
	}
	return flag
}

import { filterJoin } from '#shared/filter.js'
import { get_rows_by_one_key } from './termdb.sql.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import serverconfig from './serverconfig.js'

/*

q{}
	.chr/start/stop
	.filter{}       -- bona fide filter obj
	.details{}
		.groups[]   -- array length must be 1 or 2
	.variantFilter{}

not integrated into mds3.load.js due to !!HARDCODED!! use of ds.queries.snvindel.byrange.get()
performs post-processing of data from byrange.get()

get_mds3variantData
	validateParam
	getResultsWithMlst
		getFilterObj
		getMlstWithAlt
			getAllelicCount
		mlst2sampleCount
		mergeMlstFromTwoFilterGroups
	byrange.get()
	compute_1group
	compute_2groups
		compute_2groups_bothFilter
		compute_2groups_filterPopulation
			may_apply_fishertest
			getGroupsData
			mayGet_pop2average
		compute_2groups_valueDiff
			AFtest_adjust_race
*/

export async function get_mds3variantData(q, res, ds, genome) {
	validateParam(q, ds)

	const results = await getResultsWithMlst(q, ds)
	/* results = {
		mlst[]
		skipMcountWithoutAlt: int
		totalSampleCount_?: int
	}
	*/

	if (q.details.groups.length == 1) {
		// single group
		compute_1group(ds, results.mlst, q.details.groups[0])
	} else if (q.details.groups.length == 2) {
		await compute_2groups(ds, q.details, results)
	} else {
		throw 'q.details.groups.length not 1 or 2'
	}

	// result.mlst[].nm_axis_value is computed

	for (const m of results.mlst) {
		delete m.samples
		delete m._altCount
		delete m._refCount
	}

	res.send(results)
}

function validateParam(q, ds) {
	if (!q.chr) throw 'q.chr missing'
	q.start = Number(q.start)
	q.stop = Number(q.stop) // somehow q.stop can be string
	if (!Number.isInteger(q.start) || !Number.isInteger(q.stop)) throw 'q.start/stop is not integer'
	if (typeof q.details != 'object') throw 'q.details{} not object'
	if (!Array.isArray(q.details.groups)) throw 'q.details.groups[] not array'
	if (!q.details.groups[0]) throw 'q.details.groups[0] missing'
	if (q.details.groups.length > 2) throw 'q.details.groups[] has more than 2'
	for (const g of q.details.groups) {
		if (g.type == 'filter') {
			if (g.filter) {
				if (typeof g.filter != 'object') throw '.filter not an object for group type=filter'
			} else if (g.filterByCohort) {
				if (!ds.cohort.termdb.selectCohort) throw 'filterByCohort in use but ds not using subcohort'
				if (typeof g.filterByCohort != 'object') throw '.filterByCohort not an object for group type=filter'
				// xx
			} else {
				throw 'unknown structure of group.type=filter'
			}
		} else if (g.type == 'population') {
			if (!g.key) throw '.key missing from group type=population'
			if (!ds.queries.snvindel?.populations) throw 'group type=population but this ds does not have populations'
			if (!ds.queries.snvindel.populations.find(i => i.key == g.key)) throw 'invalid key of group type=population'
		} else if (g.type == 'info') {
			if (!g.infoKey) throw '.infoKey missing from group type=info'
			// TODO verify info field
		} else {
			throw 'unknown group type from details.groups[]'
		}
	}
	if (q.details.groupTestMethods) {
		if (!Array.isArray(q.details.groupTestMethods)) throw 'details.groupTestMethods[] not array'
		if (!Number.isInteger(q.details.groupTestMethodsIdx)) throw 'details.groupTestMethodsIdx not integer'
		if (!q.details.groupTestMethods[q.details.groupTestMethodsIdx])
			throw 'invalid array index of details.groupTestMethodsIdx'
	}
}

async function getResultsWithMlst(q, ds) {
	// bcf query parameter is reused
	const param = {
		rglst: [{ chr: q.chr, start: q.start, stop: q.stop }],
		addFormatValues: true, // allows to add FORMAT including GT in each
		variantFilter: q.variantFilter
	}

	// g1 is always valid, g2 is optional
	// query method will be dependent on if there are two groups, and if both groups are type=filter
	const [g1, g2] = q.details.groups

	// if there are two type=filter groups, must do byrange.get() for each group, then merge mlst from both queries
	if (g1.type == 'filter' && g2?.type == 'filter') {
		param.filterObj = getFilterObj(q, g1.filter)
		const lst1 = await ds.queries.snvindel.byrange.get(param)
		const r1 = getMlstWithAlt(lst1)

		param.filterObj = getFilterObj(q, g2.filter)
		const lst2 = await ds.queries.snvindel.byrange.get(param)
		const r2 = getMlstWithAlt(lst2)

		const mlst = mergeMlstFromTwoFilterGroups(r1.mlst, r2.mlst, q)
		const results = {
			mlst,
			totalSampleCount_group1: mlst2sampleCount(r1.mlst),
			totalSampleCount_group2: mlst2sampleCount(r2.mlst)
		}
		return results
	}

	// not both groups are type=filter, do just one query

	param.filterObj = getFilterObj(q)
	const mlst = await ds.queries.snvindel.byrange.get(param)
	/*
	{
		chr/pos/class/dt/mname
		alt/ref
		info{}
		samples[]
			sample_id:int
			formatK2v: {
				GT:'0/1'
			}
	}
	*/

	const results = getMlstWithAlt(mlst)
	// results = {mlst[], skipMcountWithoutAlt}, and drop out m without any ALT

	// if there's one group with type=filter, the filter is already included by getFilterObj() and all samples from mlst are from this filter; count number of samples and return to client
	if (g1.type == 'filter') results.totalSampleCount_group1 = mlst2sampleCount(mlst)
	else if (g2?.type == 'filter') results.totalSampleCount_group2 = mlst2sampleCount(mlst)

	return results
}

function mlst2sampleCount(mlst) {
	const sset = new Set()
	for (const m of mlst) {
		if (!m.samples) continue
		for (const s of m.samples) sset.add(s.sample_id)
	}
	return sset.size
}

function mergeMlstFromTwoFilterGroups(lst1, lst2, q) {
	const [g1, g2] = q.details.groups
	const mlst = [] // after merging
	for (const m1 of lst1) {
		m1.groupData = [{ refCount: m1._refCount, altCount: m1._altCount }]
		const m2 = lst2.find(i => i.chr == m1.chr && i.pos == m1.pos && i.ref == m1.ref && i.alt == m1.alt)
		if (m2) {
			m1.groupData.push({ refCount: m2._refCount, altCount: m2._altCount })
		} else {
			m1.groupData.push({ refCount: 0, altCount: 0 })
		}
		mlst.push(m1)
	}
	for (const m2 of lst2) {
		const m1 = lst1.find(i => i.chr == m2.chr && i.pos == m2.pos && i.ref == m2.ref && i.alt == m2.alt)
		if (m1) continue // already added
		m2.groupData = [
			{ refCount: 0, altCount: 0 },
			{ refCount: m2._refCount, altCount: m2._altCount }
		]
		mlst.push(m2)
	}
	return mlst
}

function getMlstWithAlt(mlst) {
	const result = {
		mlst: [],
		skipMcountWithoutAlt: 0
	}
	for (const m of mlst) {
		const [a, b] = getAllelicCount(m)
		if (a == 0) {
			result.skipMcountWithoutAlt++
			continue
		}
		m._altCount = a
		m._refCount = b - a
		result.mlst.push(m)
	}
	return result
}

/*
merge filterObj from multiple sources to one (and use in byrange.get())
1. q.filter, mass global filter
2. q.details.groups[].type=='filter'
*/
function getFilterObj(q, gf) {
	const lst = [q.filter]
	if (gf) {
		lst.push(gf)
	} else {
		for (const grp of q.details.groups) {
			if (grp.type == 'filter') lst.push(grp.filter)
		}
	}
	const f = filterJoin(lst)
	return f
}

/*
based on g.type, assign nm_axis_value for each variant

mlst[]
	.info{}
	.samples[]
g{}
	.type=str
*/
function compute_1group(ds, mlst, g) {
	if (g.type == 'filter') {
		// the only group is "filter", since mlst samples are already reflecting the filter, simply compute AF from all samples of each mlst[]
		for (const m of mlst) {
			m.nm_axis_value = Number((m._altCount / (m._altCount + m._refCount)).toPrecision(2))
		}
		return
	}
	if (g.type == 'info') {
		if (!g.infoKey) throw 'infoKey missing on single group.type=info'
		for (const m of mlst) {
			const v = m.info[g.infoKey]
			if (v == undefined) {
				// missing value
			} else {
				// since it is assumed to be numeric value
				const n = Number(v)
				if (Number.isNaN(n)) {
					// not a number
				} else {
					m.nm_axis_value = n
				}
			}
		}
		return
	}
	if (g.type == 'population') {
		// simple fix: return AF from the first set of ancestry
		const g2 = ds.queries.snvindel.populations.find(i => i.key == g.key)
		if (!g2) throw 'unknown population'
		for (const m of mlst) {
			let ac = 0,
				an = 0
			for (const s of g2.sets) {
				ac += Number(m.info[s.infokey_AC] || 0)
				an += Number(m.info[s.infokey_AN] || 0)
			}
			m.nm_axis_value = ac / an
		}
		return
	}
	throw 'unknown type of single group'
}

function getAllelicCount(m) {
	// count all alleles and does not assume diploid, to allow it to work with chrY
	let A = 0,
		T = 0
	for (const s of m.samples) {
		if (!s?.formatK2v?.GT) continue
		// ds may configure to use '|' if it exists in vcf file
		const tmp = s.formatK2v.GT.split('/').map(Number)
		T += tmp.length
		for (const i of tmp) {
			if (i == m.altAlleleIdx) A++
		}
	}
	return [A, T]
}

async function compute_2groups(ds, details, results) {
	const [g1, g2] = details.groups // two groups from query parameter created on frontend

	if (g1.type == 'filter' && g2.type == 'filter') {
		// both groups are filters. only do fisher?
		await compute_2groups_bothFilter(ds, details, results.mlst)
		return
	}

	if ((g1.type == 'population' && g2.type == 'filter') || (g2.type == 'population' && g1.type == 'filter')) {
		// filter vs population
		await compute_2groups_filterPopulation(ds, details, results)
		return
	}
	// for the rest, always value diff
	compute_2groups_valueDiff(ds, details, results.mlst)
}

/*
ds
details
	one group is filter, the other is population
results{}
*/
async function compute_2groups_filterPopulation(ds, details, results) {
	const pop2average = await mayGet_pop2average(ds, details, results) // undefined if not used; also attached to results{}

	for (const m of results.mlst) {
		m.groupData = getGroupsData(ds, details, m, pop2average)
	}
	// data from mlst is ready for testing

	const method = details.groupTestMethods[details.groupTestMethodsIdx]
	if (!method) throw 'details.groupTestMethodsIdx out of bound'
	// method={name,axisLabel}
	switch (method.name) {
		case 'Allele frequency difference':
			compute_2groups_valueDiff(ds, details, results.mlst)
			return
		case "Fisher's exact test":
			await may_apply_fishertest(results.mlst)
			return
		default:
			throw 'unknown value from groupTestMethods[]'
	}
}

async function compute_2groups_bothFilter(ds, details, mlst) {
	// m.groupData is already set for each of mlst[]

	const method = details.groupTestMethods[details.groupTestMethodsIdx]
	if (!method) throw 'details.groupTestMethodsIdx out of bound'
	// method={name,axisLabel}
	switch (method.name) {
		case 'Allele frequency difference':
			compute_2groups_valueDiff(ds, details, mlst)
			return
		case "Fisher's exact test":
			await may_apply_fishertest(mlst)
			return
		default:
			throw 'unknown value from groupTestMethods[]'
	}
}

function compute_2groups_valueDiff(ds, details, mlst) {
	const [g1, g2] = details.groups
	compute_1group(ds, mlst, g1)
	const g1values = mlst.map(m => m.nm_axis_value)
	compute_1group(ds, mlst, g2)
	for (const [i, m] of mlst.entries()) {
		m.nm_axis_value = g1values[i] - m.nm_axis_value
	}
}

function getGroupsData(ds, details, m, pop2average) {
	// from m{}, get data for groups defined in q.details.groups[]
	const groupData = [] // one element for each of q.details.groups[], in the same order
	for (const g of details.groups) {
		if (g.type == 'info') {
			if (!g.key) throw 'group.key missing for type=info'
			groupData.push({ value: m.info[g.key] })
			continue
		}
		if (g.type == 'filter') {
			// this group's filter is already combined by getFilterObj(), meaning all samples from m.samples[] are from this group
			groupData.push({ altCount: m._altCount, refCount: m._refCount })
			continue
		}
		if (g.type == 'population') {
			if (!g.key) throw 'group.key missing for type=population'
			const population = ds.queries.snvindel.populations.find(i => i.key == g.key)
			if (!population) throw 'invalid group.key for population'
			const set2value = new Map()
			/*  k: population set key
				v: { ACraw, ANraw, ACadj, ANadj }
			*/
			for (const aset of population.sets) {
				set2value.set(aset.key, {
					ACraw: Number(m.info[aset.infokey_AC] || 0),
					ANraw: Number(m.info[aset.infokey_AN] || 0)
				})
			}
			// for a population group, if to adjust race
			let refcount = 0,
				altcount = 0
			if (g.adjust_race) {
				;[refcount, altcount] = AFtest_adjust_race(set2value, pop2average)
			} else {
				// not adjust race, add up AC AN
				for (const v of set2value.values()) {
					altcount += v.ACraw
					refcount += v.ANraw - v.ACraw
				}
			}
			groupData.push({
				altCount: altcount,
				refCount: refcount
			})
			continue
		}
		throw 'unknown group.type'
	}
	return groupData
}

function AFtest_adjust_race(set2value, pop2average) {
	let controltotal = 0
	for (const v of set2value.values()) {
		controltotal += v.ANraw
	}
	// adjust control population based on pop2average
	let ACadj = 0,
		ANadj = 0
	for (const [k, v] of set2value) {
		// record adjusted value per set for sending back to client
		v.ANadj = controltotal * pop2average.get(k).average
		v.ACadj = v.ANadj == 0 ? 0 : (v.ACraw * v.ANadj) / v.ANraw

		ACadj += v.ACadj
		ANadj += v.ANadj
	}
	return [ANadj - ACadj, ACadj]
}

/*
if applicable, do following computation to generate "pop2average" object, and attach to results{}
using adjust race, when combining a population and a termdb group
for the set of samples defined by termdb,
get population admix average, initiate 0 for each population
*/
async function mayGet_pop2average(ds, details, results) {
	const populationGroup = details.groups.find(g => g.type == 'population')
	if (!populationGroup) return
	if (!populationGroup.adjust_race) return
	const population = ds.queries.snvindel.populations.find(i => i.key == populationGroup.key)
	if (!population) throw 'invalid group.key for population'

	const sampleSet = new Set() // set of all samples from mlst[]
	for (const m of results.mlst) {
		for (const s of m.samples) sampleSet.add(s.sample_id)
	}

	const pop2average = new Map()
	let poptotal = 0 // sum for all sets, across all samples
	for (const p of population.sets) {
		const o = {
			infokey_AC: p.infokey_AC,
			infokey_AN: p.infokey_AN,
			average: 0
		}

		// for this race grp, issue one query to get percentage value of all samples, and sum up
		const lst = await get_rows_by_one_key({ ds, key: p.key })

		for (const i of lst) {
			if (!sampleSet.has(i.sample)) continue
			const v = Number(i.value)
			if (Number.isFinite(v)) {
				o.average += v
				poptotal += v
			}
		}

		pop2average.set(p.key, o)
	}
	// after sum, make average
	for (const [k, v] of pop2average) {
		v.average /= poptotal
	}

	// add average value per ancestry to results, to shown on control ui
	results.pop2average = {}
	for (const [k, v] of pop2average) results.pop2average[k] = v.average

	return pop2average
}

async function may_apply_fishertest(mlst) {
	// as fisher data is from stdin, limit the number of variants tested each time
	const step = 200
	for (let i = 0; i < Math.ceil(mlst.length / step); i++) {
		// for all m in this step, generate rust input
		const input = []
		for (let j = i * step; j < (i + 1) * step; j++) {
			const m = mlst[j]
			if (!m) break // reached the end

			const d = m.groupData
			if (
				!d ||
				!d[0] ||
				!d[1] ||
				!Number.isFinite(d[0].altCount) ||
				!Number.isFinite(d[0].refCount) ||
				!Number.isFinite(d[1].altCount) ||
				!Number.isFinite(d[1].refCount)
			) {
				// FIXME find out the cause
				console.log(`${m.chr}.${m.pos}.${m.ref}.${m.alt}\t${JSON.stringify(d)}`)
				continue
			}

			input.push({
				index: j,
				n1: Math.floor(d[0].altCount), // must convert to integer for fisher binary to work
				n2: Math.floor(d[0].refCount),
				n3: Math.floor(d[1].altCount),
				n4: Math.floor(d[1].refCount)
			})

			m.htmlSections = [
				{
					key: 'Contigency table',
					html: `<table style="font-size:.9em">
				<tr style="opacity:.5">
				  <td></td>
				  <td>Group1</td>
				  <td>Group 2</td>
				</tr>
				<tr>
				  <td style="opacity:.5">ALT allele count</td>
				  <td>${d[0].altCount}</td>
				  <td>${Math.floor(d[1].altCount)}</td>
				</tr>
				<tr>
				  <td style="opacity:.5">REF allele count</td>
				  <td>${d[0].refCount}</td>
				  <td>${Math.floor(d[1].refCount)}</td>
				</tr>
				<tr>
				  <td style="opacity:.5">Allele frequency</td>
				  <td>${(d[0].altCount / (d[0].altCount + d[0].refCount)).toFixed(3)}</td>
				  <td>${(d[1].altCount / (d[1].altCount + d[1].refCount)).toFixed(3)}</td>
				</tr>
				</table>`
				}
			]
		}

		// run rust
		const out = await run_rust('fisher', JSON.stringify({ input }))
		for (const test of JSON.parse(out)) {
			const m = mlst[test.index]
			if (!m) continue
			m.p_value = test.p_value.toPrecision(2) // for display
			// numericmode axis value is -log10(p), cannot compute for p=0
			if (test.p_value > 0) {
				m.nm_axis_value = Number((-Math.log10(test.p_value)).toPrecision(2))
			}
		}
	}

	// fill in nm value for 0 pvalue dots
	// get max nm_axis_value from those with non-0 pvalue
	let maxV = 0
	for (const m of mlst) {
		if (m.p_value > 0) maxV = Math.max(maxV, m.nm_axis_value)
	}
	for (const m of mlst) {
		// missing value due to 0 pvalue, assign numeric mode value as max
		if (m.p_value == 0) m.nm_axis_value = Math.max(50, maxV)
	}
}

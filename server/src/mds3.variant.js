const { filterJoin } = require('../shared/filter')
const { get_rows_by_one_key } = require('./termdb.sql')
const lines2R = require('./lines2R') // TODO rust
const path = require('path')
const serverconfig = require('./serverconfig')

/*

q{}
	.chr/start/stop
	.filter{}       -- bona fide filter obj
	.details{}

not integrated into mds3.load.js due to !!HARDCODED!! use of ds.queries.snvindel.byrange.get()
performs post-processing of data from byrange.get()
*/

export async function get_mds3variantData(q, res, ds, genome) {
	if (!q.chr) throw 'q.chr missing'
	q.start = Number(q.start)
	q.stop = Number(q.stop) // somehow q.stop can be string
	if (!Number.isInteger(q.start) || !Number.isInteger(q.stop)) throw 'q.start/stop is not integer'
	if (typeof q.details != 'object') throw 'q.details{} not object'

	const param = {
		rglst: [{ chr: q.chr, start: q.start, stop: q.stop }],
		filterObj: getFilterObj(q),
		addFormatValues: true // allows to add FORMAT including GT in each
	}
	const mlst = await ds.queries.snvindel.byrange.get(param)
	/*
	{
		chr/pos/class/dt/mname
		alt/ref
		info{}
		samples[]
			sample_id:int
			GT:'0/1'
	}
	*/

	const results = {}

	if (q.details.computeType == 'AF') {
		compute_AF(mlst, results)
	} else if (q.details.computeType == 'groups') {
		await compute_groups(ds, q.details, mlst, results)
	} else {
		throw 'unknown q.details.computeType'
	}

	res.send(results)
}

/*
merge filterObj from multiple sources to one (and use in byrange.get())
1. q.filter, mass global filter
2. q.details.groups[].type=='filter', when computeType=groups and one group is of type=filter
*/
function getFilterObj(q) {
	const lst = [q.filter]
	if (q.details.computeType == 'groups') {
		for (const g of q.details.groups) {
			if (g.type == 'filter') {
				lst.push(q.filter)
			}
		}
	}
	return filterJoin(lst)
}

function compute_AF(mlst, results) {
	// only keep variants with at least 1 alt allele
	results.mlst = []
	results.skipMcountWithoutAlt = 0 // number of excluded variants for not having a single alt alelle in the current cohort

	for (const m of mlst) {
		const [A, T] = getAllelicCount(m)
		if (A == 0) {
			results.skipMcountWithoutAlt++
			continue
		}
		results.mlst.push(m)
		m.AF = Number((A / T).toPrecision(2))
		delete m.samples
	}
}

function getAllelicCount(m) {
	// count all alleles and does not assume diploid, to allow it to work with chrY
	let A = 0,
		T = 0
	for (const s of m.samples) {
		if (!s.GT) continue
		// ds may configure to use '|' if it exists in vcf file
		const tmp = s.GT.split('/').map(Number)
		T += tmp.length
		for (const i of tmp) {
			if (i == m.altAlleleIdx) A++
		}
	}
	return [A, T]
}

async function compute_groups(ds, details, mlst, result) {
	const pop2average = mayGet_pop2average(ds, details, mlst) // undefined if not used

	for (const m of mlst) {
		m.groupData = getGroupsData(ds, details, m, pop2average)
	}

	// data from mlst is ready for testing
	const method = details.groupTestMethod.methods[details.groupTestMethod.methodIdx]
	if (!method) throw 'details.groupTestMethod.methodIdx out of bound'
	if (method == 'Allele frequency difference') {
		throw 11
		return
	}
	if (method == "Fisher's exact test") {
		await may_apply_fishertest(mlst)
	}
	throw 'unknown value from groupTestMethod[]'
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
			const [A, T] = getAllelicCount(m)
			groupData.push({ altCount: A, refCount: T - A })
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

function mayGet_pop2average(ds, details, mlst) {
	/*
using adjust race, when combining a population and a termdb group
for the set of samples defined by termdb,
get population admix average, initiate 0 for each population

popsets:
	.sets[] from the population

ds:
vcftk
FIXME should be list of samples from current query, not the complete set of samples from vcftk
*/

	const populationGroup = details.groups.find(g => g.type == 'population')
	if (!populationGroup) return
	if (!populationGroup.adjust_race) return
	const population = ds.queries.snvindel.populations.find(i => i.key == populationGroup.key)
	if (!population) throw 'invalid group.key for population'

	const sampleSet = new Set() // set of all samples from mlst[]
	for (const m of mlst) {
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
		const lst = get_rows_by_one_key({ ds, key: p.key })

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
	return pop2average
}

async function may_apply_fishertest(mlst) {
	const lines = []
	const str2m = new Map()
	for (const m of mlst) {
		const kstr = m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt
		lines.push(
			`${kstr}\t${m.groupData[0].altCount}\t${m.groupData[0].refCount}\t${m.groupData[1].altCount}\t${m.groupData[1].refCount}`
		)
		str2m.set(kstr, m)
	}
	if (lines.length == 0) {
		// no data
		return
	}
	const plines = await lines2R(path.join(serverconfig.binpath, '/utils/fisher.R'), lines)
	for (const line of plines) {
		const l = line.split('\t')
		const m = str2m.get(l[0])
		if (m) {
			const v = Number.parseFloat(l[5])
			m.AFtest_pvalue = v
			m.nm_axis_value = Number.isNaN(v) ? 0 : -Math.log10(v) // for axis
		}
	}
}

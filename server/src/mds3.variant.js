const { filterJoin } = require('../shared/filter')
const { get_rows_by_one_key } = require('./termdb.sql')
const lines2R = require('./lines2R') // TODO rust
const run_rust = require('@stjude/proteinpaint-rust').run_rust
const path = require('path')
const serverconfig = require('./serverconfig')

/*

q{}
	.chr/start/stop
	.filter{}       -- bona fide filter obj
	.details{}

not integrated into mds3.load.js due to !!HARDCODED!! use of ds.queries.snvindel.byrange.get()
performs post-processing of data from byrange.get()

get_mds3variantData
	getFilterObj
	byrange.get()
	getMlstWithAlt
		getAllelicCount
	compute_AF
	compute_groups
		mayGet_pop2average
		getGroupsData
			AFtest_adjust_race
		may_apply_fishertest
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

	const results = getMlstWithAlt(mlst)
	// results = {mlst[], skipMcountWithoutAlt}, and drop out m without any ALT

	if (q.details.computeType == 'AF') {
		compute_AF(results.mlst)
	} else if (q.details.computeType == 'groups') {
		await compute_groups(ds, q.details, results.mlst)
	} else {
		throw 'unknown q.details.computeType'
	}

	// result.mlst[].nm_axis_value is computed

	for (const m of results.mlst) {
		delete m.samples
		delete m._altCount
		delete m._refCount
	}

	res.send(results)
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

function compute_AF(mlst) {
	for (const m of mlst) {
		m.nm_axis_value = Number((m._altCount / (m._altCount + m._refCount)).toPrecision(2))
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

async function compute_groups(ds, details, mlst) {
	const pop2average = mayGet_pop2average(ds, details, mlst) // undefined if not used

	for (const m of mlst) {
		m.groupData = getGroupsData(ds, details, m, pop2average)
	}

	// data from mlst is ready for testing
	const method = details.groupTestMethod.methods[details.groupTestMethod.methodIdx]
	if (!method) throw 'details.groupTestMethod.methodIdx out of bound'
	if (method == 'Allele frequency difference') {
		throw 'AF diff not implemented'
	} else if (method == "Fisher's exact test") {
		await may_apply_fishertest(mlst)
	} else {
		throw 'unknown value from groupTestMethod[]'
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

function mayGet_pop2average(ds, details, mlst) {
	/*
using adjust race, when combining a population and a termdb group
for the set of samples defined by termdb,
get population admix average, initiate 0 for each population
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
	// as fisher data is from stdin, limit the number of variants tested each time
	const step = 200
	for (let i = 0; i < Math.ceil(mlst.length / step); i++) {
		const input = []
		for (let j = i * step; j < (i + 1) * step; j++) {
			const m = mlst[j]
			if (!m) break

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
				n1: d[0].altCount,
				n2: d[0].refCount,
				n3: Math.floor(d[1].altCount),
				n4: Math.floor(d[1].refCount)
			})
		}
		try {
			const out = await run_rust('fisher', JSON.stringify({ input }))
			for (const test of JSON.parse(out)) {
				const m = mlst[test.index]
				if (!m) continue
				m.p_value = test.p_value
				m.nm_axis_value = -Math.log10(test.p_value)
			}
		} catch (e) {
			console.log(JSON.stringify(input))
		}
	}
}

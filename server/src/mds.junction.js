import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'

/*
get all junctions in view range, make stats for:
- sample annotation

column 5 type is not used
splice events are annotated to both junctions and samples

****** filter attributes (added by addFilterToLoadParam)

.cohortHiddenAttr (for dropping sample by annotation)
.key
.value
.infoFilter  (for dropping junction by type or event type)
.type
contains:
	canonical
	exon skip / alt use
	a5ss, a3ss
	Unannotated
.spliceEventPercentage (for dropping sample by percentage cutoff of certain splice event types)
k: event.attrValue (event type code)
v: cutoff {side,value}

******* parameters
.genome
.dslabel, .querykey
.file, .url (same format as official track)
(second file format)
.rglst[]
.junction { chr, start, stop }
.readcountByjBsamples:true
.junctionB { chr, start, stop }
.junctionAposlst [ [start,stop], ... ]
.infoFilter

******* routes
* get details on specific junction
* get median read count for A junctions by the same set of samples of junction B (passing filters)

*/

// this hardcoded term is kept same with notAnnotatedLabel in block.tk.mdsjunction.render
const infoFilter_unannotated = 'Unannotated'

export function mdsjunction_request_closure(genomes) {
	return async (req, res) => {
		try {
			const [q, ds, dsquery, gn] = await get_q(req, genomes)
			const data = await do_query(q, ds, dsquery, gn)
			res.send(data)
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

async function get_q(req, genomes) {
	const q = req.query
	if (!q.genome) throw 'genome missing'
	const gn = genomes[q.genome]
	if (!gn) throw 'invalid genome'

	let ds = {},
		dsquery = {}

	if (q.iscustom) {
		// won't have q.dslabel and q.querykey, but still generate adhoc objects
		dsquery.listsamples = true // clicking single junction will list samples
		if (q.url) {
			dsquery.url = q.url
			dsquery.dir = await utils.cache_index(q.url, q.indexURL)
		} else {
			if (q.file) {
				dsquery.file = path.join(serverconfig.tpmasterdir, q.file)
			} else if (q.file2) {
				dsquery.file2 = path.join(serverconfig.tpmasterdir, q.file2)
			} else {
				throw 'no file or url given'
			}
		}
	} else {
		// official ds, still the track file would be url? the index already cached in the init()?
		if (!gn.datasets) throw 'genome is not equipped with datasets'
		if (!q.dslabel) throw 'dslabel missing'
		ds = gn.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		if (!ds.queries) throw 'dataset is not equipped with queries'
		if (!q.querykey) throw 'querykey missing'
		dsquery = ds.queries[q.querykey]
		if (!dsquery) throw 'invalid querykey'
	}
	return [q, ds, dsquery, gn]
}

async function do_query(q, ds, dsquery, gn) {
	if (q.junction) {
		// details about a clicked junction
		return await get_singlejunction(q, ds, dsquery)
	}
	if (q.readcountByjBsamples) {
		// get median read count for A junctions from the same set of samples as junctionB
		return await get_readcountByjBsamples(q, ds, dsquery)
	}

	///////////////// getting all junctions from view range

	// resulting data object to return to client
	const data = {}

	if (q.iscustom && q.getsamples) {
		// first time querying a custom track, get list of samples and keep on client, not on server
		const lines = await utils.get_header_tabix(getfile(dsquery), dsquery.dir)
		if (lines[0]) {
			// has header line
			const l = lines[0].split('\t')
			if (l.length > 5) {
				data.sample2client = l.slice(5)
			}
		}
	}

	utils.validateRglst(q, gn)

	if (dsquery.viewrangeupperlimit) {
		const len = q.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= dsquery.viewrangeupperlimit)
			throw 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view details'
	}

	let maxreadcount = 0 // from view range
	let junctiontotalnumber = 0 // total # of junctions from view range

	// junctions from all regions, return to client
	const junctions = []

	// for .sv, need to remove duplicate
	const svSet = new Set()
	// key: chr1.pos.chr2.pos, each sv registers two keys

	// collect all samples from view range, passing filters, for making annotation summary
	const allsampleidxset = new Set()

	for (const r of q.rglst) {
		await utils.get_lines_bigfile({
			args: [getfile(dsquery), r.chr + ':' + r.start + '-' + r.stop],
			dir: dsquery.dir,
			callback: line => {
				const l = line.split('\t')
				const start = Number.parseInt(l[1])
				const stop = Number.parseInt(l[2])

				if (dsquery.file2) {
					// matrix file made from rnapeg
					const strand = l[3]
					const thistype = l[4]
					// convert rnapeg "known/novel" to hardcoded types of this track
					let type
					if (thistype == 'known') {
						type = 'canonical'
					} else if (thistype == 'novel') {
						type = infoFilter_unannotated
					} else {
						throw 'unknown rnapeg type: ' + thistype
					}
					if (q.infoFilter && q.infoFilter.type) {
						// to filter by type
						if (q.infoFilter.type[type]) {
							// drop this junction
							return
						}
					}
					const j = {
						chr: r.chr,
						start,
						stop,
						info: {
							type: {
								// "type" is hardcoded
								lst: [{ attrValue: type }]
							}
						}
					}

					const samplecountlst = []
					for (let i = 5; i < l.length; i++) {
						const str = l[i]
						if (!str) continue
						const v = Number.parseInt(str)
						if (Number.isNaN(v)) continue
						if (v <= 0) continue
						// if needed, use i to match with sample from header
						samplecountlst.push({ readcount: v })
						maxreadcount = Math.max(maxreadcount, v)
					}
					if (samplecountlst.length == 0) {
						// no sample, don't include junction
						return
					}
					junctiontotalnumber++
					j.sampleCount = samplecountlst.length
					if (j.sampleCount == 1) {
						j.medianReadCount = samplecountlst[0].readcount
					} else {
						const p = get_percentile_readcount(samplecountlst, 0.05, 0.25, 0.5, 0.75, 0.95)
						j.medianReadCount = p[2]
						j.readcountBoxplot = {
							percentile: p
						}
					}
					junctions.push(j)
				} else {
					// json format
					const strand = l[3]
					const thistype = l[4] // not used!!

					// only use those with either start/stop in region
					if (!(start >= r.start && start <= r.stop) && !(stop >= r.start && stop <= r.stop)) {
						// both ends not in view range, only use those with either start/stop in view
						return
					}

					junctiontotalnumber++

					/*
						info.type is hardcoded
						*/
					const j = {
						chr: r.chr,
						start: start,
						stop: stop,
						info: {
							type: {
								// "type" is hardcoded
								lst: []
							}
						}
					}

					const jd = JSON.parse(l[5])

					if (jd.sv) {
						// is sv, copy over business end
						j.sv = jd.sv
						const key = j.chr + '.' + j.start + '.' + j.sv.mate.chr + '.' + j.sv.mate.start
						if (svSet.has(key)) {
							// a sv with exact same coord has been loaded
							return
						}
						// register this sv
						svSet.add(key)
						svSet.add(j.sv.mate.chr + '.' + j.sv.mate.start + '.' + j.chr + '.' + j.start)
					}

					if (jd.canonical) {
						// label of canonical is hardcoded
						j.info.type.lst.push({ attrValue: 'canonical' })
					}

					if (jd.events) {
						// this junction has events
						for (const ek in jd.events) {
							const e = jd.events[ek]
							e.__ek = ek
							j.info.type.lst.push(e)
						}
					} else if (!jd.canonical) {
						// no splice events, and not canonical, then it's unannotated
						j.info.type.lst.push({ attrValue: infoFilter_unannotated })
					}

					// info.type is ready for this junction
					if (q.infoFilter && q.infoFilter.type) {
						// some types will be dropped
						for (const t of j.info.type.lst) {
							if (q.infoFilter.type[t.attrValue]) {
								// drop this event
								return
							}
						}
					}

					const passfiltersamples = filtersamples4onejunction(jd, q, ds, dsquery)

					if (passfiltersamples.length == 0) {
						// this junction has no sample passing filter
						return
					}

					// this junction is acceptable

					if (
						jd.exonleft ||
						jd.exonright ||
						jd.exonleftin ||
						jd.exonrightin ||
						jd.intronleft ||
						jd.intronright ||
						jd.leftout ||
						jd.rightout
					) {
						j.ongene = {}
						if (jd.exonleft) j.ongene.exonleft = jd.exonleft
						if (jd.exonright) j.ongene.exonright = jd.exonright
						if (jd.exonleftin) j.ongene.exonleftin = jd.exonleftin
						if (jd.exonrightin) j.ongene.exonrightin = jd.exonrightin
						if (jd.intronleft) j.ongene.intronleft = jd.intronleft
						if (jd.intronright) j.ongene.intronright = jd.intronright
						if (jd.leftout) j.ongene.leftout = jd.leftout
						if (jd.rightout) j.ongene.rightout = jd.rightout
					}

					passfiltersamples.forEach(sample => {
						allsampleidxset.add(sample.i)
						maxreadcount = Math.max(maxreadcount, sample.readcount)
					})

					// for all samples passing filter
					j.sampleCount = passfiltersamples.length
					if (j.sampleCount == 1) {
						j.medianReadCount = passfiltersamples[0].readcount
					} else {
						const p = get_percentile_readcount(passfiltersamples, 0.05, 0.25, 0.5, 0.75, 0.95)
						j.medianReadCount = p[2]
						j.readcountBoxplot = {
							// for making mouseover boxplot
							percentile: p
						}
					}

					junctions.push(j)
				}
			}
		})
	}

	data.lst = junctions
	data.maxreadcount = maxreadcount
	data.junctiontotalnumber = junctiontotalnumber

	if (allsampleidxset.size) {
		/* follow code is about settings in official ds and is disabled

		data.samplecount = allsampleidxset.size
		if (dsquery.samples) {
			const samplenames = []
			for (const i of allsampleidxset) {
				if (dsquery.samples[i]) samplenames.push(dsquery.samples[i])
			}
			const [attributeSummary, hierarchySummary] = mds_tkquery_samplesummary(ds, dsquery, samplenames)
			if (attributeSummary) {
				// for each category, convert sampleset to count
				for (const attr of attributeSummary) {
					for (const v of attr.values) {
						v.count = v.sampleset.size
						delete v.sampleset
					}
				}
				result.attributeSummary = attributeSummary
			}
			if (hierarchySummary) {
				for (const k in hierarchySummary) {
					for (const n of hierarchySummary[k]) {
						if (n.sampleset) {
							n.count = n.sampleset.size
							delete n.sampleset
						} else {
							// root node won't have sampleset
						}
					}
				}
				result.hierarchySummary = hierarchySummary
			}
		}
		*/
	}
	return data
}

function getfile(dsquery) {
	return dsquery.file ? dsquery.file : dsquery.file2 ? dsquery.file2 : dsquery.url
}

async function get_singlejunction(q, ds, dsquery) {
	const j = q.junction

	if (!j.chr || !Number.isInteger(j.start) || !Number.isInteger(j.stop))
		throw 'incomplete/invalid info about querying junction'

	let samples // list of samples with this junction

	await utils.get_lines_bigfile({
		args: [getfile(dsquery), j.chr + ':' + j.start + '-' + j.stop],
		dir: dsquery.dir,
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			if (start != j.start || stop != j.stop) return
			// found the junction, parse samples
			if (dsquery.file2) {
				samples = []
				for (let i = 5; i < l.length; i++) {
					const str = l[i]
					if (!str) continue
					const v = Number.parseInt(str)
					if (Number.isNaN(v)) continue
					if (v <= 0) continue
					samples.push({
						i: i - 5, // sample.i follows the same json key structure as {i, readcount, events, anno}
						readcount: v
					})
				}
			} else {
				const jd = JSON.parse(l[5])
				samples = filtersamples4onejunction(jd, q, ds, dsquery)
			}
		}
	})

	if (samples.length == 0) throw 'no sample passing filters'

	const data = {} // return to client

	if (dsquery.listsamples) {
		// hardcoded logic to list up to 100 samples by descending order of read count
		const lst = samples.map(i => {
			const j = { readcount: i.readcount }
			if (i.anno) {
				j.sample_name = i.anno.sample_name
			} else {
				j.i = i.i
			}
			return j
		})
		lst.sort((i, j) => j.readcount - i.readcount)
		if (lst.length > 100) {
			data.samples = lst.slice(0, 100)
			data.sampletotalnumber = lst.length
		} else {
			data.samples = lst
		}
	} else if (dsquery.singlejunctionsummary) {
		// different ways to summarize this junction
		if (dsquery.singlejunctionsummary.readcountboxplotpercohort) {
			data.readcountboxplotpercohort = []

			for (const grp of dsquery.singlejunctionsummary.readcountboxplotpercohort.groups) {
				const value2sample = new Map()
				for (const sample of samples) {
					if (!sample.anno) {
						// no annotation for this sample (appended by filtersamples4onejunction)
						continue
					}
					// categorical attributes only
					const attrvalue = sample.anno[grp.key]
					if (attrvalue == undefined) continue
					if (!value2sample.has(attrvalue)) {
						value2sample.set(attrvalue, [])
					}
					value2sample.get(attrvalue).push(sample)
				}
				if (value2sample.size == 0) {
					// no value for this group
					continue
				}
				const lst = [...value2sample].sort((i, j) => j[1].length - i[1].length)
				const boxplots = []
				for (const [attrvalue, thissamplelst] of lst) {
					let minv = thissamplelst[0].readcount
					let maxv = minv
					thissamplelst.forEach(s => {
						minv = Math.min(minv, s.readcount)
						maxv = Math.max(maxv, s.readcount)
					})

					const p = get_percentile_readcount(thissamplelst, 0.05, 0.25, 0.5, 0.75, 0.95)
					boxplots.push({
						label: attrvalue,
						samplecount: thissamplelst.length,
						percentile: { p05: p[0], p25: p[1], p50: p[2], p75: p[3], p95: p[4] },
						minvalue: minv,
						maxvalue: maxv
					})
				}
				data.readcountboxplotpercohort.push({
					label: grp.label,
					boxplots: boxplots
				})
			}
		}
	}
	return data
}

async function get_readcountByjBsamples(q, ds, dsquery) {
	/* get median read count for A junctions by the same set of samples of junction B

    A & B share chr, get max start/stop range to make 1 single query
    */
	if (!q.junctionAposlst) throw '.junctionAposlst[] missing'
	let start = q.junctionB.start
	let stop = q.junctionB.stop
	q.junctionAposlst.forEach(i => {
		// [start, stop]
		start = Math.min(start, i[0])
		stop = Math.max(stop, i[1])
	})

	let jB // data of junctionB
	let jAlst = []
	await utils.get_lines_bigfile({
		args: [dsquery.file || dsquery.url, q.junctionB.chr + ':' + start + '-' + stop],
		dir: dsquery.dir,
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			if (start == q.junctionB.start && stop == q.junctionB.stop) {
				jB = JSON.parse(l[5])
			} else {
				for (const [a, b] of q.junctionAposlst) {
					if (a == start && b == stop) {
						const j = JSON.parse(l[5])
						j.start = start
						j.stop = stop
						jAlst.push(j)
						break
					}
				}
			}
		}
	})
	if (!jB) throw 'jB not found'
	if (jAlst.length == 0) throw 'none of jA is found'

	const jBsamples = filtersamples4onejunction(jB, q, ds, dsquery)
	if (jBsamples.length == 0) throw 'no sample passing filters for junctionB'

	const bidxset = new Set()
	jBsamples.forEach(s => bidxset.add(s.i))

	const lst = []
	for (const jA of jAlst) {
		/*
		.start
		.stop
		.samples[]
		*/
		const jAsamples = []
		// samples for this A junction passing filter
		// should generally match with jBsamples, but still could be dropped by read count cutoff
		for (const sample of jA.samples) {
			if (!bidxset.has(sample.i)) {
				// this sample from junction A does not show in junction B samples
				continue
			}
			if (q.readcountCutoff && sample.readcount < q.readcountCutoff) {
				continue
			}
			jAsamples.push(sample)
		}
		lst.push({
			start: jA.start,
			stop: jA.stop,
			v: Math.floor(get_percentile_readcount(jAsamples, 0.5))
		})
	}
	return { lst }
}

function filtersamples4onejunction(jd, q, ds, dsquery) {
	/*
    jd:
    	.events{}
    	.samples[]

    for one mds junction, get its samples passing filters
    - sample annotation
    - event percentage cutoff

    for each sample, append .anno if it has annotation
    */
	const passfiltersamples = [] // for this junction, all samples passing filters

	for (const sample of jd.samples) {
		if (!Number.isFinite(sample.readcount)) {
			// should not happen
			continue
		}

		sample.readcount = Math.floor(sample.readcount) // round

		if (sample.readcount <= 0) {
			continue
		}

		if (q.readcountCutoff && sample.readcount < q.readcountCutoff) {
			continue
		}

		if (dsquery.samples && ds.cohort && ds.cohort.annotation) {
			const samplename = dsquery.samples[sample.i]
			if (!samplename) {
				// has no valid sample name??
				continue
			}
			const anno = ds.cohort.annotation[samplename]
			sample.anno = anno // attach it for use by handle_mdsjunction_singlejunction

			if (q.cohortOnlyAttr && ds.cohort && ds.cohort.annotation) {
				/*
                from subtrack, will only use samples for one attribute (from hierarchies)
                cannot refer ds.cohort.attributes
                */
				if (!anno) {
					continue
				}
				let keep = false // if match with any in cohortOnlyAttr, will keep the sample
				for (const attrkey in q.cohortOnlyAttr) {
					const value = anno[attrkey]
					if (value && q.cohortOnlyAttr[attrkey][value]) {
						keep = true
						break
					}
				}
				if (!keep) {
					continue
				}
			}

			if (q.cohortHiddenAttr && ds.cohort && ds.cohort.annotation && ds.cohort.attributes) {
				// applying sample annotation filtering

				if (!anno) {
					// this sample has no annotation at all, since it's doing filtering, will drop it
					continue
				}

				let hidden = false

				for (const attrkey in q.cohortHiddenAttr) {
					// this attribute in registry, so to be able to tell if it's numeric
					const attr = ds.cohort.attributes.lst.find(i => i.key == attrkey)

					if (attr.isNumeric) {
						//continue
					}

					// categorical
					const value = anno[attrkey]
					if (value) {
						// this sample has annotation for this attrkey
						if (q.cohortHiddenAttr[attrkey][value]) {
							hidden = true
							break
						}
					} else {
						// this sample has no value for attrkey
						if (q.cohortHiddenAttr[attrkey][infoFilter_unannotated]) {
							// to drop unannotated ones
							hidden = true
							break
						}
					}
				}
				if (hidden) {
					// this sample has a hidden value for an attribute, skip
					continue
				}
			}
		}

		if (sample.events && q.spliceEventPercentage) {
			// this sample has events and told to apply event percentage filter, see if event type matches
			let hidden = false
			for (const ek in sample.events) {
				// use eventkey to check with jd.events
				if (!jd.events[ek]) continue
				const eventtype = jd.events[ek].attrValue
				const cutoff = q.spliceEventPercentage[eventtype]
				if (!cutoff) {
					// this type of event is not under filtering
					continue
				}
				const samplepercentage = sample.events[ek].percentage
				if (samplepercentage == undefined) continue
				if (cutoff.side == '>') {
					if (samplepercentage <= cutoff.value) {
						hidden = true
						break
					}
				} else {
					if (samplepercentage >= cutoff.value) {
						hidden = true
						break
					}
				}
			}
			if (hidden) {
				// this sample has an event not passing percentage cutoff
				continue
			}
		}
		passfiltersamples.push(sample)
	}
	return passfiltersamples
}

function get_percentile_readcount(lst, ...percents) {
	if (lst.length == 0) {
		// no samples
		return 0
	}
	const arr = lst.sort((i, j) => i.readcount - j.readcount)
	const result = []
	percents.forEach(perc => {
		if (!Number.isFinite(perc) || perc < 0 || perc > 1) {
			result.push(null)
			return
		}
		result.push(arr[Math.floor(arr.length * perc)].readcount)
	})
	//console.log(result[0], '::',lst.join(' '))
	return result
}

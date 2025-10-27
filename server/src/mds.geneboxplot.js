import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'

/*
2nd-gen epaint
for one gene, over entire cohort

default:
divide into groups by L1/L2 hierarchy levels
	for each group, divid into subgroups by sv/cnv/loh status
		one boxplot for each subgroup
		boxplot will be generated solely on numeric value
		the expression status (ase, outlier) will be ignored


.gene str
.chr/start/stop
.dslabel
.querykey
.iscustom
.file
.url
.sampleset[ {name, samples[]} ]
	may be provided by custom dataset
.getalllst
	called by clicking FPKM button, or for custom dataset with no group
	if set, collect exp values from all samples into a group and return.
	no further group dividing
	no boxplot is made
	backend dataset config may reject the request to protect data
	returned data on samples will include following for rendering:
		overlapping sv/cnv/loh
		ase, outlier status
.getgroup[ {} ]
	list of attributes
	if provided, will get actual list of samples with gene value based on filter
	called by clicking a group in boxplot panel
	.k
	.kvalue
.getgroup2boxplot
	modifier of .getgroup; to yield a boxplot rather than list of exp values
	only used for fimo panel
*/

export default genomes => {
	return async (req, res) => {
		try {
			const [gn, ds, dsquery, svcnv] = get_param(genomes, req)

			if (req.query.getalllst) {
				// to get expression data for all samples but not boxplots
				// may be denied based on server dataset config
			}

			res.send(await do_query(gn, ds, dsquery, svcnv, req))
		} catch (e) {
			if (e.stack) console.log(e)
			res.send({ error: e.message || e })
		}
	}
}

async function do_query(gn, ds, dsquery, svcnv, req) {
	if (dsquery.url) {
		dsquery.dir = await utils.cache_index(dsquery.url, dsquery.indexURL)
	}

	if (svcnv && svcnv.dsquery.url) {
		svcnv.dsquery.dir = await utils.cache_index(svcnv.dsquery.url, svcnv.dsquery.indexURL)
	}

	const sample2sampleset = may_get_sampleset(req)
	// key: sample
	// value: name of set
	// if sample is not included in any set, it will be missing from the map

	const key2samplegroup = new Map()
	/*
	k: "BT, HGG"
	v: {}
	   levelkey
	   levelvalue
	   samples []
	*/

	/* use following when making boxplot for official dataset
	store those samples without annotation to be shown as separate group
	also as a holder for getalllst
	*/
	const nogroupvalues = []

	// collect data from .getgroup
	const getgroupdata = []

	await utils.get_lines_bigfile({
		args: [
			dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
			req.query.chr + ':' + req.query.start + '-' + req.query.stop
		],
		dir: dsquery.dir,
		callback: line => {
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			if (!j.gene) return
			if (j.gene != req.query.gene) return
			if (!Number.isFinite(j.value)) return
			if (req.query.getalllst) {
				nogroupvalues.push({ sample: j.sample, value: j.value }) // hardcoded key
				return
			}

			if (req.query.getgroup) {
				if (!j.sample) return

				if (sample2sampleset) {
					// using sample set
					if (req.query.getgroup_unannotated) {
						if (!sample2sampleset.has(j.sample)) {
							getgroupdata.push(j)
						}
					} else {
						if (sample2sampleset.get(j.sample) == req.query.getgroup[0].full) {
							getgroupdata.push(j)
						}
					}
					return
				}

				// using ds.cohort.annotation
				const sanno = ds.cohort.annotation[j.sample]

				if (req.query.getgroup_unannotated) {
					/* in case of getting samples without annotation,
					could be that the sample is not in sampletable at all
					or it lacks annotation for the given term
					*/
					if (!sanno) {
						getgroupdata.push(j)
						return
					}
					for (const a of dsquery.boxplotbysamplegroup.attributes) {
						if (sanno[a.k] == undefined) {
							getgroupdata.push(j)
							return
						}
					}
					return
				}

				// find sample matching with specified annotation
				if (!sanno) return
				for (const a of req.query.getgroup) {
					if (a.kvalue != sanno[a.k]) {
						return
					}
				}
				getgroupdata.push(j)
				return
			}

			if (dsquery.boxplotbysamplegroup && ds.cohort && ds.cohort.annotation) {
				if (!j.sample) {
					// missing sample
					return
				}

				// quick fix!!!
				let attributes // which attributes to use
				if (req.query.index_boxplotgroupers == undefined || req.query.index_boxplotgroupers == 0) {
					attributes = dsquery.boxplotbysamplegroup.attributes
				} else {
					// using one of additional
					attributes = dsquery.boxplotbysamplegroup.additionals[req.query.index_boxplotgroupers - 1].attributes
				}

				// same grouping procedure as svcnv

				const sanno = ds.cohort.annotation[j.sample]
				if (!sanno) {
					nogroupvalues.push({ sample: j.sample, value: j.value }) // hardcoded key
					return
				}

				const headname = sanno[attributes[0].k]
				if (headname == undefined) {
					nogroupvalues.push({ sample: j.sample, value: j.value }) // hardcoded key
					return
				}

				const names = []
				for (let i = 1; i < attributes.length; i++) {
					const v = sanno[attributes[i].k]
					if (v == undefined) {
						break
					}
					names.push(v)
				}

				names.unshift(headname)

				const groupkey = names.join(', ') // spacer is for display only

				if (!key2samplegroup.has(groupkey)) {
					const g = {
						samples: [],
						attributes: []
					}
					for (const a of attributes) {
						const v = sanno[a.k]
						if (v == undefined) break
						const a2 = { k: a.k, kvalue: v }
						if (a.full) {
							a2.full = a.full
							a2.fullvalue = sanno[a.full]
						}
						g.attributes.push(a2)
					}

					key2samplegroup.set(groupkey, g)
				}
				key2samplegroup.get(groupkey).samples.push({
					sample: j.sample,
					value: j.value
				})
			} else if (sample2sampleset) {
				if (!j.sample) {
					// missing sample
					return
				}
				const key = sample2sampleset.get(j.sample)
				if (!key) {
					nogroupvalues.push({ sample: j.sample, value: j.value })
					return
				}
				if (!key2samplegroup.has(key)) {
					key2samplegroup.set(key, {
						samples: [],
						attributes: [{ full: key }]
					})
				}
				key2samplegroup.get(key).samples.push({ sample: j.sample, value: j.value })
			} else {
				nogroupvalues.push({
					sample: j.sample,
					value: j.value
				})
			}
		}
	})

	if (req.query.getgroup2boxplot) {
		getgroupdata.sort((i, j) => i.value - j.value)
		const { w1, w2, p25, p50, p75, out } = utils.boxplot_getvalue(getgroupdata)
		return {
			n: getgroupdata.length,
			min: getgroupdata[0].value,
			max: getgroupdata[getgroupdata.length - 1].value,
			w1,
			w2,
			p25,
			p50,
			p75,
			out
		}
	}

	const groups = []
	for (const [n, o] of key2samplegroup) {
		groups.push({
			name: n,
			values: o.samples,
			attributes: o.attributes
		})
	}

	if (nogroupvalues.length) {
		groups.push({
			name: 'Unannotated',
			values: nogroupvalues
		})
	}

	if (getgroupdata.length) {
		groups.push({
			values: getgroupdata
		})
	}

	if (req.query.getalllst) {
		return { lst: groups[0].values }
	}

	if ((req.query.iscustom && !sample2sampleset) || groups.length == 1) {
		// a custom track
		if (groups[0]) {
			const l = groups[0].values
			l.sort((i, j) => j.value - i.value)
			return { lst: l, max: l[0].value, min: l[l.length - 1].value }
		}
		// XXX why groups.length=1 when groups[0] is undefined
		return { nodata: 1 }
	}

	// sv/cnv events for the samples, for stratifying gene exp groups
	// may be missing
	const sample2event = await may_get_sample2event(req, svcnv)

	if (req.query.getgroup) {
		// return samples for a single group
		if (groups[0]) {
			const lst = groups[0].values
			lst.sort((i, j) => j.value - i.value)

			if (sample2event) {
				for (const i of lst) {
					const o = sample2event.get(i.sample)
					if (o) {
						for (const k in o) {
							i[k] = o[k]
						}
					}
				}
			}
			return { lst: lst, max: lst[0].value, min: lst[lst.length - 1].value }
		}
		return { nodata: 1 }
	}

	//////////// make boxplot for each group

	const grouplst = []
	let min = null,
		max = null
	for (const group of groups) {
		group.values.sort((i, j) => i.value - j.value)
		const l = group.values.length
		if (min == null) {
			min = group.values[0].value
			max = group.values[l - 1].value
		} else {
			min = Math.min(min, group.values[0].value)
			max = Math.max(max, group.values[l - 1].value)
		}

		const { w1, w2, p25, p50, p75, out } = utils.boxplot_getvalue(group.values)

		const boxplots = [{ isall: 1, w1: w1, w2: w2, p25: p25, p50: p50, p75: p75, out: out }]

		if (sample2event) {
			if (req.query.svcnv.usegain) {
				const lst = group.values.filter(i => sample2event.has(i.sample) && sample2event.get(i.sample).gain)
				if (lst.length) {
					const { w1, w2, p25, p50, p75, out } = utils.boxplot_getvalue(lst)
					boxplots.push({
						iscnvgain: 1,
						samplecount: lst.length,
						w1: w1,
						w2: w2,
						p25: p25,
						p50: p50,
						p75: p75,
						out: out
					})
				}
			}
			if (req.query.svcnv.useloss) {
				const lst = group.values.filter(i => sample2event.has(i.sample) && sample2event.get(i.sample).loss)
				if (lst.length) {
					const { w1, w2, p25, p50, p75, out } = utils.boxplot_getvalue(lst)
					boxplots.push({
						iscnvloss: 1,
						samplecount: lst.length,
						w1: w1,
						w2: w2,
						p25: p25,
						p50: p50,
						p75: p75,
						out: out
					})
				}
			}
			if (req.query.svcnv.usesv) {
				const lst = group.values.filter(i => sample2event.has(i.sample) && sample2event.get(i.sample).sv)
				if (lst.length) {
					const { w1, w2, p25, p50, p75, out } = utils.boxplot_getvalue(lst)
					boxplots.push({
						issv: 1,
						samplecount: lst.length,
						w1: w1,
						w2: w2,
						p25: p25,
						p50: p50,
						p75: p75,
						out: out
					})
				}
			}
		}

		grouplst.push({
			name: group.name + ' (' + group.values.length + ')',
			boxplots: boxplots,
			attributes: group.attributes
		})
	}
	grouplst.sort((i, j) => {
		if (i.name < j.name) return -1
		if (i.name > j.name) return 1
		return 0
	})
	return { groups: grouplst, min: min, max: max }
}

async function may_get_sample2event(req, svcnv) {
	if (!svcnv || (!req.query.svcnv.useloss && !req.query.svcnv.usegain && !req.query.svcnv.usesv)) {
		// not asked to do it
		return
	}

	let start = req.query.start
	let stop = req.query.stop
	if (req.query.svcnv.usesv && Number.isInteger(req.query.svcnv.svflank)) {
		start = Math.max(0, start - req.query.svcnv.svflank)
		stop = stop + req.query.svcnv.svflank
	}

	// TODO cnv flanking

	const sample2event = new Map()
	await utils.get_lines_bigfile({
		args: [
			svcnv.dsquery.file ? path.join(serverconfig.tpmasterdir, svcnv.dsquery.file) : svcnv.dsquery.url,
			req.query.chr + ':' + start + '-' + stop
		],
		dir: svcnv.dsquery.dir,
		callback: line => {
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			if (!j.sample) return

			if (j.chrA || j.chrB) {
				// sv
				if (!req.query.svcnv.usesv) return

				if (!sample2event.has(j.sample)) sample2event.set(j.sample, {})
				sample2event.get(j.sample).sv = 1
			} else {
				// cnv
				if (!req.query.svcnv.usegain && !req.query.svcnv.useloss) return

				if (req.query.svcnv.usesv && req.query.svcnv.svflank) {
					const start = Number.parseInt(l[1])
					const stop = Number.parseInt(l[2])
					if (Math.max(req.query.start, start) > Math.min(req.query.stop, stop)) return
				}

				if (!Number.isFinite(j.value)) return
				if (!req.query.svcnv.usegain && j.value > 0) return
				if (!req.query.svcnv.useloss && j.value < 0) return
				if (req.query.svcnv.valueCutoff) {
					if (Math.abs(j.value) < req.query.svcnv.valueCutoff) return
				}

				if (req.query.svcnv.bplengthUpperLimit) {
					if (Number.parseInt(l[2]) - Number.parseInt(l[1]) > req.query.svcnv.bplengthUpperLimit) return
				}

				if (!sample2event.has(j.sample)) sample2event.set(j.sample, {})
				if (j.value > 0) {
					sample2event.get(j.sample).gain = 1
				} else if (j.value < 0) {
					sample2event.get(j.sample).loss = 1
				}
			}
		}
	})
	return sample2event
}

function get_param(genomes, req) {
	if (!req.query.gene) throw 'gene name missing'
	if (!req.query.chr) throw 'chr missing'
	if (!Number.isInteger(req.query.start)) throw 'start missing'
	if (!Number.isInteger(req.query.stop)) throw 'stop missing'

	const gn = genomes[req.query.genome]
	if (!gn) throw 'invalid genome'

	let ds, dsquery
	if (req.query.iscustom) {
		if (!req.query.file && !req.query.url) throw 'no file or url for expression data'
		ds = {}
		dsquery = {
			file: req.query.file,
			url: req.query.url,
			indexURL: req.query.indexURL
		}
	} else {
		if (!gn.datasets) throw 'genome is not equipped with datasets'
		if (!req.query.dslabel) throw 'dslabel missing'
		ds = gn.datasets[req.query.dslabel]
		if (!ds) throw 'invalid dslabel'
		if (!ds.queries) throw 'dataset is not equipped with queries'
		if (!req.query.querykey) throw 'querykey missing'
		dsquery = ds.queries[req.query.querykey]
		if (!dsquery) throw 'invalid querykey'
	}

	let svcnv
	if (req.query.svcnv) {
		svcnv = {}
		if (req.query.iscustom) {
			svcnv.dsquery = {
				file: req.query.svcnv.file,
				url: req.query.svcnv.url,
				indexURL: req.query.svcnv.indexURL
			}
		} else {
			req.query.svcnv.genome = req.query.genome
			const ds = gn.datasets[req.query.svcnv.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries) throw 'dataset is not equipped with queries'
			if (!req.query.svcnv.querykey) throw 'querykey missing'
			const dsquery = ds.queries[req.query.svcnv.querykey]
			if (!dsquery) throw 'invalid querykey'
			svcnv.ds = ds
			svcnv.dsquery = dsquery
		}
	}

	if (req.query.getgroup) {
		// getting sample data for a group, no making boxplot
		if (req.query.sampleset) {
		} else {
			// using ds.cohort
			if (!ds.cohort || !ds.cohort.annotation) throw 'no sample annotation for getting group'
			if (req.query.getgroup_unannotated) {
				// find unannotated samples
				if (!dsquery.boxplotbysamplegroup) throw 'dsquery.boxplotbysamplegroup{} missing when getgroup_unannotated'
			} else {
				// find annotated samples
				// getgroup value is same as attributes[]
				if (!Array.isArray(req.query.getgroup)) throw 'getgroup should be array'
				for (const a of req.query.getgroup) {
					if (!a.k) throw 'k missing from one of getgroup'
					if (!a.kvalue) throw 'kvalue missing from one of getgroup'
				}
			}
		}
	}
	return [gn, ds, dsquery, svcnv]
}

function may_get_sampleset(req) {
	if (!req.query.sampleset) return
	const sample2sampleset = new Map()
	for (const s of req.query.sampleset) {
		for (const n of s.samples) {
			sample2sampleset.set(n, s.name)
		}
	}
	return sample2sampleset
}

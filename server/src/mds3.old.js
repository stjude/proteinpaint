function validate_sampleSummaries2(ds) {
	const ss = ds.sampleSummaries2
	if (!ss) return
	if (!ds.termdb) throw 'ds.termdb missing while sampleSummary2 is in use'
	if (!ss.lst) throw '.lst missing from sampleSummaries2'
	if (!Array.isArray(ss.lst)) throw '.lst is not array from sampleSummaries2'
	for (const i of ss.lst) {
		if (!i.label1) throw '.label1 from one of sampleSummaries2.lst'
		if (!ds.cohort.termdb.q.termjsonByOneid(i.label1)) throw 'no term match with .label1: ' + i.label1
		if (i.label2) {
			if (!ds.cohort.termdb.q.termjsonByOneid(i.label2)) throw 'no term match with .label2: ' + i.label2
		}
	}
	if (!ss.get_number) throw '.get_number{} missing from sampleSummaries2'
	if (ss.get_number.gdcapi) {
		gdc.validate_sampleSummaries2_number(ss.get_number)
	} else {
		throw 'unknown query method for sampleSummaries2.get_number'
	}
	if (!ss.get_mclassdetail) throw '.get_mclassdetail{} missing from sampleSummaries2'
	if (ss.get_mclassdetail.gdcapi) {
		gdc.validate_sampleSummaries2_mclassdetail(ss.get_mclassdetail, ds)
	} else {
		throw 'unknown query method for sampleSummaries2.get_mclassdetail'
	}
}

function validate_sampleSummaries(ds) {
	const ss = ds.sampleSummaries
	if (!ss) return

	if (!ds.termdb) throw 'ds.termdb missing while sampleSummary is in use'
	if (!ss.lst) throw '.lst missing from sampleSummaries'
	if (!Array.isArray(ss.lst)) throw '.lst is not array from sampleSummaries'
	for (const i of ss.lst) {
		if (!i.label1) throw '.label1 from one of sampleSummaries.lst'
		if (!ds.cohort.termdb.q.termjsonByOneid(i.label1)) throw 'no term match with .label1: ' + i.label1
		if (i.label2) {
			if (!ds.cohort.termdb.q.termjsonByOneid(i.label2)) throw 'no term match with .label2: ' + i.label2
		}
	}
	ss.makeholder = opts => {
		const labels = new Map()
		/*
		k: label1 of .lst[]
		v: Map
		   k: label1 value
		   v: {}
			  .sampleset: Set of sample_id
		      .mclasses: Map
		         k: mclass
			     v: Set of sample id
		      .label2: Map
		         k: label2 value
			     v: {}
				    .sampleset: Set of sample id
					.mclasses: Map
			           k: mclass
				       v: Set of sample_id
		*/
		for (const i of ss.lst) {
			labels.set(i.label1, new Map())
		}
		return labels
	}
	ss.summarize = (labels, opts, datalst) => {
		// each element in datalst represent raw result from one of ds.queries{}
		// as there can be variable number of queries, the datalst[] is variable
		for (const mlst of datalst) {
			for (const m of mlst) {
				if (!m.samples) continue
				for (const sample of m.samples) {
					if (sample.sample_id == undefined) continue
					for (const i of ss.lst) {
						const v1 = sample[i.label1]
						if (v1 == undefined) continue
						const L1 = labels.get(i.label1)
						if (!L1.has(v1)) {
							const o = {
								mclasses: new Map(),
								sampleset: new Set()
							}
							if (i.label2) {
								o.label2 = new Map()
							}
							L1.set(v1, o)
						}
						L1.get(v1).sampleset.add(sample.sample_id)
						if (!L1.get(v1).mclasses.has(m.class)) L1.get(v1).mclasses.set(m.class, new Set())
						L1.get(v1)
							.mclasses.get(m.class)
							.add(sample.sample_id)
						if (i.label2) {
							const v2 = sample[i.label2]
							if (v2 == undefined) continue
							if (!L1.get(v1).label2.has(v2)) L1.get(v1).label2.set(v2, { mclasses: new Map(), sampleset: new Set() })
							const L2 = L1.get(v1).label2.get(v2)
							L2.sampleset.add(sample.sample_id)
							if (!L2.mclasses.has(m.class)) L2.mclasses.set(m.class, new Set())
							L2.mclasses.get(m.class).add(sample.sample_id)
						}
					}
				}
			}
		}
	}
	ss.finalize = async (labels, opts) => {
		// convert one "labels" map to list
		const out = []
		for (const [label1, L1] of labels) {
			let combinations
			if (ds.termdb.termid2totalsize) {
				const lev = ss.lst.find(i => i.label1 == label1)
				if (lev) {
					// should always be found
					const terms = [lev.label1]
					if (lev.label2) terms.push(lev.label2)
					combinations = await get_crosstabCombinations(terms, ds, opts)
				}
			}
			const strat = {
				label: label1,
				items: []
			}
			for (const [v1, o] of L1) {
				const L1o = {
					label: v1,
					samplecount: o.sampleset.size,
					mclasses: sort_mclass(o.mclasses)
				}
				// add cohort size, fix it so it can be applied to sub levels
				if (combinations) {
					const k = v1.toLowerCase()
					const n = combinations.find(i => i.id1 == undefined && i.v0 == k)
					if (n) L1o.cohortsize = n.count
				}

				strat.items.push(L1o)
				if (o.label2) {
					L1o.label2 = []
					for (const [v2, oo] of o.label2) {
						const L2o = {
							label: v2,
							samplecount: oo.sampleset.size,
							mclasses: sort_mclass(oo.mclasses)
						}
						if (combinations) {
							const j = v1.toLowerCase()
							const k = v2.toLowerCase()
							const n = combinations.find(i => i.v0 == j && i.v1 == k)
							if (n) L2o.cohortsize = n.count
						}
						L1o.label2.push(L2o)
					}
					L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
				}
			}
			strat.items.sort((i, j) => j.samplecount - i.samplecount)
			out.push(strat)
		}
		return out
	}
	ss.mergeShowTotal = (totalcount, showcount, q) => {
		// not in use
		const out = []
		for (const [label1, L1] of showcount) {
			const strat = {
				label: label1,
				items: []
			}
			for (const [v1, o] of L1) {
				const L1o = {
					label: v1,
					samplecount: o.sampleset.size,
					mclasses: sort_mclass(o.mclasses)
				}
				// add cohort size, fix it so it can be applied to sub levels
				if (
					ds.onetimequery_projectsize &&
					ds.onetimequery_projectsize.results &&
					ds.onetimequery_projectsize.results.has(v1)
				) {
					L1o.cohortsize = ds.onetimequery_projectsize.results.get(v1)
				}

				const totalL1o = totalcount.get(label1).get(v1)
				const hiddenmclasses = []
				for (const [mclass, totalsize] of sort_mclass(totalL1o.mclasses)) {
					const show = L1o.mclasses.find(i => i[0] == mclass)
					if (!show) {
						hiddenmclasses.push([mclass, totalsize])
					} else if (totalsize > show[1]) {
						hiddenmclasses.push([mclass, totalsize - show[1]])
					}
				}
				if (hiddenmclasses.length) L1o.hiddenmclasses = hiddenmclasses

				strat.items.push(L1o)

				if (o.label2) {
					L1o.label2 = []
					for (const [v2, oo] of o.label2) {
						const L2o = {
							label: v2,
							samplecount: oo.sampleset.size,
							mclasses: sort_mclass(oo.mclasses)
						}
						const totalL2o = totalcount
							.get(label1)
							.get(v1)
							.label2.get(v2)
						const hiddenmclasses = []
						for (const [mclass, totalsize] of sort_mclass(totalL2o.mclasses)) {
							const show = L2o.mclasses.find(i => i[0] == mclass)
							if (!show) {
								hiddenmclasses.push([mclass, totalsize])
							} else if (totalsize > show[1]) {
								hiddenmclasses.push([mclass, totalsize - show[1]])
							}
						}
						if (hiddenmclasses.length) L2o.hiddenmclasses = hiddenmclasses
						L1o.label2.push(L2o)
					}
					L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
				}
			}
			strat.items.sort((i, j) => j.samplecount - i.samplecount)

			// finished all show items in L1
			// for every total item in L1, see if it's missing from show L1
			for (const [v1, o] of totalcount.get(label1)) {
				if (!L1.has(v1)) {
					// v1 missing in showcount L1
					const L1o = {
						label: v1,
						samplecount: o.sampleset.size,
						hiddenmclasses: sort_mclass(o.mclasses)
					}
					strat.items.push(L1o)
				}
			}

			out.push(strat)
		}
		for (const [label1, L1] of totalcount) {
		}
		return out
	}
}

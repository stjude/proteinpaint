/*
The /mdssvcnv route handler of legacy mds datasets, moved from app.unorg.js, see routes/mdssvcnv.ts
*/

import { mdssvcnv_do_copyneutralloh, get_rank_from_sortedarray, setGenomes as setSharedGenomes } from './mds.shared.js'
import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { handle_mdssvcnv_expression } from './handle_mdssvcnv_expression.js'
import { draw_partition } from './partitionmatrix.js'

// set by the route init, so that the moved code can use genomes as in app.unorg.js
let genomes

export { handle_mdssvcnv }

export function setGenomes(_genomes) {
	genomes = _genomes
	setSharedGenomes(_genomes)
}

async function handle_mdssvcnv(req, res) {
	/*
    cnv & vcf & expression rank done in one query
    	- get all cnv/loh in view range:
    		- filtering
    		- group events by sample
    		- group samples by hierarchy, for client rendering

    	- if to make expression rank:
    		- expression file for official or custom
    		- calculate expression rank for genes in each sample

    vcf matrix and ase computation

    ****** filter attributes (added by addFilterToLoadParam)

    .singlesample
    .showonlycnvwithsv

    */
	try {
		const gn = genomes[req.query.genome]
		if (!gn) throw 'invalid genome'

		let ds, dsquery

		if (req.query.iscustom) {
			// is custom track
			if (req.query.file) {
				if (utils.illegalpath(req.query.file, false, false)) throw 'invalid svcnv file'
				await utils.file_is_readable(path.join(serverconfig.tpmasterdir, req.query.file))
			}

			ds = {}
			dsquery = {
				iscustom: 1,
				file: req.query.file,
				url: req.query.url,
				indexURL: req.query.indexURL,
				allow_getallsamples: true
			}

			if (req.query.checkexpressionrank) {
				if (!req.query.checkexpressionrank.file && !req.query.checkexpressionrank.url)
					throw 'no file or url for checkexpressionrank'
				if (req.query.checkexpressionrank.file) {
					if (utils.illegalpath(req.query.checkexpressionrank.file, false, false)) throw 'invalid expression file'
					await utils.file_is_readable(path.join(serverconfig.tpmasterdir, req.query.checkexpressionrank.file))
				}
				dsquery.checkexpressionrank = {
					file: req.query.checkexpressionrank.file,
					url: req.query.checkexpressionrank.url,
					indexURL: req.query.checkexpressionrank.indexURL
				}
			}

			if (req.query.checkvcf) {
				const vcf = JSON.parse(req.query.checkvcf)
				if (!vcf.file && !vcf.url) throw 'no file or url for custom VCF track'
				if (vcf.file) {
					if (utils.illegalpath(vcf.file, false, false)) throw 'invalid vcf file'
					await utils.file_is_readable(path.join(serverconfig.tpmasterdir, vcf.file))
				}
				vcf.type = common.mdsvcftype.vcf
				dsquery.checkvcf = {
					info: vcf.info,
					tracks: [vcf]
				}
			}
		} else {
			// is native track

			if (!gn.datasets) throw 'genome is not equipped with datasets'
			ds = gn.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dslabel'

			//////////// exits that only requires ds but not dsquery
			if (req.query.getsample4disco) return mdssvcnv_exit_getsample4disco(req, res, gn, ds)
			if (req.query.gettrack4singlesample) return mdssvcnv_exit_gettrack4singlesample(req, res, ds)
			if (req.query.findsamplename) return mdssvcnv_exit_findsamplename(req, res, ds)
			if (req.query.assaymap) return mdssvcnv_exit_assaymap(req, res, ds)

			if (!ds.queries) throw 'dataset is not equipped with queries'
			dsquery = ds.queries[req.query.querykey]
			if (!dsquery) throw 'invalid querykey'
		}

		///////////////// exits that require dsquery (svcnv)
		if (req.query.getexpression4gene) return mdssvcnv_exit_getexpression4gene(req, res, gn, ds, dsquery)
		if (req.query.ifsamplehasvcf) return mdssvcnv_exit_ifsamplehasvcf(req, res, gn, ds, dsquery)

		if (dsquery.viewrangeupperlimit) {
			// hard limit from official dataset
			const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
			if (len >= dsquery.viewrangeupperlimit) {
				throw 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view details'
			}
		}

		/*******
		TODO rewrite: helper func return {} attached with all possible filters
		***/

		// single or multi: hidden dt, for cnv/loh/sv/fusion/itd, all from one file
		let hiddendt
		if (req.query.hiddendt) {
			hiddendt = new Set(req.query.hiddendt)
		}

		/*
		multi: mutation attributes selected to be hidden from client
		terms defined in ds.mutationAttribute
		*/
		let hiddenmattr
		if (req.query.hiddenmattr) {
			hiddenmattr = {}
			for (const key in req.query.hiddenmattr) {
				hiddenmattr[key] = new Set(req.query.hiddenmattr[key])
			}
		}

		/*
		multi: vcf info field allele-level
		*/
		let filteralleleattr
		if (req.query.filteralleleattr) {
			filteralleleattr = {}
			for (const key in req.query.filteralleleattr) {
				const v = req.query.filteralleleattr[key]
				if (v.cutoffvalue != undefined) {
					// numeric
					filteralleleattr[key] = v
				} else {
					// categorical
					filteralleleattr[key] = v
				}
			}
		}
		/*
		multi: vcf info field locus-level
		*/
		let filterlocusattr
		if (req.query.filterlocusattr) {
			filterlocusattr = {}
			for (const key in req.query.filterlocusattr) {
				const v = req.query.filterlocusattr[key]
				if (v.cutoffvalue != undefined) {
					// numeric
					filterlocusattr[key] = v
				} else {
					// categorical
					filterlocusattr[key] = v
				}
			}
		}

		let filter_sampleset
		if (req.query.sampleset) {
			const set = new Set()
			const sample2group = new Map()
			for (const i of req.query.sampleset) {
				for (const s of i.samples) {
					set.add(s)
					sample2group.set(s, i.name)
				}
			}
			if (set.size) {
				filter_sampleset = { set, sample2group }
			}
		}

		// TODO terms from locusAttribute

		/*
		multi: sample attributes selected to be hidden from client
		as defined in ds.cohort.sampleAttribute
		*/
		let hiddensampleattr
		if (req.query.hiddensampleattr) {
			hiddensampleattr = {}
			for (const key in req.query.hiddensampleattr) {
				hiddensampleattr[key] = new Set(req.query.hiddensampleattr[key])
			}
		}

		// cache svcnv tk url index
		if (dsquery.url) {
			try {
				dsquery.dir = await utils.cache_index(dsquery.url, dsquery.indexURL)
			} catch (e) {
				throw 'svcnv file index url error'
			}
		}

		// query svcnv
		const data_cnv = await handle_mdssvcnv_cnv(
			ds,
			dsquery,
			req,
			hiddendt,
			hiddensampleattr,
			hiddenmattr,
			filter_sampleset
		)

		// expression query
		const [expressionrangelimit, gene2sample2obj] = await handle_mdssvcnv_expression(ds, dsquery, req, data_cnv)

		// vcf query
		// for both single- and multi sample
		// each member track has its own data type
		// querying procedure is the same for all types, data parsing will be different
		const [vcfrangelimit, data_vcf] = await handle_mdssvcnv_vcf(
			gn,
			ds,
			dsquery,
			req,
			filteralleleattr,
			filterlocusattr,
			hiddendt,
			hiddenmattr,
			hiddensampleattr,
			filter_sampleset
		)

		// group samples by svcnv, calculate expression rank
		const sample2item = mdssvcnv_do_sample2item(data_cnv)

		/*
		if(req.query.showonlycnvwithsv) {
			mdssvcnv_do_showonlycnvwithsv(sample2item)
		}
		*/

		if (req.query.singlesample) {
			/*
			exit
			single sample does not include expression
			but will include vcf
			*/
			const result = {
				lst: sample2item.get(req.query.singlesample)
			}

			if (vcfrangelimit) {
				// out of range
				result.vcfrangelimit = vcfrangelimit
			} else {
				result.data_vcf = data_vcf
			}

			res.send(result)
			return
		}

		const samplegroups = handle_mdssvcnv_groupsample(ds, dsquery, data_cnv, data_vcf, sample2item, filter_sampleset)

		const result = {
			samplegroups,
			vcfrangelimit,
			data_vcf
		}

		// QUICK FIX!!
		if (req.query.getallsamples && dsquery.allow_getallsamples) {
			result.getallsamples = true
		}

		handle_mdssvcnv_addexprank(result, ds, expressionrangelimit, gene2sample2obj)

		handle_mdssvcnv_end(ds, result)

		res.send(result)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function mdssvcnv_exit_assaymap(req, res, ds) {
	try {
		if (!ds.assayAvailability) throw 'assay availability not enabled for this dataset'
		const skip_termids = new Set(req.query.skip_termids || [])
		const sample2assay = new Map()
		// k: sample
		// v: Map( assay => 'yes')
		for (const n in ds.cohort.annotation) {
			if (req.query.key) {
				// only keep samples matching with key/value
				const s = ds.cohort.annotation[n]
				if (s[req.query.key] != req.query.value) continue
			}
			sample2assay.set(n, new Map())
		}
		for (const [sample, k2v] of sample2assay) {
			const a = ds.assayAvailability.samples.get(sample)
			if (!a) continue
			for (const t of ds.assayAvailability.assays) {
				if (skip_termids.has(t.id)) continue
				if (a[t.id]) {
					k2v.set(t.id, 'yes')
				}
			}
		}
		for (const sample of sample2assay.keys()) {
			if (sample2assay.get(sample).size == 0) sample2assay.delete(sample)
		}
		const data = {}
		data.totalsample = sample2assay.size
		data.terms = draw_partition({
			sample2term: sample2assay,
			terms: ds.assayAvailability.assays,
			config: {
				termidorder: req.query.termidorder // optional
			}
		})
		res.send(data)
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

function handle_mdssvcnv_groupsample(ds, dsquery, data_cnv, data_vcf, sample2item, filter_sampleset) {
	// multi sample

	if (dsquery.hideLOHwithCNVoverlap) {
		// XXX this should be a query parameter instead, so this behavior is controllable on frontend
		mdssvcnv_do_copyneutralloh(sample2item)
	}

	// group sample by available attributes
	const samplegroups = []

	if (filter_sampleset) {
		// custom sample set

		const key2group = new Map()
		// key: group name, v: list of samples from that group

		for (const [n, items] of sample2item) {
			const groupname = filter_sampleset.sample2group.get(n)
			if (!key2group.has(groupname)) key2group.set(groupname, [])
			key2group.get(groupname).push({
				samplename: n, // hardcoded
				items: items
			})
		}

		if (data_vcf) {
			// has vcf data and not custom track
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						let notfound = true
						const groupname = filter_sampleset.sample2group.get(s.sampleobj.name)
						if (!key2group.has(groupname)) key2group.set(groupname, [])
						if (!key2group.get(groupname).find(i => i.samplename == s.sampleobj.name)) {
							key2group.get(groupname).push({
								samplename: s.sampleobj.name,
								items: []
							})
						}
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf: ' + m.dt)
			}
		}
		for (const [name, samples] of key2group) {
			samplegroups.push({ name, samples })
		}
	} else if (ds.cohort && ds.cohort.annotation && dsquery.groupsamplebyattr) {
		/**** group samples by predefined annotation attributes
        only for official ds

        when vcf data is present, must include them samples in the grouping too, but not the variants

        expression samples don't participate in grouping
        */

		const key2group = new Map()
		// k: group name string
		// v: [] list of samples

		// head-less samples
		const headlesssamples = []

		//// group the sv-cnv samples
		for (const [samplename, items] of sample2item) {
			mdssvcnv_grouper(samplename, items, key2group, headlesssamples, ds, dsquery)
		}

		if (data_vcf) {
			// group the vcf samples
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						mdssvcnv_grouper(s.sampleobj.name, [], key2group, headlesssamples, ds, dsquery)
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf data: ' + m.dt)
			}
		}

		// done grouping all samples

		for (const g of key2group.values()) {
			samplegroups.push(g)
			// add precomputed total count for each group
			if (dsquery.groupsamplebyattr.key2group) {
				const o = dsquery.groupsamplebyattr.key2group.get(g.name)
				if (o) g.sampletotalnum = o.samples.length
			}
		}

		if (headlesssamples.length) {
			samplegroups.push({
				name: 'Unannotated',
				samples: headlesssamples
			})
		}

		///////// FIXME jinghui nbl cell line mixed into st/nbl, to identify that this sample is cell line on client
		for (const g of samplegroups) {
			for (const s of g.samples) {
				if (ds.cohort.annotation[s.samplename]) {
					s.sampletype = ds.cohort.annotation[s.samplename].sample_type
				}
			}
		}
	} else {
		// custom track or no annotation, lump all in one group

		// cnv
		const samples = []
		for (const [n, items] of sample2item) {
			samples.push({
				samplename: n, // hardcoded
				items: items
			})
		}

		if (data_vcf) {
			// has vcf data and not custom track
			for (const m of data_vcf) {
				if (m.dt == common.dtsnvindel) {
					for (const s of m.sampledata) {
						let notfound = true
						for (const s2 of samples) {
							if (s2.samplename == s.sampleobj.name) {
								notfound = false
								break
							}
						}
						if (notfound) {
							samples.push({
								samplename: s.sampleobj.name,
								items: []
							})
						}
					}
					continue
				}

				console.log('unknown dt when grouping samples from vcf: ' + m.dt)
			}
		}

		if (samples.length) {
			samplegroups.push({ samples: samples })
		}
	}
	return samplegroups
}

function handle_mdssvcnv_addexprank(result, ds, expressionrangelimit, gene2sample2obj) {
	// assign expression rank for all samples listed in samplegroup
	// no returned value
	if (expressionrangelimit) {
		// view range too big above limit set by official track, no checking expression
		result.expressionrangelimit = expressionrangelimit
		return
	}
	if (gene2sample2obj) {
		// report coordinates for each gene back to client
		result.gene2coord = {}
		for (const [n, g] of gene2sample2obj) {
			result.gene2coord[n] = { chr: g.chr, start: g.start, stop: g.stop }
		}

		if (result.samplegroups.length == 0) {
			// got no samples from dna query
			return
		}

		if (result.getallsamples) {
			// QUICK FIX - only for custom track
			// merge all fpkm samples into result.samplegroups[0], so all samples will show
			const hassamples = new Set(result.samplegroups[0].samples.map(i => i.samplename))
			const toaddsamples = new Set()
			for (const [n, g] of gene2sample2obj) {
				for (const sample of g.samples.keys()) {
					if (hassamples.has(sample)) continue
					toaddsamples.add(sample)
				}
			}
			for (const sample of toaddsamples) {
				result.samplegroups[0].samples.push({ samplename: sample, items: [] })
			}
		}

		for (const g of result.samplegroups) {
			// expression ranking is within each sample group
			// collect expression data for each gene for all samples of this group
			const gene2allvalues = new Map()
			// k: gene, v: [ obj ]

			for (const [gene, tmp] of gene2sample2obj) {
				gene2allvalues.set(gene, [])

				for (const [sample, obj] of tmp.samples) {
					if (g.attributes && ds.cohort && ds.cohort.annotation) {
						/*
                        a group from official track could still be unannotated, skip them
                        */
						const anno = ds.cohort.annotation[sample]
						if (!anno) continue
						let annomatch = true
						for (const attr of g.attributes) {
							if (anno[attr.k] != attr.kvalue) {
								annomatch = false
								break
							}
						}
						if (annomatch) {
							gene2allvalues.get(gene).push(obj)
						}
					} else {
						// custom track, just one group for all samples
						gene2allvalues.get(gene).push(obj)
					}
				}
			}

			// for each gene, sort samples
			for (const [gene, lst] of gene2allvalues) {
				lst.sort((i, j) => i.value - j.value)
			}

			// for each sample, compute rank within its group
			for (const sample of g.samples) {
				sample.expressionrank = {}
				for (const [gene, allvalue] of gene2allvalues) {
					// allvalue is expression of this gene in all samples of this group
					// for this gene
					// expression value of this gene in this sample
					const thisobj = gene2sample2obj.get(gene).samples.get(sample.samplename)
					if (thisobj == undefined) {
						// not expressed
						continue
					}

					const rank = get_rank_from_sortedarray(thisobj.value, allvalue)
					sample.expressionrank[gene] = { rank: rank }

					for (const k in thisobj) {
						sample.expressionrank[gene][k] = thisobj[k]
					}
				}
			}
		}
	}
}

function handle_mdssvcnv_end(ds, result) {
	if (ds.cohort && ds.cohort.sampleAttribute && ds.cohort.sampleAttribute.attributes && ds.cohort.annotation) {
		result.sampleannotation = {}

		const useattrkeys = [] // some attr keys are hidden from client
		for (const key in ds.cohort.sampleAttribute.attributes) {
			const a = ds.cohort.sampleAttribute.attributes[key]
			if (!a.clientnoshow) useattrkeys.push(key)
		}

		for (const g of result.samplegroups) {
			for (const sample of g.samples) {
				const anno = ds.cohort.annotation[sample.samplename]
				if (anno) {
					const toclient = {} // annotations to client
					let hasannotation = false
					for (const key of useattrkeys) {
						const value = anno[key]
						if (value != undefined) {
							hasannotation = true
							toclient[key] = value
						}
					}
					if (hasannotation) {
						// ony pass on if this sample has valid annotation
						result.sampleannotation[sample.samplename] = toclient
					}
				}
			}
		}
	}
}

async function handle_mdssvcnv_vcf(
	genome,
	ds,
	dsquery,
	req,
	filteralleleattr,
	filterlocusattr,
	hiddendt,
	hiddenmattr,
	hiddensampleattr,
	filter_sampleset
) {
	let vcfquery
	if (dsquery.iscustom) {
		vcfquery = dsquery.checkvcf
	} else {
		// official
		if (dsquery.vcf_querykey) {
			if (ds.queries[dsquery.vcf_querykey]) {
				vcfquery = ds.queries[dsquery.vcf_querykey]
			}
		}
	}
	if (!vcfquery) {
		// no vcf query
		return [null, null]
	}

	if (req.query.singlesample && vcfquery.singlesamples) {
		const tmp = vcfquery.singlesamples.samples[req.query.singlesample]
		if (tmp) {
			// has a vcf file for this sample, query this instead
			const thisvcf = {
				file: path.join(serverconfig.tpmasterdir, tmp)
			}

			try {
				await fs.promises.stat(thisvcf.file)
			} catch (e) {
				// invalid file
				return [null, null]
			}

			// meta and header
			const mlines = await tabix_getvcfmeta(thisvcf.file)

			const [info, format, samples, err] = vcf.vcfparsemeta(mlines)
			if (err) throw err
			thisvcf.info = info
			thisvcf.format = format
			thisvcf.samples = samples
			thisvcf.nochr = await utils.tabix_is_nochr(thisvcf.file, null, genome)
			return handle_mdssvcnv_vcf_singlesample(
				req,
				ds,
				thisvcf,
				filteralleleattr,
				hiddendt,
				hiddenmattr,
				hiddensampleattr
			)
		}
	}

	// query cohort vcf files for both cohort and sample view
	// TODO separate range limits, above 1mb, do not show noncoding ones; above 3mb, do not show coding ones
	// also show alert message on client

	let viewrangeupperlimit = vcfquery.viewrangeupperlimit
	if (!viewrangeupperlimit && dsquery.iscustom) {
		// no limit set for custom track
		if (serverconfig.features.customMdsSingleSampleVcfNoRangeLimit) {
			// this server has no range limit
			viewrangeupperlimit = 0
		} else {
			// set a hard limit
			viewrangeupperlimit = 2000000
		}
	}

	if (req.query.singlesample) {
		// still limit in singlesample
		viewrangeupperlimit *= 5
	}

	if (viewrangeupperlimit) {
		const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= viewrangeupperlimit) {
			return [viewrangeupperlimit, null]
		}
	}

	const tracktasks = []

	for (const vcftk of vcfquery.tracks) {
		const thistracktask = Promise.resolve()
			.then(() => {
				// for custom url the index has already been cached at initial load
				// still need to get cache dir for loading index
				if (vcftk.file) return ''
				return utils.cache_index(vcftk.url, vcftk.indexURL)
			})
			.then(dir => {
				vcftk.dir = dir

				// get vcf data
				const variants = []

				const tasks = []
				// rglst was already validated by the app middleware (app.middlewares.js)
				for (const r of req.query.rglst) {
					const task = new Promise((resolve, reject) => {
						utils
							.readTabixLines({
								file: vcftk.file ? path.join(serverconfig.tpmasterdir, vcftk.file) : vcftk.url,
								regions: [{ chr: vcftk.nochr ? r.chr.replace('chr', '') : r.chr, start: r.start, stop: r.stop }],
								dir: dir,
								callback: line => {
									if (vcftk.type == common.mdsvcftype.vcf) {
										// bgzip vcf file

										const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, {
											nochr: vcftk.nochr,
											samples: vcftk.samples,
											info: vcfquery.info,
											format: vcftk.format
										})

										for (const m of mlst) {
											if (!m.sampledata) {
												// do not allow
												continue
											}

											if (filteralleleattr) {
												// filter using allele INFO

												let todrop = false

												for (const key in filteralleleattr) {
													const value = m.altinfo[key]
													if (value == undefined) {
														// no value
														todrop = true
														break
													}

													const attr = filteralleleattr[key]
													if (attr.cutoffvalue != undefined) {
														// is a numeric cutoff

														if (!Number.isFinite(value)) {
															// value of this mutation is not a number
															todrop = true
															break
														}

														if (attr.keeplowerthan) {
															if (value > attr.cutoffvalue) {
																todrop = true
																break
															}
														} else {
															if (value < attr.cutoffvalue) {
																todrop = true
																break
															}
														}
													} else {
														// categorical
														if (attr.includes(value)) {
															todrop = true
															break
														}
													}
												}
												if (todrop) {
													// drop this variant
													continue
												}
											}
											if (filterlocusattr) {
												// filter using allele INFO

												let todrop = false

												for (const key in filterlocusattr) {
													const _value = m.info[key]
													if (_value == undefined) {
														// no value
														todrop = true
														break
													}
													let value = _value
													if (Array.isArray(_value)) {
														value = _value[0]
														if (value == '.') {
															// no value
															todrop = true
															break
														}
													}

													const attr = filterlocusattr[key]
													if (attr.cutoffvalue != undefined) {
														// is a numeric cutoff

														if (!Number.isFinite(value)) {
															// value of this mutation is not a number
															todrop = true
															break
														}

														if (attr.keeplowerthan) {
															if (value > attr.cutoffvalue) {
																todrop = true
																break
															}
														} else {
															if (value < attr.cutoffvalue) {
																todrop = true
																break
															}
														}
													} else {
														// categorical
														if (attr.includes(value)) {
															todrop = true
															break
														}
													}
												}
												if (todrop) {
													// drop this variant
													continue
												}
											}

											{
												// for germline track:
												const lst = []
												for (const s of m.sampledata) {
													if (s.gtallref) {
														// drop ref/ref sample, should only happen for germline vcf
														continue
													}

													if (s.__gtalleles) {
														// germline - m.sampledata[] always have all the samples due to the old vcf processing
														// even if the sample does not carry m's alt allele
														if (s.__gtalleles.indexOf(m.alt) == -1) {
															continue
														}
														delete s.__gtalleles
													}

													lst.push(s)
												}
												if (lst.length == 0) {
													continue
												}
												m.sampledata = lst
											}

											// filters on samples

											if (req.query.singlesample) {
												let thissampleobj = null
												for (const s of m.sampledata) {
													if (s.sampleobj.name == req.query.singlesample) {
														thissampleobj = s
														break
													}
												}
												if (!thissampleobj) {
													// this variant is not in this sample
													continue
												}
												// alter
												m.sampledata = [thissampleobj]
											} else if (filter_sampleset) {
												const lst = m.sampledata.filter(s => filter_sampleset.set.has(s.sampleobj.name))
												if (lst.length) {
													m.sampledata = lst
												} else {
													continue
												}
											}

											if (hiddenmattr) {
												const samplesnothidden = []
												for (const s of m.sampledata) {
													let nothidden = true
													for (const key in hiddenmattr) {
														// attribute keys are FORMAT fields
														let value = s[key]
														if (value == undefined) {
															value = common.not_annotated
														}
														if (hiddenmattr[key].has(value)) {
															nothidden = false
															break
														}
													}
													if (nothidden) {
														samplesnothidden.push(s)
													}
												}
												if (samplesnothidden.length == 0) {
													// skip this variant
													continue
												}
												m.sampledata = samplesnothidden
											}

											if (hiddensampleattr && ds.cohort && ds.cohort.annotation) {
												/*
									drop sample by annotation
									FIXME this is not efficient
									ideally should identify samples from this vcf file to be dropped, the column # of them
									after querying the vcf file, cut these columns away
									*/
												const samplesnothidden = []
												for (const s of m.sampledata) {
													const sanno = ds.cohort.annotation[s.sampleobj.name]
													if (!sanno) {
														// sample has no annotation?
														continue
													}
													let nothidden = true
													for (const key in hiddensampleattr) {
														const value = sanno[key]
														if (hiddensampleattr[key].has(value)) {
															nothidden = false
															break
														}
													}
													if (nothidden) {
														samplesnothidden.push(s)
													}
												}
												if (samplesnothidden.length == 0) {
													// skip this variant
													continue
												}
												m.sampledata = samplesnothidden
											}

											// delete the obsolete attr
											for (const sb of m.sampledata) {
												delete sb.allele2readcount
											}

											delete m._m
											delete m.vcf_ID
											delete m.name

											m.dt = common.dtsnvindel
											variants.push(m)
											// mclass and rest will be determined at client, according to whether in gmmode and such
										}
									} else {
										console.error('unknown "type" from a vcf file')
									}
								}
							})
							.then(() => {
								resolve()
							}, reject)
					})
					tasks.push(task)
				}

				return Promise.all(tasks).then(() => {
					return variants
				})
			})

		tracktasks.push(thistracktask)
	}

	return Promise.all(tracktasks).then(vcffiles => {
		// snv/indel data aggregated from multiple tracks
		const mmerge = []

		for (const eachvcf of vcffiles) {
			for (const m of eachvcf) {
				if (m.dt == common.dtsnvindel) {
					// snv/indel all follows vcf matrix, using sampledata[]

					if (!m.sampledata) {
						// no sample data, won't show
						continue
					}
					let notfound = true
					for (const m2 of mmerge) {
						if (m.chr == m2.chr && m.pos == m2.pos && m.ref == m2.ref && m.alt == m2.alt) {
							for (const s of m.sampledata) {
								m2.sampledata.push(s)
							}
							notfound = false
							break
						}
					}
					if (notfound) {
						mmerge.push(m)
					}
					continue
				}

				console.error('unknown dt: ' + m.dt)
			}
		}

		// variants may come from multiple files, sort again to avoid curious batch effect
		mmerge.sort((i, j) => i.pos - j.pos)

		return [null, mmerge]
	})
}

function handle_mdssvcnv_vcf_singlesample(req, ds, thisvcf, filteralleleattr, hiddendt, hiddenmattr, hiddensampleattr) {
	/*
query variants for a single sample, from a single vcf file

bad repetition
*/
	const variants = []

	const tasks = []
	// rglst was already validated by the app middleware (app.middlewares.js)
	for (const r of req.query.rglst) {
		const task = new Promise((resolve, reject) => {
			utils
				.readTabixLines({
					file: thisvcf.file,
					regions: [{ chr: thisvcf.nochr ? r.chr.replace('chr', '') : r.chr, start: r.start, stop: r.stop }],
					callback: line => {
						const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, thisvcf)

						for (const m of mlst) {
							if (!m.sampledata) {
								// do not allow
								continue
							}

							// restrict to queried sample
							const thissampleobj = m.sampledata.find(i => i.sampleobj.name == req.query.singlesample)
							if (!thissampleobj) {
								// this variant is not in this sample
								continue
							}
							// delete the obsolete attr
							delete thissampleobj.allele2readcount
							// alter
							m.sampledata = [thissampleobj]

							if (filteralleleattr) {
								// filter using allele INFO

								let todrop = false

								for (const key in filteralleleattr) {
									const value = m.altinfo[key]
									if (value == undefined) {
										// no value
										todrop = true
										break
									}

									const attr = filteralleleattr[key]
									if (attr.cutoffvalue != undefined) {
										// is a numeric cutoff

										if (!Number.isFinite(value)) {
											// value of this mutation is not a number
											todrop = true
											break
										}

										if (attr.keeplowerthan) {
											if (value > attr.cutoffvalue) {
												todrop = true
												break
											}
										} else {
											if (value < attr.cutoffvalue) {
												todrop = true
												break
											}
										}
									}
								}
								if (todrop) {
									// drop this variant
									continue
								}
							}

							// TODO filter with locus INFO

							// for germline track:
							if (thissampleobj.gtallref) {
								// drop ref/ref sample, should only happen for germline vcf
								continue
							}
							if (thissampleobj.__gtalleles) {
								// germline - m.sampledata[] always have all the samples due to the old vcf processing
								// even if the sample does not carry m's alt allele
								if (thissampleobj.__gtalleles.indexOf(m.alt) == -1) {
									continue
								}
								delete thissampleobj.__gtalleles
							}

							if (hiddenmattr) {
								const samplesnothidden = []
								for (const s of m.sampledata) {
									let nothidden = true
									for (const key in hiddenmattr) {
										// attribute keys are FORMAT fields
										let value = s[key]
										if (value == undefined) {
											value = common.not_annotated
										}
										if (hiddenmattr[key].has(value)) {
											nothidden = false
											break
										}
									}
									if (nothidden) {
										samplesnothidden.push(s)
									}
								}
								if (samplesnothidden.length == 0) {
									// skip this variant
									continue
								}
								m.sampledata = samplesnothidden
							}

							if (hiddensampleattr && ds.cohort && ds.cohort.annotation) {
								/*
                        drop sample by annotation
                        FIXME this is not efficient
                        ideally should identify samples from this vcf file to be dropped, the column # of them
                        after querying the vcf file, cut these columns away
                        */
								const samplesnothidden = []
								for (const s of m.sampledata) {
									const sanno = ds.cohort.annotation[s.sampleobj.name]
									if (!sanno) {
										// sample has no annotation?
										continue
									}
									let nothidden = true
									for (const key in hiddensampleattr) {
										const value = sanno[key]
										if (hiddensampleattr[key].has(value)) {
											nothidden = false
											break
										}
									}
									if (nothidden) {
										samplesnothidden.push(s)
									}
								}
								if (samplesnothidden.length == 0) {
									// skip this variant
									continue
								}
								m.sampledata = samplesnothidden
							}

							delete m._m
							delete m.vcf_ID
							delete m.name

							m.dt = common.dtsnvindel
							variants.push(m)
						}
					}
				})
				.then(() => {
					resolve()
				}, reject)
		})
		tasks.push(task)
	}

	return Promise.all(tasks).then(() => {
		return [null, variants]
	})
}

function handle_mdssvcnv_cnv(ds, dsquery, req, hiddendt, hiddensampleattr, hiddenmattr, filter_sampleset) {
	if (!dsquery.file && !dsquery.url) {
		// svcnv file is optional now
		return []
	}

	const tasks = []

	// rglst was already validated by the app middleware (app.middlewares.js)
	for (const r of req.query.rglst) {
		const task = new Promise((resolve, reject) => {
			const data = []
			utils
				.readTabixLines({
					file: dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
					regions: [{ chr: r.chr, start: r.start, stop: r.stop }],
					dir: dsquery.dir,
					callback: line => {
						const l = line.split('\t')
						const start0 = Number.parseInt(l[1])
						const stop0 = Number.parseInt(l[2])

						let j
						try {
							j = JSON.parse(l[3])
						} catch (e) {
							// invalid json, todo: report error
							return
						}

						if (j.dt == undefined) {
							// todo: report bad lines
							return
						}

						if (hiddendt && hiddendt.has(j.dt)) {
							return
						}

						///// data-type specific handling and filtering

						if (j.dt == common.dtloh) {
							// loh
							if (j.segmean && req.query.segmeanValueCutoff && j.segmean < req.query.segmeanValueCutoff) {
								return
							}
							if (req.query.lohLengthUpperLimit) {
								if (stop0 - start0 > req.query.lohLengthUpperLimit) {
									return
								}
							}
							j.chr = l[0]
							j.start = start0
							j.stop = stop0
						} else if (j.dt == common.dtfusionrna || j.dt == common.dtsv) {
							// sv
							j._chr = l[0]
							j._pos = start0
							if (j.chrA) {
								j.chrB = l[0]
								j.posB = start0
							} else {
								j.chrA = l[0]
								j.posA = start0
							}
						} else if (j.dt == common.dtcnv) {
							// cnv
							if (req.query.hide_cnvloss && j.value < 0) return
							if (req.query.hide_cnvgain && j.value > 0) return

							if (req.query.valueCutoff) {
								if (Math.abs(j.value) < req.query.valueCutoff) {
									return
								}
							}
							if (req.query.bplengthUpperLimit) {
								if (stop0 - start0 > req.query.bplengthUpperLimit) {
									return
								}
							}
							j.chr = l[0]
							j.start = start0
							j.stop = stop0
						} else if (j.dt == common.dtitd) {
							j.chr = l[0]
							j.start = start0
							j.stop = stop0
						} else {
							console.error('unknown dt from svcnv file: ' + j.dt)
							return
						}

						if (req.query.singlesample) {
							// in single-sample mode
							if (j.sample != req.query.singlesample) {
								return
							}
						} else if (filter_sampleset) {
							if (!filter_sampleset.set.has(j.sample)) return
						} else if (j.sample && ds.cohort && ds.cohort.annotation) {
							// not single-sample
							// only for official ds

							// may apply sample annotation filtering
							const anno = ds.cohort.annotation[j.sample]
							if (!anno) {
								// this sample has no annotation at all, since it's doing filtering, will drop it
								return
							}

							// only check this here, because it requires sample annotation
							if (hiddensampleattr) {
								for (const key in hiddensampleattr) {
									const samplevalue = anno[key]
									if (hiddensampleattr[key].has(samplevalue)) {
										// this sample has hidden annotation
										return
									}
								}
							}
						}

						if (hiddenmattr) {
							// check mutation-level annotation
							for (const key in hiddenmattr) {
								let itemvalue = j.mattr ? j.mattr[key] : undefined
								if (itemvalue == undefined) {
									itemvalue = common.not_annotated
								}

								if (hiddenmattr[key].has(itemvalue)) {
									// this item has hidden annotation
									return
								}
							}
						}

						// this item is acceptable
						data.push(j)
					}
				})
				.then(() => {
					resolve(data)
				}, reject)
		})
		tasks.push(task)
	}
	return Promise.all(tasks)
}

function mdssvcnv_do_sample2item(data_cnv) {
	/*
    transform data_cnv[] to sample2item

    to dedup, as the same cnv event may be retrieved multiple times by closeby regions, also gets set of samples for summary
    k: sample
    v: list of sv, cnv, loh

    do not include snvindel from vcf
    the current data_vcf is variant-2-sample
    if snvindel is spread across samples, the variant annotation must be duplicated too
    just pass the lot to client, there each variant will sort out annotation, then spread to samples while keeping pointers in sample-m to original m

    yet further complexity due to the need of grouping samples by server-side annotation
    which will require vcf samples all to be included in samplegroups

    expression rank will be assigned to samples in all groups
    for vcf samples to get expression rank, it also require them to be grouped!
    */
	const sample2item = new Map()

	for (const tmp of data_cnv) {
		for (const item of tmp) {
			if (!item.sample) {
				// must have sample
				continue
			}
			const sn = item.sample
			if (!sample2item.has(sn)) {
				sample2item.set(sn, [])
			}

			if (item._chr) {
				// sv, no checking against coordset
				sample2item.get(sn).push(item)
				continue
			}

			// new event
			delete item.sample
			delete item.sampletype
			sample2item.get(sn).push(item)
		}
	}
	return sample2item
}

function mdssvcnv_do_showonlycnvwithsv(sample2item) {
	/*
!!!do not use!!!!
for a cnv with both ends out of view range, there is no way to query the sv at its boundary regions so no way to know if "sv-supported"

arg is a map of sample to list of items
in each sample, for a cnv to be displayed, its ends must 
*/
	// if a sv breakpoint falls within this distance to a cnv boundary, will say this boundary is "sv-supported"
	//const maxsupportdist = 1000

	for (const [sample, lst] of sample2item) {
		const svchr2pos = {}
		// k: sv chr
		// v: set of sv breakpoint positions
		for (const j of lst) {
			if (j.dt == common.dtsv) {
				if (!svchr2pos[j.chrA]) {
					svchr2pos[j.chrA] = new Set()
				}
				svchr2pos[j.chrA].add(j.posA)
				if (!svchr2pos[j.chrB]) {
					svchr2pos[j.chrB] = new Set()
				}
				svchr2pos[j.chrB].add(j.posB)
			}
		}

		const keepitems = []
		for (const j of lst) {
			if (j._chr || j.loh) {
				keepitems.push(j)
				continue
			}
			if (!svchr2pos[j.chr]) continue

			let match = false
			for (const pos of svchr2pos[j.chr]) {
				if (pos >= j.start - 1000 && pos <= j.stop + 1000) {
					match = true
					break
				}
			}
			if (match) {
				keepitems.push(j)
			}
		}
		if (keepitems.length) {
			sample2item.set(sample, keepitems)
		} else {
			sample2item.delete(sample)
		}
	}
}

function mdssvcnv_grouper(samplename, items, key2group, headlesssamples, ds, dsquery) {
	/*
    helper function, used by both cnv and vcf
    to identify which group a sample is from, insert the group, then insert the sample
    */

	const sanno = ds.cohort.annotation[samplename]
	if (!sanno) {
		// this sample has no annotation
		headlesssamples.push({
			samplename: samplename, // hardcoded attribute name
			items: items
		})
		return
	}

	const headname = sanno[dsquery.groupsamplebyattr.attrlst[0].k]
	if (headname == undefined) {
		// head-less
		headlesssamples.push({
			samplename: samplename, // hardcoded
			items: items
		})
		return
	}

	const attrnames = []
	for (let i = 1; i < dsquery.groupsamplebyattr.attrlst.length; i++) {
		const v = sanno[dsquery.groupsamplebyattr.attrlst[i].k]
		if (v == undefined) {
			break
		}
		attrnames.push(v)
	}

	attrnames.unshift(headname)

	const groupname = attrnames.join(dsquery.groupsamplebyattr.attrnamespacer)

	if (!key2group.has(groupname)) {
		/*
        a new group
        need to get available full name for each attribute value for showing on client
        if attr.full is not available, just use key value
        */
		const attributes = []
		for (const attr of dsquery.groupsamplebyattr.attrlst) {
			const v = sanno[attr.k]
			if (v == undefined) {
				// ordered list, look no further
				break
			}
			const a = { k: attr.k, kvalue: v }
			if (attr.full) {
				a.full = attr.full
				a.fullvalue = sanno[attr.full]
			}
			attributes.push(a)
		}

		// to be replaced
		const levelnames = []
		for (const attr of dsquery.groupsamplebyattr.attrlst) {
			const v = sanno[attr.k]
			if (v == undefined) {
				break
			}
			const lname = (attr.full ? sanno[attr.full] : null) || v
			levelnames.push(lname)
		}

		key2group.set(groupname, {
			name: groupname,
			samples: [],
			attributes: attributes
		})
	}

	let notfound = true
	for (const s of key2group.get(groupname).samples) {
		if (s.samplename == samplename) {
			// same sample, can happen for vcf samples
			// combine data, actually none for vcf
			for (const m of items) {
				s.items.push(m)
			}
			notfound = false
			break
		}
	}

	if (notfound) {
		key2group.get(groupname).samples.push({
			samplename: samplename, // hardcoded
			items: items
		})
	}
}

function tabix_getvcfmeta(file, dir) {
	return utils.readTabixHeader(file, dir).then(lines => {
		if (!lines.length) throw 'cannot list vcf meta lines'
		return lines
	})
}

function mdssvcnv_exit_gettrack4singlesample(req, res, ds) {
	/*
    getting track for single sample from server config
    only for official dataset
    */
	const samplename = req.query.gettrack4singlesample
	if (req.query.iscustom) {
		// not supported
		return res.send({ error: 'no server-side config available for custom track' })
	}
	if (!ds.sampleAssayTrack) {
		// not available
		return res.send({})
	}
	return res.send({
		tracks: ds.sampleAssayTrack.samples.get(samplename)
	})
}

function mdssvcnv_exit_ifsamplehasvcf(req, res, gn, ds, dsquery) {
	if (req.query.iscustom) return res.send({ no: 1 })
	if (!dsquery.vcf_querykey) {
		// no vcf query, should be speedy and allow
		return res.send({ yes: 1 })
	}
	const vcfq = ds.queries[dsquery.vcf_querykey]
	if (!vcfq) return res.send({ error: 'vcf query missing' })
	res.send(vcfq.singlesamples ? { yes: 1 } : { no: 1 })
}

function mdssvcnv_exit_getsample4disco(req, res, gn, ds) {
	/*
    a text file for a single sample
    only for official dataset
    */
	if (req.query.iscustom) return res.send({ error: 'not for custom track' })
	if (!ds.singlesamplemutationjson)
		return res.send({ error: 'singlesamplemutationjson not available for this dataset' })
	const samplename = req.query.getsample4disco
	// the file name is looked up by the sample name in the dataset's list of sample files
	const f0 = ds.singlesamplemutationjson.samples[samplename]
	if (!f0) return res.send({ error: 'no data' })
	const file = path.join(serverconfig.tpmasterdir, f0)
	fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
		if (err) return res.send({ error: 'error getting data for this sample' })
		res.send({ text: data })
	})
}

async function mdssvcnv_exit_getexpression4gene(req, res, gn, ds, dsquery) {
	/*
    get expression data for a gene

    gene name up/lower case confusion here
    - query name
    - gene name in fpkm file
    */

	try {
		const q = req.query.getexpression4gene
		if (!q.chr) throw 'chr missing'
		if (!Number.isFinite(q.start)) throw 'invalid start pos'
		if (!Number.isFinite(q.stop)) throw 'invalid stop pos'
		if (!q.name) throw 'unknown gene name'

		let _c
		if (dsquery.iscustom) {
			_c = dsquery.checkexpressionrank
		} else {
			if (dsquery.expressionrank_querykey) {
				_c = ds.queries[dsquery.expressionrank_querykey]
			}
		}
		if (!_c) throw 'missing expression data source'

		const dir = _c.file ? null : await utils.cache_index(_c.url, _c.indexURL)

		const values = []
		await utils.readTabixLines({
			file: _c.file ? path.join(serverconfig.tpmasterdir, _c.file) : _c.url,
			regions: [{ chr: q.chr, start: q.start, stop: q.stop }],
			dir,
			callback: line => {
				const l = line.split('\t')
				let j
				try {
					j = JSON.parse(l[3])
				} catch (e) {
					reject('invalid json from expression data')
				}
				if (!j.sample) return
				if (!j.gene) return
				if (!Number.isFinite(j.value)) return
				delete j.outlier // XXX OHE
				if (j.gene.toLowerCase() == q.name.toLowerCase()) {
					values.push(j)
				}
			}
		})

		// convert to rank
		const sample2rank = mdssvcnv_exit_getexpression4gene_rank(ds, dsquery, values)

		res.send({ sample2rank: sample2rank })
	} catch (err) {
		if (err.stack) console.error(err.stack)
		res.send({ error: err.message || err })
	}
}

function mdssvcnv_exit_getexpression4gene_rank(ds, dsquery, values) {
	/*
    values: [ {sample, value, ase, outlier } ]
    for each value, convert to rank

    if native, may group samples by attr
    otherwise, use all samples as a group
    */

	const sample2rank = {}

	if (ds && ds.cohort && ds.cohort.annotation && dsquery.groupsamplebyattr && dsquery.groupsamplebyattr.attrlst) {
		// native, and with required attr

		const groups = new Map()

		for (const vo of values) {
			// vo: {value, ase, outlier, sample}

			const anno = ds.cohort.annotation[vo.sample]
			if (!anno) continue

			const tmp = []
			for (const a of dsquery.groupsamplebyattr.attrlst) {
				tmp.push(anno[a.k])
			}
			const grouplabel = tmp.join(',') // won't be shown on client

			if (!groups.has(grouplabel)) groups.set(grouplabel, [])

			groups.get(grouplabel).push(vo)
		}

		for (const lst of groups.values()) {
			// each group
			lst.sort((a, b) => a.value - b.value)
			for (const vo of lst) {
				vo.rank = get_rank_from_sortedarray(vo.value, lst)
				sample2rank[vo.sample] = vo
			}
		}
	} else {
		// anything else, include all samples into one group
		values.sort((a, b) => a.value - b.value)
		for (const vo of values) {
			vo.rank = get_rank_from_sortedarray(vo.value, values)
			sample2rank[vo.sample] = vo
		}
	}

	return sample2rank
}

function mdssvcnv_exit_findsamplename(req, res, ds) {
	/*
    find sample names by matching with input string
    only for official dataset
    */
	if (req.query.iscustom) {
		// not supported
		return res.send({ error: 'cannot search sample by name in custom track' })
	}
	const str = req.query.findsamplename.toLowerCase()

	// must return grouping attributes for launching expression rank
	const result = []

	if (!ds.cohort.__samplelst) {
		// array of lower case sample names
		// only init once
		ds.cohort.__samplelst = []
		for (const name in ds.cohort.annotation) {
			ds.cohort.__samplelst.push({
				name,
				low: name.toLowerCase()
			})
		}
	}
	findadd(ds.cohort.__samplelst)

	// list of samples ready to be returned to client
	// now append attributes to found samples

	// get the svcnv query for checking stuff
	for (const k in ds.queries) {
		const q = ds.queries[k]
		if (q.type == common.tkt.mdssvcnv) {
			if (q.groupsamplebyattr) {
				for (const s of result) {
					const a = ds.cohort.annotation[s.name]
					if (!a) continue
					const lst = []
					for (const attr of q.groupsamplebyattr.attrlst) {
						const v = a[attr.k]
						if (v) {
							lst.push({
								k: attr.k,
								kvalue: v
							})
						}
					}
					if (lst.length) {
						s.attributes = lst
						s.grouplabel = lst.map(i => i.kvalue).join(q.groupsamplebyattr.attrnamespacer)
					}
				}
			}
		}
	}

	if (ds.cohort && ds.cohort.sampleAttribute && ds.cohort.sampleAttribute.attributes && ds.cohort.annotation) {
		for (const sample of result) {
			const anno = ds.cohort.annotation[sample.name]
			if (!anno) continue
			const toclient = [] // annotations to client
			for (const key in ds.cohort.sampleAttribute.attributes) {
				if (ds.cohort.sampleAttribute.attributes[key].clientnoshow) {
					continue
				}
				const value = anno[key]
				if (value != undefined) {
					toclient.push({ k: key, v: value })
				}
			}
			if (toclient.length) {
				sample.attr = toclient
			}
		}
	}

	if (ds.sampleAssayTrack) {
		for (const sample of result) {
			const a = ds.sampleAssayTrack.samples.get(sample.name)
			if (a) {
				sample.num_assay_tracks = a.length
			}
		}
	}

	if (ds.cohort && ds.cohort.mutation_signature) {
		for (const k in ds.cohort.mutation_signature.sets) {
			const s = ds.cohort.mutation_signature.sets[k]
			if (s.samples) {
				for (const ss of result) {
					if (s.samples.map.has(ss.name)) {
						ss.mutation_signature = 1
					}
				}
			}
		}
	}

	if (ds.singlesamplemutationjson) {
		// if has disco
		for (const s of result) {
			if (ds.singlesamplemutationjson.samples[s.name]) {
				s.disco = 1
			}
		}
	}

	return res.send({ result })

	function findadd(samples) {
		for (const s of samples) {
			if (result.length > 10) return

			if (s.low.indexOf(str) == -1) continue

			if (result.find(i => i.name == s.name)) {
				// already found it
				continue
			}
			result.push(s)
		}
	}
}

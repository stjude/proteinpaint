import * as mds3_init from '#src/mds3.init.js'
import * as common from '#shared/common.js'
import type { DatasetRequest, DatasetResponse, RouteApi } from '#types'
import { datasetPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'getDataset', // should rename to simply 'dataset', method is based on HTTP method
	methods: {
		get: {
			init,
			...datasetPayload
		},
		post: {
			init,
			...datasetPayload
		}
	}
}

function init({ genomes }) {
	return function (req, res) {
		/*
		q.genome=str, case-sensitive match with genome name
		q.dsname=str, case-insensitive match with ds key (e.g. pediatric for Pediatric) 

		allow case-insensitive match with dsname
		*/
		try {
			const q: DatasetRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			if (!genome.datasets) throw 'genomeobj.datasets{} missing'
			let ds
			for (const k in genome.datasets) {
				if (k.toLowerCase() == q.dsname.toLowerCase()) {
					ds = genome.datasets[k]
					break
				}
			}
			if (!ds) throw 'invalid dsname'
			const copy = ds.isMds3 ? mds3_init.client_copy(ds) : ds.isMds ? mds_clientcopy(ds) : copy_legacyDataset(ds) // to be replaced by mds3

			return res.send({ ds: copy } satisfies DatasetResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
		}
	}
}

function mds_clientcopy(ds) {
	// make client-side copy of a mds

	const ds2: any = {
		isMds: true,
		noHandleOnClient: ds.noHandleOnClient,
		label: ds.label,
		version: ds.version,
		annotationsampleset2matrix: ds.annotationsampleset2matrix,
		mutationAttribute: ds.mutationAttribute,
		locusAttribute: ds.locusAttribute,
		alleleAttribute: ds.alleleAttribute,
		// these are quick fixes and should be deleted later
		hide_genotypedownload: ds.hide_genotypedownload,
		hide_phewas: ds.hide_phewas,
		sample2bam: ds.sample2bam
	}

	if (ds.queries) {
		ds2.queries = {}
	}

	if (ds.singlesamplemutationjson) {
		ds2.singlesamplemutationjson = 1
	}
	if (ds.gene2mutcount) {
		ds2.gene2mutcount = true
		ds2.mutCountType = ds.gene2mutcount.mutationTypes
	}
	if (ds.assayAvailability) {
		ds2.assayAvailability = 1
	}

	if (ds.cohort && ds.cohort.sampleAttribute) {
		// attr may be hidden from client
		const toclient = {}
		for (const k in ds.cohort.sampleAttribute.attributes) {
			const a = ds.cohort.sampleAttribute.attributes[k]
			if (!a.clientnoshow) toclient[k] = a
		}
		ds2.sampleAttribute = { attributes: toclient }
	}

	if (ds.cohort) {
		if (ds.cohort.termdb) {
			// let client know the existance, do not reveal details unless needed
			ds2.termdb = {
				selectCohort: ds.cohort.termdb.selectCohort
			}
		}

		if (ds.cohort.attributes && ds.cohort.attributes.defaulthidden) {
			/*
            .attributes.lst[] are not released to client
            default hidden attributes from sample annotation, tell client
            */
			ds2.cohortHiddenAttr = ds.cohort.attributes.defaulthidden
		}

		if (ds.cohort.survivalplot) {
			ds2.survivalplot = {
				samplegroupattrlst: ds.cohort.survivalplot.samplegroupattrlst,
				plots: []
			}
			for (const k in ds.cohort.survivalplot.plots) {
				const p = ds.cohort.survivalplot.plots[k]
				ds2.survivalplot.plots.push({
					key: k,
					name: p.name,
					timelabel: p.timelabel
				})
			}
		}

		if (ds.cohort.mutation_signature) {
			const sets = {}
			for (const k in ds.cohort.mutation_signature.sets) {
				const s = ds.cohort.mutation_signature.sets[k]
				sets[k] = {
					name: s.name,
					signatures: s.signatures
				}
			}
			ds2.mutation_signature = { sets: sets }
		}
	}

	for (const k in ds.queries) {
		const q = ds.queries[k]

		const clientquery: any = {
			// revealed to client
			name: q.name,
			hideforthemoment: q.hideforthemoment // hide track not ready to show on client
		}

		if (q.istrack) {
			clientquery.istrack = true
			clientquery.type = q.type
			clientquery.isfull = q.isfull
			// track attributes, some are common, many are track type-specific
			if (q.nochr != undefined) {
				clientquery.nochr = q.nochr
			}
			if (q.infoFilter) {
				clientquery.infoFilter = q.infoFilter
			}
			// junction attributes
			if (q.readcountCutoff) {
				clientquery.readcountCutoff = q.readcountCutoff
			}
			// cnv attributes
			if (q.valueLabel) {
				clientquery.valueLabel = q.valueLabel
			}
			if (q.valueCutoff) {
				clientquery.valueCutoff = q.valueCutoff
			}
			if (q.bplengthUpperLimit) {
				clientquery.bplengthUpperLimit = q.bplengthUpperLimit
			}
			// loh attributes
			if (q.segmeanValueCutoff) {
				clientquery.segmeanValueCutoff = q.segmeanValueCutoff
			}
			if (q.lohLengthUpperLimit) {
				clientquery.lohLengthUpperLimit = q.lohLengthUpperLimit
			}

			if (q.type == common.tkt.mdssvcnv) {
				if (q.groupsamplebyattr) {
					clientquery.groupsamplebyattr = q.groupsamplebyattr
				}

				// flags
				clientquery.multihidelabel_fusion = q.multihidelabel_fusion
				clientquery.multihidelabel_sv = q.multihidelabel_sv
				clientquery.multihidelabel_vcf = q.multihidelabel_vcf
				clientquery.showfullmode = q.showfullmode
				clientquery.legend_vorigin = q.legend_vorigin
				clientquery.no_loh = q.no_loh // quick dirty fix

				if (q.expressionrank_querykey) {
					// for checking expression rank
					const e = ds.queries[q.expressionrank_querykey]
					clientquery.checkexpressionrank = {
						querykey: q.expressionrank_querykey,
						datatype: e.datatype
					}
					if (e.boxplotbysamplegroup && e.boxplotbysamplegroup.additionals) {
						// quick fix!!
						// array element 0 is boxplotbysamplegroup.attributes
						// rest of array, one ele for each of .additionals
						const lst: any[] = []
						if (e.boxplotbysamplegroup.attributes)
							lst.push(e.boxplotbysamplegroup.attributes.map(i => i.label).join(', '))
						for (const i of e.boxplotbysamplegroup.additionals) lst.push(i.label)
						clientquery.checkexpressionrank.boxplotgroupers = lst
					}
				}
				if (q.vcf_querykey) {
					clientquery.checkvcf = {
						querykey: q.vcf_querykey,
						info: ds.queries[q.vcf_querykey].info,
						format: {}
					}
					for (const tk of ds.queries[q.vcf_querykey].tracks) {
						if (tk.format) {
							for (const k in tk.format) {
								clientquery.checkvcf.format[k] = tk.format[k]
							}
						}
					}
				}
			}
		} else if (q.isgenenumeric) {
			clientquery.isgenenumeric = true
			clientquery.datatype = q.datatype
			clientquery.no_ase = q.no_ase
		} else {
			// this query is not to be revealed to client
			continue
		}

		ds2.queries[k] = clientquery
	}
	return ds2
}

function copy_legacyDataset(ds) {
	const ds2: any = {
		noHandleOnClient: ds.noHandleOnClient,
		sampleselectable: ds.sampleselectable,
		label: ds.label,
		dsinfo: ds.dsinfo,
		stratify: ds.stratify,
		cohort: ds.cohort,
		vcfinfofilter: ds.vcfinfofilter,
		info2table: ds.info2table,
		info2singletable: ds.info2singletable,
		url4variant: ds.url4variant,
		itemlabelname: ds.itemlabelname
	}

	if (ds.snvindel_attributes) {
		ds2.snvindel_attributes = []
		for (const at of ds.snvindel_attributes) {
			const rep: any = {}
			for (const k in at) {
				if (k == 'lst') {
					rep.lst = []
					for (const e of at.lst) {
						const rep2 = {}
						for (const k2 in e) rep2[k2] = e[k2]
						rep.lst.push(rep2)
					}
				} else {
					rep[k] = at[k]
				}
			}
			ds2.snvindel_attributes.push(rep)
		}
	}
	if (ds.snvindel_legend) {
		ds2.snvindel_legend = ds.snvindel_legend
	}
	const vcfinfo: any = {}
	let hasvcf = false
	for (const q of ds.queries) {
		if (q.vcf) {
			hasvcf = true
			vcfinfo[q.vcf.vcfid] = q.vcf
		}
	}
	if (hasvcf) {
		ds2.id2vcf = vcfinfo
	}
	return ds2
}

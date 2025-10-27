import fs from 'fs'
import path from 'path'
import * as child_process from 'child_process'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { parse_textfilewithheader } from './parse_textfilewithheader.js'
import { server_updateAttr } from './dsUpdateAttr.js'

const tabix = serverconfig.tabix
// const samtools = serverconfig.samtools
// const bcftools = serverconfig.bcftools
// const bigwigsummary = serverconfig.bigwigsummary
// const hicstraw = serverconfig.hicstraw

export async function mds_init(ds, genome, rawds) {
	/*
    ds: loaded from datasets/what.js
    genome: obj {}
    */

	if (ds.assayAvailability) {
		if (!ds.assayAvailability.file) throw '.assayAvailability.file missing'
		if (!ds.assayAvailability.assays) throw '.assayAvailability.assays[] missing'
		Object.freeze(ds.assayAvailability.assays)
		ds.assayAvailability.samples = new Map()
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, ds.assayAvailability.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			const [sample, t] = line.split('\t')
			ds.assayAvailability.samples.set(sample, JSON.parse(t))
		}
		console.log(ds.assayAvailability.samples.size + ' samples with assay availability (' + ds.label + ')')
	}

	if (ds.gene2mutcount) {
		if (!ds.gene2mutcount.dbfile) throw '.gene2mutcount.dbfile missing'
		try {
			console.log('Connecting', ds.gene2mutcount.dbfile)
			ds.gene2mutcount.db = utils.connect_db(ds.gene2mutcount.dbfile)
			console.log('DB connected for ' + ds.label + ': ' + ds.gene2mutcount.dbfile)
		} catch (e) {
			throw `Error connecting db at ${ds.gene2mutcount.dbfile}` //fix for inspecific error message
		}
	}

	if (ds.sampleAssayTrack) {
		if (!ds.sampleAssayTrack.file) throw '.file missing from sampleAssayTrack'
		ds.sampleAssayTrack.samples = new Map()

		let count = 0

		let unannotated = new Set()

		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, ds.sampleAssayTrack.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue

			const [sample, assay, jsontext] = line.split('\t')
			if (!assay || !jsontext) continue

			if (!ds.sampleAssayTrack.samples.has(sample)) {
				// new sample
				if (ds.cohort && ds.cohort.annotation) {
					if (!ds.cohort.annotation[sample]) {
						// this sample is unannotated
						unannotated.add(sample)
						continue
					}
				}

				ds.sampleAssayTrack.samples.set(sample, [])
			}

			const tk = JSON.parse(jsontext)
			// TODO validate track
			if (!common.tkt[tk.type]) throw 'invalid type from a sample track: ' + jsontext
			if (!tk.name) {
				tk.name = sample + ' ' + assay
			}

			tk.assayName = assay

			ds.sampleAssayTrack.samples.get(sample).push(tk)
			count++
		}

		console.log(count + ' assay-tracks from ' + ds.sampleAssayTrack.samples.size + ' samples (' + ds.label + ')')
		if (unannotated.size) {
			console.log(
				'Error: ' + unannotated.size + ' samples with assay tracks are unannotated: ' + [...unannotated].join(' ')
			)
		}
	}

	if (ds.singlesamplemutationjson) {
		const m = ds.singlesamplemutationjson
		if (!m.file) throw '.file missing from singlesamplemutationjson'
		m.samples = {}
		let count = 0
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, m.file), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue
			const [sample, file] = line.split('\t')
			if (sample && file) {
				count++
				m.samples[sample] = file
			}
		}
		console.log(count + ' samples for disco plot')
	}

	if (ds.cohort && ds.cohort.files) {
		/*
        *********** legacy mds *************

        following all loads sample attributes from text files
        and store in ds.cohort.annotation
        */

		if (!Array.isArray(ds.cohort.files)) throw '.cohort.files is not array'

		if (!ds.cohort.tohash) throw '.tohash() missing from cohort'
		if (typeof ds.cohort.tohash != 'function') throw '.cohort.tohash is not function'
		if (!ds.cohort.samplenamekey) throw '.samplenamekey missing'

		// should allow both sample/individual level as key
		ds.cohort.annotation = {}

		if (ds.cohort.mutation_signature) {
			const s = ds.cohort.mutation_signature
			if (!s.sets) throw '.mutation_signature.sets missing'
			for (const k in s.sets) {
				const ss = s.sets[k]
				if (!ss.name) ss.name = k
				if (!ss.signatures) throw '.signatures{} missing from a signature set'
				if (ss.samples) {
					if (!ss.samples.file) throw '.samples.file missing from a signature set'
					const [err, items] = parse_textfilewithheader(
						fs.readFileSync(path.join(serverconfig.tpmasterdir, ss.samples.file), { encoding: 'utf8' }).trim()
					)
					ss.samples.map = new Map()
					for (const i of items) {
						const sample = i[ds.cohort.samplenamekey]
						if (!sample) throw ds.cohort.samplenamekey + ' missing in file ' + ss.samples.file
						ss.samples.map.set(sample, i)

						// parse to float
						for (const sk in ss.signatures) {
							if (i[sk]) {
								const v = Number.parseFloat(i[sk])
								if (Number.isNaN(v)) throw 'mutation signature value is not float: ' + i[sk] + ' from sample ' + sample
								if (ss.samples.skipzero && v == 0) {
									delete i[sk]
								} else {
									i[sk] = v
								}
							}
						}
					}
				}
			}
		}

		if (ds.cohort.attributes) {
			if (!ds.cohort.attributes.lst) throw '.lst[] missing for cohort.attributes'
			if (!Array.isArray(ds.cohort.attributes.lst)) return '.cohort.attributes.lst is not array'
			for (const attr of ds.cohort.attributes.lst) {
				if (!attr.key) throw '.key missing from one of the .cohort.attributes.lst[]'
				if (!attr.label) throw '.label missing from one of the .cohort.attributes.lst[]'
				if (!attr.values) throw '.values{} missing from ' + attr.label + ' of .cohort.attributes.lst'
				for (const value in attr.values) {
					if (!attr.values[value].label)
						throw '.label missing from one value of ' + attr.label + ' in .cohort.attributes.lst'
				}
			}
			if (ds.cohort.attributes.defaulthidden) {
				// allow attributes hidden by default
				for (const key in ds.cohort.attributes.defaulthidden) {
					const hideattr = ds.cohort.attributes.lst.find(i => i.key == key)
					if (!hideattr) throw 'invalid defaulthidden key: ' + key
					for (const value in ds.cohort.attributes.defaulthidden[key]) {
						if (!hideattr.values[value]) throw 'invalid defaulthidden value ' + value + ' for ' + key
					}
				}
			}
		}

		if (ds.cohort.hierarchies) {
			if (!ds.cohort.hierarchies.lst) throw '.lst[] missing from .cohort.hierarchies'
			if (!Array.isArray(ds.cohort.hierarchies.lst)) throw '.cohort.hierarchies.lst is not array'
			for (const h of ds.cohort.hierarchies.lst) {
				if (!h.name) throw '.name missing from one hierarchy'
				if (!h.levels) throw '.levels[] missing from one hierarchy'
				if (!Array.isArray(h.levels)) throw '.levels is not array from one hierarchy'
				for (const l of h.levels) {
					if (!l.k) throw '.k missing from one level in hierarchy ' + h.name
				}
			}
		}

		if (ds.cohort.sampleAttribute) {
			if (!ds.cohort.sampleAttribute.attributes) throw 'attributes{} missing from cohort.sampleAttribute'
			for (const key in ds.cohort.sampleAttribute.attributes) {
				const a = ds.cohort.sampleAttribute.attributes[key]
				if (!a.label) throw '.label missing for key ' + key + ' from cohort.sampleAttribute.attributes'
				if (a.values) {
					// optional
					for (const v in a.values) {
						const b = a.values[v]
						if (typeof b != 'object') throw 'value "' + v + '" not pointing to {} from sampleAttribute'
						if (!b.name) b.name = v
					}
				}
				if (a.showintrack) {
					if (!a.isinteger && !a.isfloat) throw a.label + ': .showintrack requires .isinteger or .isfloat'
				}
			}
		}

		if (ds.cohort.scatterplot) {
			if (!ds.cohort.sampleAttribute) throw '.sampleAttribute missing but required for .cohort.scatterplot'

			const sp = ds.cohort.scatterplot

			// querykey is required
			if (!sp.querykey) throw '.querykey missing from .cohort.scatterplot'
			{
				if (!ds.queries) throw '.cohort.scatterplot.querykey in use but ds.queries{} missing'
				const tk = ds.queries[sp.querykey]
				if (!tk) throw 'unknown query by .cohort.scatterplot.querykey: ' + sp.querykey
				if (tk.type != common.tkt.mdssvcnv)
					throw 'type is not ' + common.tkt.mdssvcnv + ' of the track pointed to by .cohort.scatterplot.querykey'
			}

			if (sp.colorbygeneexpression) {
				if (!sp.colorbygeneexpression.querykey) throw 'querykey missing from .cohort.scatterplot.colorbygeneexpression'
				if (!ds.queries) throw '.cohort.scatterplot.colorbygeneexpression in use but ds.queries{} missing'
				const tk = ds.queries[sp.colorbygeneexpression.querykey]
				if (!tk)
					throw (
						'unknown query by .cohort.scatterplot.colorbygeneexpression.querykey: ' + sp.colorbygeneexpression.querykey
					)
				if (!tk.isgenenumeric)
					throw 'isgenenumeric missing from the track pointed to by .cohort.scatterplot.colorbygeneexpression.querykey'
			}

			if (sp.tracks) {
				// a common set of tracks to be shown in single sample browser upon clicking a dot
				// must label them as custom otherwise they won't be listed
				// TODO validate the tracks
			}

			// TODO support multiple plots
			if (!sp.x) throw '.x missing from .cohort.scatterplot'
			if (!sp.x.attribute) throw '.attribute missing from .cohort.scatterplot.x'
			const x = ds.cohort.sampleAttribute.attributes[sp.x.attribute]
			if (!x) throw 'scatterplot.x.attribute is not defined in sampleAttribute'
			if (!x.isfloat) throw 'scatterplot.x is not "isfloat"'
			if (!sp.y) throw '.y missing from .cohort.scatterplot'
			if (!sp.y.attribute) throw '.attribute missing from .cohort.scatterplot.y'
			const y = ds.cohort.sampleAttribute.attributes[sp.y.attribute]
			if (!y) throw 'scatterplot.y.attribute is not defined in sampleAttribute'
			if (!y.isfloat) throw 'scatterplot.y is not "isfloat"'
			if (sp.colorbyattributes) {
				for (const attr of sp.colorbyattributes) {
					if (!attr.key) throw '.key missing from one of scatterplot.colorbyattributes'
					const attrreg = ds.cohort.sampleAttribute.attributes[attr.key]
					if (!attrreg) throw 'unknown attribute by key ' + attr.key + ' from scatterplot.colorbyattributes'
					attr.label = attrreg.label
					attr.values = attrreg.values
				}
			}
		}

		for (const file of ds.cohort.files) {
			if (!file.file) throw '.file missing from one of .cohort.files'
			const [err, items] = parse_textfilewithheader(
				fs.readFileSync(path.join(serverconfig.tpmasterdir, file.file), { encoding: 'utf8' }).trim()
			)
			if (err) throw 'cohort annotation file "' + file.file + '": ' + err
			//if(items.length==0) return 'no content from sample annotation file '+file.file
			console.log(ds.label + ': ' + items.length + ' samples loaded from annotation file ' + file.file)
			items.forEach(i => {
				// may need to parse certain values into particular format

				for (const k in i) {
					let attr
					if (ds.cohort.sampleAttribute) {
						attr = ds.cohort.sampleAttribute.attributes[k]
					}
					if (!attr) {
						if (ds.cohort.termdb && ds.cohort.termdb.termjson && ds.cohort.termdb.termjson.map) {
							attr = ds.cohort.termdb.termjson.map.get(k)
						}
					}
					if (attr) {
						if (attr.isfloat) {
							i[k] = Number.parseFloat(i[k])
						} else if (attr.isinteger) {
							i[k] = Number.parseInt(i[k])
						}
					}
				}

				ds.cohort.tohash(i, ds)
			})
		}
		ds.cohort.annorows = Object.values(ds.cohort.annotation)
		console.log(ds.label + ': total samples from sample table: ' + ds.cohort.annorows.length)

		if (ds.cohort.survivalplot) {
			// ds.cohort.annotation needs to be loaded for initing survival
			const sp = ds.cohort.survivalplot
			if (!sp.plots) throw '.plots{} missing from survivalplot'

			// make the object for initiating client
			sp.init = {
				plottypes: []
			}

			for (const k in sp.plots) {
				const p = sp.plots[k]
				if (!p.name) throw '.name missing from survivalplot ' + k
				if (!p.serialtimekey) throw '.serialtimekey missing from survivalplot ' + k
				if (!p.iscensoredkey) throw '.iscensoredkey missing from survivalplot ' + k
				if (!p.timelabel) throw '.timelabel missing from survivalplot ' + k
				p.key = k

				sp.init.plottypes.push({
					key: k,
					name: p.name,
					timelabel: p.timelabel
				})
			}

			if (sp.samplegroupattrlst) {
				sp.init.samplegroupings = []
				for (const a of sp.samplegroupattrlst) {
					if (!a.key) throw '.key missing from an attr of samplegroupattrlst for survival'

					const attr = ds.cohort.sampleAttribute.attributes[a.key]
					if (!attr) throw 'unknown attribute key "' + a.key + '" from survival samplegroupattrlst'

					const value2count = new Map()
					for (const samplename in ds.cohort.annotation) {
						const sobj = ds.cohort.annotation[samplename]
						const v = sobj[a.key]
						if (v == undefined) {
							// sample not annotated by it
							continue
						}

						let hasoutcome = false
						// if the sample has info in any plot, will count it
						for (const k in sp.plots) {
							if (sobj[sp.plots[k].serialtimekey] != undefined) {
								hasoutcome = true
								break
							}
						}

						if (hasoutcome) {
							if (value2count.has(v)) {
								value2count.set(v, value2count.get(v) + 1)
							} else {
								value2count.set(v, 1)
							}
						}
					}
					if (value2count.size == 0) throw 'no value found for "' + a.key + '" from survival samplegroupattrlst'

					const lst = []
					for (const [v, c] of value2count) {
						lst.push({ value: v, count: c })
					}
					sp.init.samplegroupings.push({
						key: a.key,
						label: attr.label,
						values: lst
					})
				}
			}
		}
	}

	if (ds.mutationAttribute) {
		/*
        mutation-level attributes
        for items in svcnv track:
        	.mattr{}
        for vcf:
        	FORMAT
        */
		if (!ds.mutationAttribute.attributes) throw 'attributes{} missing from mutationAttribute'
		for (const key in ds.mutationAttribute.attributes) {
			const a = ds.mutationAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from mutationAttribute.attributes'
			if (a.appendto_link) {
				// this is pmid, no .values{}
				continue
			}
			if (a.values) {
				for (const v in a.values) {
					const b = a.values[v]
					if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from mutationAttribute.attributes'
				}
			} else {
				// allow values{} missing
			}
		}
	}

	if (ds.alleleAttribute) {
		/*
        vcf info field, allele-level
        */
		if (!ds.alleleAttribute.attributes) throw 'attributes{} missing from alleleAttribute'
		for (const key in ds.alleleAttribute.attributes) {
			const a = ds.alleleAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from alleleAttribute.attributes'
			if (a.isnumeric) {
				continue
			}
			// not numeric value
			if (!a.values) throw '.values{} missing for non-numeric key ' + key + ' from alleleAttribute.attributes'
			for (const v in a.values) {
				const b = a.values[v]
				if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from alleleAttribute.attributes'
			}
		}
	}

	if (ds.locusAttribute) {
		/*
        vcf info field, locus-level
        */
		if (!ds.locusAttribute.attributes) throw 'attributes{} missing from locusAttribute'
		for (const key in ds.locusAttribute.attributes) {
			const a = ds.locusAttribute.attributes[key]
			if (!a.label) throw '.label missing for key ' + key + ' from locusAttribute.attributes'
			if (a.isnumeric) {
				continue
			}
			if (a.appendto_link) {
				// no .values{}
				continue
			}
			// not numeric value
			if (!a.values) throw '.values{} missing for non-numeric key ' + key + ' from locusAttribute.attributes'
			for (const v in a.values) {
				const b = a.values[v]
				if (!b.name) throw '.name missing for value ' + v + ' of key ' + key + ' from locusAttribute.attributes'
			}
		}
	}

	if (ds.queries) {
		// ds.queries is the 1st generation track

		for (const querykey in ds.queries) {
			// server may choose to remove it
			if (rawds.remove_queries && rawds.remove_queries.indexOf(querykey) != -1) {
				delete ds.queries[querykey]
				continue
			}

			const query = ds.queries[querykey]

			// server may choose to hide some queries
			if (rawds.hide_queries && rawds.hide_queries.indexOf(querykey) != -1) {
				// this query will be hidden on client
				query.hideforthemoment = 1
			}

			if (query.istrack) {
				if (!query.type) throw '.type missing for track query ' + querykey

				if (query.viewrangeupperlimit) {
					if (!Number.isInteger(query.viewrangeupperlimit))
						throw '.viewrangeupperlimit should be integer for track query ' + querykey
				}

				if (query.type == common.tkt.mdsjunction) {
					const err = mds_init_mdsjunction(query, ds, genome)
					if (err) throw querykey + ' (mdsjunction) error: ' + err
				} else if (query.type == common.tkt.mdscnv) {
					// obsolete

					const err = mds_init_mdscnv(query, ds, genome)
					if (err) throw querykey + ' (mdscnv) error: ' + err
				} else if (query.type == common.tkt.mdssvcnv) {
					// replaces mdscnv

					const err = mds_init_mdssvcnv(query, ds, genome)
					if (err) throw querykey + ' (svcnv) error: ' + err
				} else if (query.type == common.tkt.mdsvcf) {
					// snvindel

					const err = await mds_init_mdsvcf(query, ds, genome)
					if (err) throw querykey + ' (vcf) error: ' + err
				} else {
					throw 'unknown track type for a query: ' + query.type + ' ' + querykey
				}

				mds_mayPrecompute_grouptotal(query, ds)
			} else if (query.isgenenumeric) {
				const err = mds_init_genenumeric(query, ds, genome)
				if (err) throw querykey + ' (genenumeric) error: ' + err
			} else {
				throw 'unknown type of query from ' + querykey
			}
		}
	}

	if (ds.annotationsampleset2matrix) {
		if (!ds.cohort) throw 'ds.cohort misssing when annotationsampleset2matrix is in use'
		if (!ds.cohort.annotation) throw 'ds.cohort.annotation misssing when annotationsampleset2matrix is in use'
		if (!ds.queries) throw 'ds.queries misssing when annotationsampleset2matrix is in use'
		if (!ds.annotationsampleset2matrix.key) throw '.key STR missing in annotationsampleset2matrix'
		if (!ds.annotationsampleset2matrix.groups) throw '.groups{} missing in annotationsampleset2matrix'
		if (typeof ds.annotationsampleset2matrix.groups != 'object')
			throw 'ds.annotationsampleset2matrix.groups{} not an object'
		for (const groupvalue in ds.annotationsampleset2matrix.groups) {
			const thisgroup = ds.annotationsampleset2matrix.groups[groupvalue]
			// a group will have 1 or more smaller groups, each is samples from a study
			if (!thisgroup.groups || !Array.isArray(thisgroup.groups) || thisgroup.groups.length == 0)
				throw '.groups[] must be nonempty array in ' + groupvalue
			for (const group of thisgroup.groups) {
				if (!group.name) throw '.name missing from one of .groups[] in ' + groupvalue
				const smat = group.matrixconfig
				if (!smat) throw '.matrixconfig missing from one of .groups[] of ' + groupvalue
				if (!smat.features) throw '.features[] missing from group ' + groupvalue
				if (!Array.isArray(smat.features)) throw '.features[] should be array from group ' + groupvalue
				if (smat.features.length == 0) throw '.features[] zero length from group ' + groupvalue
				for (const feature of smat.features) {
					if (ds.annotationsampleset2matrix.commonfeatureattributes) {
						// apply common attributes to each feature
						for (const k in ds.annotationsampleset2matrix.commonfeatureattributes) {
							// not to overwrite predefined value
							if (feature[k] == undefined) {
								feature[k] = ds.annotationsampleset2matrix.commonfeatureattributes[k]
							}
						}
					}
					if (feature.ismutation) {
						if (!feature.position)
							throw 'position missing from feature ' + JSON.stringify(feature) + ' from group ' + groupvalue
						if (!feature.querykeylst) throw '.querykeylst[] missing from ismutation feature from group ' + groupvalue
						if (!Array.isArray(feature.querykeylst))
							throw '.querykeylst[] not an array from ismutation feature from group ' + groupvalue
						if (feature.querykeylst.length == 0)
							throw '.querykeylst[] zero length from ismutation feature from group ' + groupvalue
						for (const querykey of feature.querykeylst) {
							if (!ds.queries[querykey])
								throw 'unknown query key "' + querykey + '" from ismutation feature of group ' + groupvalue
						}
						continue
					}
					return 'unknown feature type from group ' + groupvalue
				}
				if (!smat.limitsamplebyeitherannotation)
					throw '.limitsamplebyeitherannotation[] missing from group ' + groupvalue
				if (!Array.isArray(smat.limitsamplebyeitherannotation))
					throw '.limitsamplebyeitherannotation[] should be array from group ' + groupvalue
				if (smat.limitsamplebyeitherannotation.length == 0)
					throw '.limitsamplebyeitherannotation[] zero length from group ' + groupvalue
				for (const lim of smat.limitsamplebyeitherannotation) {
					if (!lim.key) throw 'key missing from one of limitsamplebyeitherannotation from group ' + groupvalue
					if (!lim.value) throw 'value missing from one of limitsamplebyeitherannotation from group ' + groupvalue
				}
			}
		}
		delete ds.annotationsampleset2matrix.commonfeatureattributes
	}
}

function mds_mayPrecompute_grouptotal(query, ds) {
	if (!query.groupsamplebyattr) return
	query.groupsamplebyattr.key2group = new Map()
	for (const samplename in ds.cohort.annotation) {
		mdssvcnv_grouper(samplename, [], query.groupsamplebyattr.key2group, [], ds, query)
	}
}

function mds_init_mdsjunction(query, ds, genome) {
	// mdsjunction only allows single track

	if (query.readcountCutoff) {
		if (!Number.isInteger(query.readcountCutoff) || query.readcountCutoff < 1)
			return 'readcountCutoff must be positive integer'
	}

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		query.file = tmp // replace with full path
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for mdsjunction ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const lines = header.split('\n')
		if (lines.length != 1) return 'mdsjunction file has multiple header lines (begin with #), but should have just 1'
		const lst = lines[0].split('\t')
		// #chr \t start \t stop \t strand \t type \t samples ...
		if (lst[5]) {
			query.samples = lst.slice(5)
			query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
			query.hierarchySummary = mds_query_hierarchy4samples(query.samples, ds)
			for (const name in query.hierarchySummary) {
				let levelcount = 0
				for (const k in query.hierarchySummary[name]) levelcount++
				console.log(levelcount + ' ' + name + ' hierarchy levels for ' + query.name)
			}
		}
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	console.log(
		'(mdsjunction) ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 0) +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)

	if (!query.infoFilter) return '.infoFilter{} missing'
	if (!query.infoFilter.lst) return '.lst[] missing from .infoFilter'
	// currently infoFilter contains Type (column 5) and splice events, both are categorical
	for (const info of query.infoFilter.lst) {
		if (!info.key) return '.key missing from one of infoFilter'
		if (!info.label) return '.label missing from one of infoFilter'
		if (!info.categories) return '.categories missing from one of infoFilter'
		for (const k in info.categories) {
			if (!info.categories[k].label) return '.label missing from one category of ' + info.label
			if (!info.categories[k].color) return '.color missing from on category of ' + info.label
		}
		if (info.hiddenCategories) {
			// allow initially hidden categories
			for (const k in info.hiddenCategories) {
				if (!info.categories[k]) return 'invalid hidden key ' + k + ' of ' + info.label
			}
		} else {
			info.hiddenCategories = {}
		}
	}

	if (!query.singlejunctionsummary) return '.singlejunctionsummary missing but is currently required from ' + query.name
	if (query.singlejunctionsummary.readcountboxplotpercohort) {
		if (!query.singlejunctionsummary.readcountboxplotpercohort.groups)
			return '.groups[] missing from query.singlejunctionsummary.readcountboxplotpercohort for ' + query.name
		for (const g of query.singlejunctionsummary.readcountboxplotpercohort.groups) {
			if (!g.key) return '.key missing from one group of query.singlejunctionsummary.readcountboxplotpercohort.groups'
			if (!g.label)
				return '.label missing from one group of query.singlejunctionsummary.readcountboxplotpercohort.groups'
		}
	}
}

function mds_query_attrsum4samples(samples, ds) {
	/*
    summarizes a group of samples by list of attributes in ds.cohort.attributes.lst[]

    a query from mds has total list of samples, e.g. samples in mdsjunction represent those with RNA-seq
    for these samples, will sum up .totalCount for cohort annotation attributes/values (by ds.cohort.attributes)
    rather than computing .totalCount over all samples of the ds.cohort, so as to limit to relevant assays
    so on cohortFilter legend it will only show totalCount from those samples with RNA-seq etc
    */
	if (!ds.cohort || !ds.cohort.annotation || !ds.cohort.attributes || !samples) return

	const result = {}
	for (const attr of ds.cohort.attributes.lst) {
		// TODO numeric attribute?

		const v2c = {}
		for (const value in attr.values) {
			v2c[value] = 0
		}
		// go over samples look for this attribute
		for (const sample of samples) {
			const anno = ds.cohort.annotation[sample]
			if (!anno) {
				// this sample has no annotation
				continue
			}
			const thisvalue = anno[attr.key]
			if (thisvalue == undefined) {
				// this sample not annotated by this attribute
				continue
			}
			if (thisvalue in v2c) {
				v2c[thisvalue]++
			}
		}
		result[attr.key] = v2c
	}
	return result
}

function mds_query_hierarchy4samples(samples, ds) {
	/*
    given a list of sample names, generate hierarchy summary

    	key: hierarchy path (HM...BALL...ERG)
    	value: number of samples

    works for both initializing the sample sets from each ds query, and also for samples in view range in real-time track query
    */
	if (!ds.cohort || !ds.cohort.annotation || !ds.cohort.hierarchies || samples.length == 0) return
	const lst = []
	for (const n of samples) {
		const a = ds.cohort.annotation[n]
		if (!a) continue
		lst.push(a)
	}

	const results = {}

	for (const hierarchy of ds.cohort.hierarchies.lst) {
		const nodes = stratinput(lst, hierarchy.levels)
		const root = d3stratify()(nodes)
		root.sum(i => i.value)
		const id2count = {}
		root.eachBefore(i => {
			id2count[i.id] = i.value
		})
		results[hierarchy.name] = id2count
	}
	return results
}

function mds_init_mdscnv(query, ds, genome) {
	// mdscnv only allows single track

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for (mdscnv) ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const lines = header.split('\n')
		if (lines.length != 1) return 'mdscnv file has multiple header lines (begin with #), but should have just 1'
		const lst = lines[0].split('\t')
		query.samples = lst.slice(5)
		query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
		query.hierarchySummary = mds_query_hierarchy4samples(query.samples, ds)
		for (const name in query.hierarchySummary) {
			let levelcount = 0
			for (const k in query.hierarchySummary[name]) levelcount++
			console.log(levelcount + ' ' + name + ' hierarchy levels for ' + query.name)
		}
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	console.log(
		'(' +
			query.type +
			') ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 'no') +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)
}

function mds_init_mdssvcnv(query, ds, genome) {
	// only allows single track, since there is no challenge merging multiple into one

	let cwd = null
	let _file

	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else if (query.url) {
		// TODO cache_index sync
		// need to set query.usedir to cache path
		_file = query.url
	} else {
		return 'no file or url given for (svcnv) ' + query.name
	}

	const arg = { encoding: 'utf8' }
	if (cwd) {
		arg.cwd = cwd
	}

	const header = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
	if (header) {
		// has header, get samples
		const set = new Set()
		for (const line of header.split('\n')) {
			for (const s of line.split(' ').slice(1)) {
				set.add(s)
			}
		}
		if (set.size == 0) return 'no samples from the header line'
		query.samples = [...set]

		if (ds.cohort && ds.cohort.annotation) {
			// find & report unannotated samples
			const unknown = new Set()
			for (const sample of query.samples) {
				if (!ds.cohort.annotation[sample]) {
					unknown.add(sample)
				}
			}
			if (unknown.size) {
				console.log(
					'mdssvcnv unannotated samples: ' + (query.noprintunannotatedsamples ? unknown.size : [...unknown].join(' '))
				)
			}
		}

		/*
        // not used at the moment
        query.attributeSummary = mds_query_attrsum4samples(query.samples, ds)
        query.hierarchySummary = mds_query_hierarchy4samples(query.samples,ds)
        for(const hierarchyname in query.hierarchySummary) {
        	let levelcount=0
        	for(const k in query.hierarchySummary[ hierarchyname ]) levelcount++
        	console.log(levelcount+' '+hierarchyname+' hierarchy levels for '+query.name)
        }
        */
	}

	{
		const tmp = child_process.execSync(tabix + ' -l ' + _file, arg).trim()
		if (!tmp) return 'no chromosomes found'
		query.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
	}

	if (query.expressionrank_querykey) {
		// check expression rank, data from another query
		const thatquery = ds.queries[query.expressionrank_querykey]
		if (!thatquery) return 'invalid key by expressionrank_querykey'
		if (!thatquery.isgenenumeric) return 'query ' + query.expressionrank_querykey + ' not tagged as isgenenumeric'
	}

	if (query.vcf_querykey) {
		// check expression rank, data from another query
		const thatquery = ds.queries[query.vcf_querykey]
		if (!thatquery) return 'invalid key by vcf_querykey'
		if (thatquery.type != common.tkt.mdsvcf) return 'query ' + query.vcf_querykey + ' not of mdsvcf type'
	}

	if (query.groupsamplebyattr) {
		if (!query.groupsamplebyattr.attrlst) return '.attrlst[] missing from groupsamplebyattr'
		if (query.groupsamplebyattr.attrlst.length == 0) return 'groupsamplebyattr.attrlst[] empty array'
		if (!ds.cohort) return 'groupsamplebyattr in use but ds.cohort missing'
		if (!ds.cohort.annotation) return 'groupsamplebyattr in use but ds.cohort.annotation missing'
		if (!ds.cohort.sampleAttribute) {
			ds.cohort.sampleAttribute = {}
		}
		if (!ds.cohort.sampleAttribute.attributes) {
			ds.cohort.sampleAttribute.attributes = {}
			console.log('cohort.sampleAttribute added when groupsamplebyattr is in use')
		}
		for (const attr of query.groupsamplebyattr.attrlst) {
			if (!attr.k) return 'k missing from one of groupsamplebyattr.attrlst[]'
			if (!ds.cohort.sampleAttribute.attributes[attr.k]) {
				ds.cohort.sampleAttribute.attributes[attr.k] = {
					label: attr.label || attr.k
				}
			}
		}
		if (query.groupsamplebyattr.sortgroupby) {
			if (!query.groupsamplebyattr.sortgroupby.key) return '.key missing from .sortgroupby'
			if (!query.groupsamplebyattr.sortgroupby.order) return '.order[] missing from .sortgroupby'
			if (!Array.isArray(query.groupsamplebyattr.sortgroupby.order)) return '.order must be an array'
			// values of order[] is not validated
		}
		if (!query.groupsamplebyattr.attrnamespacer) query.groupsamplebyattr.attrnamespacer = ', '
	}

	console.log(
		'(' +
			query.type +
			') ' +
			query.name +
			': ' +
			(query.samples ? query.samples.length : 'no') +
			' samples, ' +
			(query.nochr ? 'no "chr"' : 'has "chr"')
	)
}

function mds_init_genenumeric(query, ds, genome) {
	if (!query.datatype) return 'datatype missing'
	if (query.viewrangeupperlimit) {
		if (Number.isNaN(query.viewrangeupperlimit)) return 'invalid value for viewrangeupperlimit'
	}

	let cwd = null
	let _file
	if (query.file) {
		const [err, tmp] = validate_tabixfile(query.file)
		if (err) return 'tabix file error: ' + err
		_file = tmp
	} else {
		// no url support yet
		return 'file missing'
	}

	const arg = { cwd: cwd, encoding: 'utf8' }

	{
		const tmp = child_process.execSync(tabix + ' -H ' + _file, arg).trim()
		if (!tmp) return 'no header line (#sample <sample1> ...)'
		// allow multiple # lines
		const set = new Set()
		for (const line of tmp.split('\n')) {
			const l = line.split(' ')
			for (let i = 1; i < l.length; i++) {
				set.add(l[i])
			}
		}
		if (set.size == 0) return 'no sample names from header line'
		query.samples = [...set]
		console.log('(genenumeric) ' + query.name + ': ' + query.samples.length + ' samples')
	}
	if (query.boxplotbysamplegroup) {
		if (!query.boxplotbysamplegroup.attributes) return 'boxplotbysamplegroup.attributes missing'
		if (!Array.isArray(query.boxplotbysamplegroup.attributes)) return 'boxplotbysamplegroup.attributes should be array'
		for (const a of query.boxplotbysamplegroup.attributes) {
			if (!a.k) return 'k missing from one of boxplotbysamplegroup.attributes[]'
		}
	}
}

async function mds_init_mdsvcf(query, ds, genome) {
	/*
    mixture of snv/indel (vcf), ITD, and others
    that are not either cnv or sv
    has member tracks, each track of one type of data
    */

	if (!query.tracks) return 'tracks[] missing'
	if (!Array.isArray(query.tracks)) return 'tracks should be array'

	/*
    info from all member tracks are merged, this requires the same info shared across multiple tracks must be identical
    */
	query.info = {}

	for (const tk of query.tracks) {
		if (!tk.file) return 'file missing from a track (url not supported yet)'

		// will set tk.cwd for url

		const [err, _file] = validate_tabixfile(tk.file)
		if (err) return 'tabix file error: ' + err

		if (tk.type == common.mdsvcftype.vcf) {
			const arg = { cwd: tk.cwd, encoding: 'utf8' }

			const tmp = await utils.get_header_tabix(_file, tk.cwd)
			if (tmp.length == 0) return 'no meta/header lines for ' + _file
			const [info, format, samples, errs] = vcf.vcfparsemeta(tmp)
			if (errs) return 'error parsing vcf meta for ' + _file + ': ' + errs.join('\n')

			if (samples.length == 0) return 'vcf file has no sample: ' + _file

			for (const k in info) {
				query.info[k] = info[k]
			}

			tk.format = format

			if (tk.samplenameconvert) {
				if (typeof tk.samplenameconvert != 'function') return '.samplenameconvert must be function'
				for (const s of samples) {
					s.name = tk.samplenameconvert(s.name)
				}
			}

			tk.samples = samples
		} else {
			return 'invalid track type: ' + tk.type
		}

		if (ds.cohort && ds.cohort.annotation) {
			/*
            ds.cohort.annotation is sample-level, e.g. tumor
            if vcf encodes germline stuff on person, or need some kind of sample name conversion,
            need to identify such in this track
            */
			const notannotated = []
			for (const s of tk.samples) {
				if (!ds.cohort.annotation[s.name]) {
					notannotated.push(s.name)
				}
			}
			if (notannotated.length) {
				console.log(ds.label + ': VCF ' + tk.file + ' has unannotated samples: ' + notannotated.join(','))
			}
		}

		{
			const tmp = []
			await utils.get_lines_bigfile({
				args: ['-l', _file],
				dir: tk.cwd,
				callback: line => {
					tmp.push(line)
				}
			})
			if (tmp.length == 0) return 'no chr from ' + _file
			tk.nochr = common.contigNameNoChr(genome, tmp)
		}

		console.log(
			'(' + query.type + ') ' + _file + ': ' + tk.samples.length + ' samples, ' + (tk.nochr ? 'no chr' : 'has chr')
		)
	}

	if (query.singlesamples) {
		if (!query.singlesamples.tablefile) return '.singlesamples.tablefile missing for the VCF query'
		query.singlesamples.samples = {}
		let count = 0
		for (const line of fs
			.readFileSync(path.join(serverconfig.tpmasterdir, query.singlesamples.tablefile), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			if (!line) continue
			if (line[0] == '#') continue
			const l = line.split('\t')
			if (l[0] && l[1]) {
				query.singlesamples.samples[l[0]] = l[1]
				count++
			}
		}
		console.log(count + ' single-sample VCF files')
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

function validate_tabixfile(file) {
	if (!file.endsWith('.gz')) return ['no .gz suffix (file should be compressed by bgzip)']
	const gzfile = path.join(serverconfig.tpmasterdir, file)
	if (!fs.existsSync(gzfile)) return ['.gz file not found']
	if (fs.existsSync(gzfile + '.tbi')) {
		// using tbi
		return [null, gzfile]
	}
	if (fs.existsSync(gzfile + '.csi')) {
		// using csi
		return [null, gzfile]
	}
	return ['.tbi/.csi index missing']
}

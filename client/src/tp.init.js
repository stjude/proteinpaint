import * as client from './client'
import vcf2dstk from './vcf.tkconvert'
import { bulkin } from './bulk.ui'
import { string2pos, invalidcoord } from './coord'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import * as common from '#shared/common.js'
import { getsjcharts } from './getsjcharts'

/*
parse and validate study configuration, including assays

********************** EXPORTED

tpinit()

loadstudycohort()



********************** INTERNAL

cohort2genometkset()
tidy_qtk()

*/

export function tpinit(cohort) {
	if (!cohort.p2st) {
		cohort.p2st = {}
	}
	if (!cohort.assays) {
		cohort.assays = []
	}
	if (!Array.isArray(cohort.assays)) {
		return '.assays should be an array'
	}

	/**********************
		 qc check assays
		 replace .assays with .assaylst
	**********************/

	cohort.assaylst = []
	let assaynum = 0
	for (const assayname of cohort.assays) {
		const rawassay = cohort[assayname]
		if (!rawassay) {
			return 'Assay "' + assayname + '" not found in cohort'
		}
		const config = rawassay.config
		if (!config) {
			return '.config object missing for assay "' + assayname + '"'
		}
		delete rawassay.config
		if (!config.type) {
			return '.config.type missing for assay "' + assayname + '"'
		}
		if (config.type.toLowerCase() == 'vcf') {
			config.type = client.tkt.ds
			config.isvcf = true
		} else {
			if (!common.validtkt(config.type)) {
				return 'unknown .config.type "' + config.type + '" for assay "' + assayname + '"'
			}
		}
		config.id = (++assaynum).toString()
		if (!config.name) {
			config.name = assayname
		}
		if (config.type == client.tkt.junction) {
			if (config.readcountcutoff) {
				if (!Number.isInteger(config.readcountcutoff) || config.readcountcutoff < 0) {
					return 'invalid .config.readcountcutoff for assay "' + assayname + '"'
				}
			}
		}
		cohort.assaylst.push(config)

		for (const pn in rawassay) {
			if (!cohort.p2st[pn]) {
				cohort.p2st[pn] = {}
			}
			for (const st in rawassay[pn]) {
				if (!cohort.p2st[pn][st]) {
					cohort.p2st[pn][st] = {
						tktemplate: []
					}
				}

				/*
				special cases, not singlar tk per sample
				not in use
				*/
				if (config.type == client.tkt.vafs1) {
					for (const name in rawassay[pn][st]) {
						const tk = rawassay[pn][st][name]
						if (!tk.file && !tk.url) {
							return 'no file or URL for ' + name + ' vafs1 of ' + pn + ', ' + st
						}
						tk.type = client.tkt.vafs1
						tk.patient = pn
						tk.sampletype = st
						tk.assayname = assayname
						tk.id = config.id
						tk.tkid = Math.random().toString()
						if (!tk.name) {
							tk.name = name + ' vaf'
						}
						cohort.p2st[pn][st].tktemplate.push(tk)
					}
					continue
				}

				/*
				common steps applied to common tk types
				allow to be array of multiple tracks, or a single track {}
				*/
				let rawtklst = []
				if (Array.isArray(rawassay[pn][st])) {
					// multiple tracks
					rawtklst = rawassay[pn][st]
				} else {
					// single
					rawtklst.push(rawassay[pn][st])
				}
				for (const _tk of rawtklst) {
					/*
					tk will be overwritten in case of vcf track
					*/
					let tk = _tk
					if (!tk.file && !tk.url) {
						return 'track has no file or url (sample: ' + pn + ', assay: ' + assayname + ')'
					}
					if (tk.name) {
						// keep name
					} else if (tk.partname) {
						// partname is provided as a short way to distinguish multiple tracks of same sample-assay
						tk.name = pn + (st == pn ? '' : ' ' + st) + ' ' + assayname + ' ' + tk.partname
					} else {
						// no name
						tk.name = pn + (st == pn ? '' : ' ' + st) + ' ' + assayname
					}
					if (config.isvcf) {
						const [err, tk2] = vcf2dstk({
							name: tk.name,
							file: tk.file,
							url: tk.url
						})
						if (err) {
							return 'VCF track error: ' + err
						}
						tk = tk2
					} else {
						/*
						by default, each tk will *inherit* config.type
						but allow the track to have its own type 
						*/
						if (tk.type) {
							if (!common.validtkt(tk.type)) {
								return 'invalid track type "' + tk.type + '" (sample: ' + pn + ', assay: ' + assayname + ')'
							}
						} else {
							tk.type = config.type
						}
					}
					tk.patient = pn
					tk.sampletype = st
					tk.assayname = assayname
					tk.id = config.id
					tk.tkid = Math.random().toString()
					cohort.p2st[pn][st].tktemplate.push(tk)

					// type-specific procedures
					switch (config.type) {
						case client.tkt.bigwig:
							const e = tidy_qtk(tk, config)
							if (e) {
								return 'Assay ' + assayname + ': ' + config.type + ' track error: ' + e
							}
							break
						case client.tkt.junction:
							tk.categories = config.categories
							tk.readcountcutoff = config.readcountcutoff
							break
					}
				}
			}
		}
	}
	delete cohort.assays

	{
		const err = cohort2genometkset(cohort)
		if (err) {
			return 'Error: ' + err
		}
	}

	/*******************
	   metadata, not in use
	********************/

	if (cohort.patientannotation) {
		const err = parse_patientannotation(cohort)
		if (err) return err
	}

	if (cohort.browserview) {
		const err = parse_browserview(cohort)
		if (err) return err
	}

	if (cohort.e2pca) {
		if (!cohort.e2pca.list) return '.list missing from e2pca'
		if (!Array.isArray(cohort.e2pca.list)) return 'e2pca.list should be an array'
		if (cohort.e2pca.list.length == 0) return 'e2pca.list[] length 0'
		if (!cohort.e2pca.label) {
			cohort.e2pca.label = 'Expression - PCA'
		}
		for (const obj of cohort.e2pca.list) {
			if (!obj.vectorfile) return 'vectorfile missing from e2pca'
			if (!obj.dbfile) return 'dbfile missing from e2pca'
		}
	}
	return
}

export function loadstudycohort(genomes, file, holder, hostURL, jwt, noshow, app) {
	/*
	tp entry point
	app.js calls this to load a study json file from server

	noshow will not call tpui, to load assay tracks only, to work with block view and make the tracks searchable there
	*/

	const wait = holder.append('div').style('color', '#858585')
	wait.text('Loading ' + file + ' ...')
	return fetch(hostURL + '/study', {
		method: 'POST',
		body: JSON.stringify({ file: file, jwt: jwt })
	})
		.then(res => res.json())
		.then(data => {
			if (!data) {
				wait.text('Server error!')
				return
			}
			if (data.error) {
				wait.text('Error loading study: ' + data.error)
				return
			}
			const cohort = data.cohort
			if (!cohort) {
				wait.text('.cohort missing')
				return
			}
			if (!cohort.genome) {
				wait.text('No genome specified in the cohort JSON content')
				return
			}
			const g = genomes[cohort.genome]
			if (!g) {
				wait.text('Invalid genome from cohort: ' + cohort.genome)
				return
			}

			cohort.genome = g
			cohort.jwt = jwt

			if (!data.flagset) {
				wait.text('.flagset missing')
				return
			}
			wait.text('')
			cohort.dsset = {}
			for (const k in data.flagset) {
				const flag = data.flagset[k]
				flag.genome = g
				bulkin({
					flag: flag,
					filename: file,
					cohort: cohort,
					err: m => client.sayerror(wait, m)
				})
			}
			const err = tpinit(cohort)
			if (err) {
				client.sayerror(wait, err)
			}

			if (!noshow) {
				return import('./tp.ui').then(async p => {
					getsjcharts().catch(console.error)
					p.default(cohort, holder, hostURL, app)
					return app
				})
			}
		})
}

function tidy_qtk(tk, config) {
	// bedgraph or bigwig
	if (!config) {
		config = {}
	}
	if (!tk.file && !tk.url) {
		return 'no file or url'
	}
	if (!tk.pcolor) {
		tk.pcolor = config.pcolor || '#0066CC'
	}
	if (!tk.pcolor2) {
		tk.pcolor2 = config.pcolor2 || '#CC0000'
	}
	if (!tk.ncolor) {
		tk.ncolor = config.ncolor || '#FF850A'
	}
	if (!tk.ncolor2) {
		tk.ncolor2 = config.ncolor2 || '#0A85FF'
	}
	if (!tk.height) {
		tk.height = config.height || 50
	}
	const scale = {}
	if (config.scale) {
		for (const k in config.scale) {
			scale[k] = config.scale[k]
		}
	}
	if (tk.scale) {
		// override
		for (const k in tk.scale) {
			scale[k] = tk.scale[k]
		}
	}
	// validate scale
	scale.auto = true
	if (Number.isFinite(scale.min) && Number.isFinite(scale.max)) {
		delete scale.auto
	} else if (Number.isFinite(scale.percentile)) {
		delete scale.auto
	}
	tk.scale = scale
}

function cohort2genometkset(cohort) {
	// cohort tracks register at genome tkset
	const lst = []

	// collect individual tracks
	for (const pn in cohort.p2st) {
		for (const st in cohort.p2st[pn]) {
			const templates = cohort.p2st[pn][st].tktemplate
			if (!templates) continue
			for (const t of templates) {
				lst.push(t)
			}
		}
	}
	// collect combined tracks
	if (cohort.browserview && cohort.browserview.assays) {
		for (const assayname in cohort.browserview.assays) {
			const assayview = cohort.browserview.assays[assayname]
			if (assayview.combined && assayview.combinetk) {
				lst.push(assayview.combinetk)
			}
		}
	}
	if (!cohort.genome.tkset) {
		cohort.genome.tkset = []
	}
	const thisset = {
		name: cohort.name,
		tklst: lst
	}

	if (cohort.trackfacets) {
		/*
		light validation
		*/
		if (!Array.isArray(cohort.trackfacets)) {
			return '.trackfacets is not an array'
		}
		const lst = []
		for (const fc of cohort.trackfacets) {
			if (!fc.samples) {
				return 'trackfacets: .samples missing from facet ' + fc.name
			}
			if (!Array.isArray(fc.samples)) {
				return 'trackfacets: .samples is not array from facet ' + fc.name
			}
			if (!fc.assays) {
				return 'trackfacets: .assays missing from a facet ' + fc.name
			}
			if (!Array.isArray(fc.assays)) {
				return 'trackfacets: .assays is not array from a facet ' + fc.name
			}
			lst.push(fc)
		}
		if (lst.length) {
			thisset.facetlst = lst
		}
	}

	cohort.genome.tkset.push(thisset)

	return null
}

function parse_browserview(cohort) {
	if (cohort.browserview.position) {
		let pos
		if (typeof cohort.browserview.position == 'string') {
			pos = string2pos(cohort.browserview.position, cohort.genome)
			if (!pos) {
				return '.browserview.position invalid value'
			}
		} else {
			pos = cohort.browserview.position
		}
		const e = invalidcoord(cohort.genome, pos.chr, pos.start, pos.stop)
		if (e) {
			return '.browserview.position error: ' + e
		}
		cohort.browserview.position = pos
	} else {
		cohort.browserview.position = {
			chr: cohort.genome.defaultcoord.chr,
			start: cohort.genome.defaultcoord.start,
			stop: cohort.genome.defaultcoord.stop
		}
	}
	if (cohort.browserview.assays) {
		for (const assayname in cohort.browserview.assays) {
			if (typeof cohort.browserview.assays[assayname] != 'object') {
				cohort.browserview.assays[assayname] = {}
			}
			const assayview = cohort.browserview.assays[assayname]
			for (const a of cohort.assaylst) {
				if (a.name == assayname) {
					assayview.assayobj = a
					break
				}
			}
			if (!assayview.assayobj) {
				// abandon
				console.log('missing assayobj for assayview of ' + assayname)
				continue
			}
			if (assayview.sum_view) {
				// obsolete trigger name
				delete assayview.sum_view
				assayview.combined = true
			}
			if (assayview.combined) {
				// this assay has a combined view
				// sum into one big tk
				// TODO do not support associated assay, e.g. bigwig for junction
				const combinetk = {}
				// copy attr from assayobj
				for (const k in assayview.assayobj) {
					combinetk[k] = assayview.assayobj[k]
				}
				// for attr in assayview, override
				for (const k in assayview) {
					if (k == 'assayobj') continue
					combinetk[k] = assayview[k]
				}
				if (!combinetk.name) {
					combinetk.name = assayname
				}
				combinetk.tracks = []
				for (const pn in cohort.p2st) {
					for (const st in cohort.p2st[pn]) {
						for (const t of cohort.p2st[pn][st].tktemplate) {
							if (t.id == assayview.assayobj.id) {
								t.patient = pn
								t.sampletype = st
								combinetk.tracks.push(t)
							}
						}
					}
				}
				if (combinetk.isvcf) {
					// gather vcf tracks into ds
					combinetk.ds = {
						id2vcf: {},
						label: combinetk.name
					}
					for (const t of combinetk.tracks) {
						for (const i in t.ds.id2vcf) {
							t.__vcfobj = t.ds.id2vcf[i]
						}
						combinetk.ds.id2vcf[t.__vcfobj.vcfid] = t.__vcfobj
					}
				}
				assayview.combinetk = combinetk
			}
		}
	}

	if (cohort.browserview.defaultassaytracks) {
		if (!Array.isArray(cohort.browserview.defaultassaytracks)) return '.browserview.defaultassaytracks must be array'
		for (let i = 0; i < cohort.browserview.defaultassaytracks.length; i++) {
			const t = cohort.browserview.defaultassaytracks[i]
			if (!t.assay) return '.assay missing from .defaultassaytracks #' + (i + 1)
			if (!cohort[t.assay]) return 'unknown assay name from .defaultassaytracks #' + (i + 1) + ': ' + t.assay
			if (!t.level1) return '.level1 missing from .defaultassaytracks #' + (i + 1)
			if (!cohort[t.assay][t.level1])
				return 'level1 not exist in assay from .defaultassaytracks #' + (i + 1) + ': ' + t.level1
			if (t.level2) {
				if (!cohort[t.assay][t.level1][t.level2])
					return 'level2 not exist in assay from .defaultassaytracks #' + (i + 1) + ': ' + t.level2
			}
		}
	}
	return null
}

function parse_patientannotation(cohort) {
	if (!cohort.patientannotation.annotation) {
		return '.patientannotation.annotation missing'
	}
	if (!cohort.patientannotation.metadata) {
		return '.patientannotation.metadata missing'
	}
	if (!Array.isArray(cohort.patientannotation.metadata)) {
		return '.patientannotation.metadata should be an array'
	}
	// convert array to hash
	const mdh = {}
	for (const md of cohort.patientannotation.metadata) {
		if (md.key == undefined) {
			return 'patientannotation: key missing for a metadata term'
		}
		if (!md.values) {
			return 'patientannotation: values missing for metadata term ' + md.key
		}
		if (!Array.isArray(md.values)) {
			return 'patientannotation: .values not an array for metadata term ' + md.key
		}
		if (!md.label) {
			md.label = md.key
		}

		mdh[md.key] = {
			label: md.label,
			values: {}
		}

		// per term, a backup colorsetter when color is missing for attributes
		const colorfunc = scaleOrdinal(schemeCategory10)

		for (const at of md.values) {
			if (at.key == undefined) {
				return 'key missing for an attribute of term ' + md.key
			}
			if (!at.label) {
				at.label = at.key
			}
			if (!at.color) {
				at.color = colorfunc(at.key)
			}
			mdh[md.key].values[at.key] = at
		}
	}
	cohort.patientannotation.mdh = mdh
	return null
}

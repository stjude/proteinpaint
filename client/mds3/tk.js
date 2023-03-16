import { dofetch3 } from '#common/dofetch'
import { makeTk } from './makeTk'
import { may_render_skewer } from './skewer'
import { make_leftlabels } from './leftlabel'
import { mclass } from '#shared/common'

/*
loadTk
	getData
		dataFromCustomVariants
			mayDoLDoverlay
		getParameter
			rangequery_rglst
rangequery_add_variantfilters
*/

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	try {
		if (!tk.mds) {
			// missing .mds{}, run makeTk to initiate; only run once
			await makeTk(tk, block)
		}

		const data = await getData(tk, block)

		if (tk.uninitialized) {
			tk.clear()
			delete tk.uninitialized
		}

		// render each possible track type. if indeed rendered, return sub track height
		// left labels and skewer at same row, whichever taller
		may_render_skewer(data, tk, block)
		// must render skewer first, then left labels
		await make_leftlabels(data, tk, block)

		////////// add new subtrack type

		// done tk rendering, adjust height
		tk._finish(data)
	} catch (e) {
		// if the error is thrown upon initiating the track, clear() function may not have been added
		if (tk.clear) tk.clear()
		if (tk.subtk2height) tk.subtk2height.skewer = 50
		if (tk._finish) tk._finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
		return
	}
}

function getParameter(tk, block) {
	// to get data for current view range

	const par = {
		genome: block.genome.name,
		// instructs server to return data types associated with tracks
		// including skewer or non-skewer
		forTrack: 1,
		// may not pass skewerRim if it is not in use (turn off)
		skewerRim: tk.mds.queries?.snvindel?.skewerRim // instructions for counting rim counts per variant
	}

	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	/*
	temporary change: 
	disable efficiency check and always issue data request, even when zooming in on same isoform (and the data are there)
	this is to be able to let server properly count the number of samples with a mutation in the current range
	to address ui issue

	if (tk.uninitialized || !block.usegm || block.gmmode == 'genomic' || block.gmmodepast == 'genomic') {
		// assumption is that api will return the same amount of variants for different mode (protein/exon/splicerna)
		// so there's no need to re-request data in these modes (but not genomic mode)
	} else {
		// in gmmode and not first time loading the track,
		// do not request skewer data as all skewer data has already been loaded for current isoform
		// still need to request other track data e.g. cnvpileup
	}
	*/

	if (tk.mds.has_skewer) {
		// need to load skewer data
		par.skewer = 1
	}
	if (tk.set_id) {
		// quick fix!!!
		par.set_id = tk.set_id
	}
	if (tk.filter0) {
		// expecting to be a simple filter such as
		// {"op":"and","content":[{"op":"in","content":{"field":"cases.project.project_id","value":["TCGA-BRCA"]}}]}
		par.filter0 = tk.filter0
	}
	if (tk.filterObj) {
		// json filter object
		if (tk.filterObj?.lst.length) {
			// when user deletes the only tvs from the filter ui, the lst[] will be empty and can cause issue in backend
			par.filterObj = tk.filterObj
		}
	}

	if (tk.token) {
		// quick fix for testing with gdc token, which is submitted as url parameter
		// this method is not used in production
		headers['X-Auth-Token'] = tk.token
	}

	if (tk.mds.label) {
		// official
		par.dslabel = tk.mds.label
	} else {
		// should be custom track with data files on backend
		if (tk.bcf) {
			if (tk.bcf.file) {
				par.bcffile = tk.bcf.file
			} else if (tk.bcf.url) {
				par.bcfurl = tk.bcf.url
				if (tk.bcf.indexURL) par.bcfindexURL = tk.bcf.indexURL
			} else {
				throw '.file and .url missing for tk.bcf{}'
			}
		}
		// add new file types
	}

	//rangequery_add_variantfilters(par, tk)

	rangequery_rglst(tk, block, par)

	if (tk.legend.mclass.hiddenvalues.size) {
		par.hiddenmclasslst = [...tk.legend.mclass.hiddenvalues].join(',')
	}

	if (tk.legend.bcfInfo) {
		// add info fields to filter variants
		const infoFilter = {}
		for (const k in tk.legend.bcfInfo) {
			if (tk.legend.bcfInfo[k].hiddenvalues.size) {
				infoFilter[k] = [...tk.legend.bcfInfo[k].hiddenvalues]
			}
		}
		if (Object.keys(infoFilter).length) {
			par.infoFilter = infoFilter
		}
	}

	if (tk.legend.formatFilter) {
		// add format fields to filter samples
		const filter = {}
		for (const k in tk.legend.formatFilter) {
			if (tk.legend.formatFilter[k].hiddenvalues.size) {
				filter[k] = [...tk.legend.formatFilter[k].hiddenvalues]
			}
		}
		if (Object.keys(filter).length) {
			par.formatFilter = filter
		}
	}

	return [par, headers]
}

/*
abstract various data sources

returned data{}:

.skewer[]
	list of data points to show as skewer plot
.mclass2variantcount[]
	mclass breakdown of skewer[]
*/
async function getData(tk, block) {
	let data
	if (tk.custom_variants) {
		// has custom data on client side, no need to request from server
		data = await dataFromCustomVariants(tk, block)
	} else {
		// request data from server, either official or custom sources
		const [body, headers] = getParameter(tk, block)
		data = await dofetch3('mds3', { body, headers })
	}
	if (data.error) throw data.error
	return data
}

export function rangequery_rglst(tk, block, par) {
	// adds new key:value pairs to par{} and makes no return
	if (typeof par != 'object') throw 'par{} is not object'
	let rglst = []
	if (block.usegm) {
		/* to merge par.rglst[] into one region
		this does not apply to subpanels
		*/
		const r = {
			chr: block.rglst[0].chr,
			reverse: block.rglst[0].reverse,
			width: 0,
			start: null,
			stop: null
		}
		for (let i = block.startidx; i <= block.stopidx; i++) {
			const j = block.rglst[i]
			r.width += j.width + block.regionspace
			r.start = r.start == null ? j.start : Math.min(r.start, j.start)
			r.stop = r.stop == null ? j.stop : Math.max(r.stop, j.stop)
		}
		rglst.push(r)
		par.isoform = block.usegm.isoform
		par.gene = block.usegm.name
		if (block.gmmode == 'genomic') {
			// TODO if can delete the isoform parameter to simply make the query by genomic pos
			par.atgenomic = 1
		}
	} else {
		rglst = block.tkarg_rglst(tk)
	}
	// append xoff to each r from block
	let xoff = 0
	for (const r of rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const r of block.subpanels) {
			rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				xoff: xoff
			})
			xoff += r.width + r.leftpad
		}
	}
	par.rglst = rglst
}

function rangequery_add_variantfilters(par, tk) {
	/*
	todo
may add filter parameter for range query
by info_fields[] and variantcase_fields[]
*/
	if (tk.info_fields) {
		par.info_fields = tk.info_fields.reduce((lst, i) => {
			if (i.isfilter) {
				if (i.iscategorical) {
					// for categorical term, always register in parameter
					// server will collect #variants for each category
					const j = {
						key: i.key,
						iscategorical: true,
						unannotated_ishidden: i.unannotated_ishidden,
						hiddenvalues: {}
					}
					for (const v of i.values) {
						if (v.ishidden) j.hiddenvalues[v.key] = 1
					}
					lst.push(j)
				} else if (i.isinteger || i.isfloat) {
					// numerical
					if (i.isactivefilter) {
						// only apply when the numerical filter is in use
						lst.push({
							key: i.key,
							isnumerical: true,
							missing_value: i.missing_value,
							range: i.range
						})
					}
				} else if (i.isflag) {
					// always register flag to collect counts
					lst.push({
						key: i.key,
						isflag: true,
						remove_no: i.remove_no,
						remove_yes: i.remove_yes
					})
				} else {
					throw 'unknown type of info filter'
				}
			}
			return lst
		}, [])
	}
}

async function dataFromCustomVariants(tk, block) {
	// return the same data{} object as server queries
	const data = {
		skewer: []
		// adds mclass2variantcount[] later
	}

	// must exclude out-of-range items, otherwise numeric mode rendering will break
	let bbstart = null,
		bbstop
	for (let i = block.startidx; i <= block.stopidx; i++) {
		if (bbstart == null) {
			bbstart = block.rglst[i].start
			bbstop = block.rglst[i].stop
		} else {
			bbstart = Math.min(bbstart, block.rglst[i].start)
			bbstop = Math.max(bbstop, block.rglst[i].stop)
		}
	}

	const m2c = new Map() // k: mclass, v: count

	for (const m of tk.custom_variants) {
		if (m.chr != block.rglst[0].chr) continue // may not work for subpanel
		if (m.pos <= bbstart || m.pos >= bbstop) continue

		// guard against missing or invalid class from custom data
		// wrong values are silently converted to "X" for "nonstandard", which can alert user without needing a separate alert
		if (!m.class) m.class = 'X' // missing class
		if (!mclass[m.class]) m.class = 'X' // invalid class

		// for hidden mclass, must count it so the legend will be able to show the hidden item
		m2c.set(m.class, 1 + (m2c.get(m.class) || 0))
		if (tk.legend.mclass.hiddenvalues.has(m.class)) continue

		data.skewer.push(m)
	}

	if (data.skewer.some(i => i.samples)) {
		// has .samples[], get sample count
		const set = new Set()
		for (const m of data.skewer) {
			if (m.samples) {
				for (const s of m.samples) set.add(s.sample_id)
			}
		}
		data.sampleTotalNumber = set.size
	}

	data.mclass2variantcount = [...m2c]

	// a special arrangment to do ld overlay on the custom variants via the official dataset
	await mayDoLDoverlay(tk, data.skewer)

	return data
}

async function mayDoLDoverlay(tk) {
	if (!tk.mds.queries?.ld?.mOverlay) return
	if (!tk.mds.termdb?.vocabApi) return
	delete tk.mds.queries.ld.mOverlay.data // delete previous data
	const data = await tk.mds.termdb.vocabApi.getLDdata(tk.mds.queries.ld.mOverlay.ldtkname, tk.mds.queries.ld.mOverlay.m)
	if (data.error || !Array.isArray(data.lst)) return
	tk.mds.queries.ld.mOverlay.data = data.lst // register returned data to be used
}

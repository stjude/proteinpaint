import { select as d3select, event as d3event } from 'd3-selection'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { dofetch3 } from '../../common/dofetch'
import { makeTk } from './makeTk'
import { may_render_skewer } from './skewer'
import { make_leftlabels } from './leftlabel'

/*
********************** EXPORTED
loadTk
rangequery_rglst
********************** INTERNAL
getParameter
loadTk_finish_closure
rangequery_add_variantfilters
getData
filterCustomVariants
*/

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	try {
		if (!tk.mds) {
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
		make_leftlabels(data, tk, block)

		////////// add new subtrack type

		// done tk rendering, adjust height
		tk._finish(data)
	} catch (e) {
		// if the error is thrown upon initiating the track, clear() function may not have been added
		if (tk.clear) tk.clear()
		tk.subtk2height.skewer = 50
		tk._finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
		return
	}
}

function getParameter(tk, block) {
	// to get data for current view range

	const par = ['genome=' + block.genome.name]
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	// instructs server to return data types associated with tracks
	// including skewer or non-skewer
	par.push('forTrack=1')

	if (tk.uninitialized || !block.usegm || block.gmmode == 'genomic' || block.gmmodepast == 'genomic') {
		// assumption is that api will return the same amount of variants for different mode (protein/exon/splicerna)
		// so there's no need to re-request data in these modes (but not genomic mode)
		if (tk.mds.has_skewer) {
			// need to load skewer data
			par.push('skewer=1')
		}
		if (tk.set_id) {
			// quick fix!!!
			par.push('set_id=' + tk.set_id)
		}
		if (tk.filter0) {
			// expecting to be a simple filter such as
			// {"op":"and","content":[{"op":"in","content":{"field":"cases.project.project_id","value":["TCGA-BRCA"]}}]}
			// XXX any other possibilities from gdc portal
			par.push('filter0=' + encodeURIComponent(JSON.stringify(tk.filter0)))
		}
		if (tk.token) headers['X-Auth-Token'] = tk.token
	} else {
		// in gmmode and not first time loading the track,
		// do not request skewer data as all skewer data has already been loaded for current isoform
		// still need to request other track data e.g. cnvpileup
	}

	if (tk.mds.label) {
		// official
		par.push('dslabel=' + tk.mds.label)
	} else {
		throw 'how to deal with custom track'
	}

	//rangequery_add_variantfilters(par, tk)

	rangequery_rglst(tk, block, par)

	if (tk.legend.mclass.hiddenvalues.size) {
		par.push('hiddenmclasslst=' + [...tk.legend.mclass.hiddenvalues].join(','))
	}
	//par.push('samplefiltertemp=' + JSON.stringify(tk.samplefiltertemp))
	return [par.join('&'), headers]
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
		data = filterCustomVariants(tk, block)
	} else {
		// request data from server, either official or custom sources
		const [par, headers] = getParameter(tk, block)
		data = await dofetch3('mds3?' + par, { headers })
	}
	if (data.error) throw data.error
	return data
}

export function rangequery_rglst(tk, block, par) {
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
			r.stop = r.stop == null ? j.stop : Math.min(r.stop, j.stop)
		}
		rglst.push(r)
		par.push('isoform=' + block.usegm.isoform)
		if (block.gmmode == 'genomic') {
			// TODO if can delete the isoform parameter to simply make the query by genomic pos
			par.push('atgenomic=1')
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
	par.push('rglst=' + JSON.stringify(rglst))
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

function filterCustomVariants(tk, block) {
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
		if (!m.class) {
			// should this be done?
			m.class = 'X'
		}

		// for hidden mclass, must count it so the legend will be able to show the hidden item
		m2c.set(m.class, 1 + (m2c.get(m.class) || 0))
		if (tk.legend.mclass.hiddenvalues.has(m.class)) continue

		data.skewer.push(m)
	}

	data.mclass2variantcount = [...m2c]
	return data
}

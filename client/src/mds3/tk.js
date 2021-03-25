import { select as d3select, event as d3event } from 'd3-selection'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from '../../../shared/src/common'
import * as client from '../client'
import { makeTk } from './makeTk'
import { update as update_legend } from './legend'
import { may_render_skewer } from './skewer'
import { make_leftlabels } from './leftlabel'

/*
********************** EXPORTED
loadTk
get_parameter
********************** INTERNAL
loadTk_finish_closure
rangequery_rglst
rangequery_add_variantfilters

*/

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish_closure(tk, block) // function used at multiple places

	try {
		if (!tk.mds) {
			await makeTk(tk, block)
		}

		tk.tklabel.each(function() {
			tk.leftLabelMaxwidth = this.getBBox().width
		}) // do this when querying each time

		const par = get_parameter(tk, block)
		const data = await client.dofetch2('mds3?' + par)
		if (data.error) throw data.error

		if (tk.uninitialized) {
			tk.clear()
			delete tk.uninitialized
		}

		tk.height_main = tk.toppad + tk.bottompad

		// render each possible track type. if indeed rendered, return sub track height

		// left labels and skewer at same row, whichever taller
		{
			const h2 = may_render_skewer(data, tk, block)
			// must render skewer first, then left labels
			let h1
			if (data.skewer) {
				h1 = make_leftlabels(data, tk, block)
			} else {
				h1 = 60 // FIXME should be kept at tk.leftlabels.height
			}
			tk.height_main += Math.max(h1, h2)
		}
		// add new subtrack type

		_finish(data)
	} catch (e) {
		// if the error is thrown upon initiating the track, clear() function may not have been added
		if (tk.clear) tk.clear()
		tk.height_main = 50
		_finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
		return
	}
}

function loadTk_finish_closure(tk, block) {
	return data => {
		update_legend(data, tk, block)
		block.tkcloakoff(tk, { error: data.error })
		block.block_setheight()
		block.setllabel()
	}
}

export function get_parameter(tk, block) {
	// to get data for current view range

	const par = ['genome=' + block.genome.name]
	// instructs server to return data types associated with tracks
	// including skewer or non-skewer
	par.push('forTrack=1')

	if (
		tk.uninitialized ||
		!block.usegm ||
		block.gmmode == client.gmmode.genomic ||
		block.gmmodepast == client.gmmode.genomic
	) {
		if (tk.mds.has_skewer) {
			// need to load skewer data
			par.push('skewer=1')
		}
		if (tk.mds.sampleSummaries) {
			// need to make sample summary
			par.push('samplesummary=1')
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
		if (tk.token) {
			// quick fix!!!
			par.push('token=' + tk.token)
		}
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

	if (tk.hiddenmclass.size) {
		par.push('hiddenmclasslst=' + [...tk.hiddenmclass].join(','))
	}
	par.push('samplefiltertemp=' + JSON.stringify(tk.samplefiltertemp))
	return par.join('&')
}

function rangequery_rglst(tk, block, par) {
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
		if (block.gmmode == client.gmmode.genomic) {
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

import { select as d3select } from 'd3-selection'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from '#shared/common.js'
import * as client from './client'
import { update as update_legend } from './block.mds2.legend'
import { makeTk } from './block.mds2.makeTk'
import { may_render_vcf } from './block.mds2.vcf'
import { may_render_ld } from './block.mds2.ld'
import { may_get_param as maygetparameter_numericaxis } from './block.mds2.vcf.numericaxis'

/*
********************** EXPORTED
loadTk
addparameter_rangequery
********************** INTERNAL
makeTk
makeTk_parse_client_config
loadTk_finish_closure
rangequery_add_variantfilters



if track is official:
- has .mds{}

track object:
.vcf{}
	if is official, will be a copy of .mds.track.vcf{}

*/

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish_closure(tk, block) // function used at multiple places

	try {
		if (tk.uninitialized) {
			await makeTk(tk, block)
			delete tk.uninitialized
		}

		tk.tklabel.each(function () {
			tk.leftLabelMaxwidth = this.getBBox().width
		}) // do this when querying each time

		const data = await loadTk_do(tk, block)

		tk.clear()

		const rowheight_vcf = may_render_vcf(data, tk, block)
		const rowheight_ld = may_render_ld(data, tk, block)
		if (tk.g_ldrow) {
			tk.g_ldrow.transition().attr('transform', 'translate(0,' + rowheight_vcf + ')')
			tk.gleft_ldrow.transition().attr('transform', 'translate(0,' + rowheight_vcf + ')')
		}

		// set height_main
		tk.height_main = rowheight_vcf + rowheight_ld

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

async function loadTk_do(tk, block) {
	const par = addparameter_rangequery(tk, block)

	return client.dofetch('mds2', par).then(data => {
		if (data.error) throw data.error
		return data
	})
}

function loadTk_finish_closure(tk, block) {
	return data => {
		update_legend(data, tk, block)
		block.tkcloakoff(tk, { error: data.error })
		block.block_setheight()
		block.setllabel()
	}
}

export function addparameter_rangequery(tk, block) {
	// to get data for current view range

	/*
	for vcf track, server may render image when too many variants
	need to supply all options regarding rendering:
	*/
	const par = {
		genome: block.genome.name
	}

	rangequery_add_variantfilters(par, tk)

	if (tk.legend.mclass.hiddenvalues.size) {
		par.hidden_mclass = [...tk.legend.mclass.hiddenvalues]
	}

	if (tk.mds) {
		// official
		par.dslabel = tk.mds.label
	} else {
		// custom, add available file types
		if (tk.vcf) {
			par.vcf = {
				file: tk.vcf.file,
				url: tk.vcf.url,
				indexURL: tk.vcf.indexURL
			}
		}
	}

	if (tk.vcf) {
		par.trigger_vcfbyrange = 1
		maygetparameter_numericaxis(tk, par)
		/*
		if ever to render vcf image on server, need to know 
		any categorical attr is used to class variants instead of mclass
		*/
	}
	if (tk.ld) {
		const showntracks = tk.ld.tracks.filter(t => t.shown)
		if (showntracks.length) {
			par.trigger_ld = {
				tracks: showntracks,
				connheight: tk.ld.connheight
			}
		}
	}
	// add trigger for other data types

	par.rglst = block.tkarg_rglst(tk) // note here: not tkarg_usegm
	if (block.usegm) {
		/* to merge par.rglst[] into one region
		this does not apply to subpanels
		*/
		const r = par.rglst[0]
		r.usegm_isoform = block.usegm.isoform
		for (let i = 1; i < par.rglst.length; i++) {
			const ri = par.rglst[i]
			r.width += ri.width + block.regionspace
			r.start = Math.min(r.start, ri.start)
			r.stop = Math.max(r.stop, ri.stop)
		}
		par.rglst = [r]
	}

	// append xoff to each r from block
	let xoff = 0
	for (const r of par.rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const r of block.subpanels) {
			par.rglst.push({
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

	return par
}

function apply_scale_to_region(rglst) {
	// do not use
	// this does not account for rglst under gm mode
	// such as data.vcf.rglst
	for (const r of rglst) {
		r.scale = scaleLinear()
		if (r.reverse) {
			r.scale.domain([r.stop, r.start]).range([0, r.width])
		} else {
			r.scale.domain([r.start, r.stop]).range([0, r.width])
		}
	}
}

function configPanel(tk, block) {}

function rangequery_add_variantfilters(par, tk) {
	/*
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

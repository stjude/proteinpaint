import * as client from './client'
import { rgb as d3rgb } from 'd3-color'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from '#shared/common.js'
import * as expressionstat from './block.mds.expressionstat'
import {
	tooltip_singleitem,
	click_multi_singleitem,
	tooltip_multi_vcfdense,
	click_multi_vcfdense,
	tooltip_multi_svdense,
	click_multi_svdense,
	tooltip_samplegroup,
	click_samplegroup_showtable,
	click_samplegroup_showmenu,
	may_add_sampleannotation,
	may_allow_samplesearch
} from './block.mds.svcnv.clickitem'
import { makeTk_legend, update_legend } from './block.mds.svcnv.legend'
import { render_singlesample } from './block.mds.svcnv.single'
import { createbutton_addfeature, may_show_samplematrix_button } from './block.mds.svcnv.samplematrix'
import { render_multi_genebar, genebarconfig_fixed } from './block.mds.svcnv.addcolumn'
import { vcfparsemeta } from '#shared/vcf.js'
import { rnabamtk_initparam, configPanel_rnabam } from './block.mds.svcnv.share'

/*
JUMP __multi __maketk __sm

makeTk
	apply_customization_oninit
loadTk
	loadTk_do
		addLoadParameter
may_showgeneexp_nomutationdata
render_samplegroups
	prep_samplegroups
	render_multi_vcfdense
	render_multi_svdense
	render_multi_cnvloh
		render_multi_cnvloh_stackeachsample
		** focus_singlesample
configPanel()
multi_sample_addhighlight
multi_sample_removehighlight


modes:

	driven by svcnv file, sv-cnv-vcf-fpkm ranking

		multi-sample:
			one row per sample
			two forms:
				dense
					sv breakpoint density in separate track
					cnv shown densily
				full
					cnv & sv shown together at sample-level

		sampleset:
			custom set of samples, in groups

		single-sample:
			show cnv & sv data from a single sample
			indicated by tk.singlesample {name:"samplename"}
			spawn from sample group, mode won't mutate
			fpkm ranking shown as independent track

	ase mode, driven by vcf file and supplemented by rna bam files
		always multi-sample
		always cohort


sv/cnv/loh data mixed in same file, sv has _chr and _pos which are indexing fields, along with chrA/posA/chrB/posB
fpkm data in one file, fpkm may contain Yu's results on ASE/outlier

custom vcf handling:
	multi-sample
	single-sample

!!!!!!!!!!!Task-specific temporary fixes!!!!!!!!!!!
maysortsamplesingroupbydt
*/

const labyspace = 5
export const intrasvcolor = '#858585' // inter-chr sv color is defined on the fly
const cnvhighlightcolor = '#E8FFFF'
export const coverbarcolor_silent = '#222'
export const coverbarcolor_active = '#ED8600'

const minlabfontsize = 7
const minsvradius = 5
const svdensitynogroupcolor = '#aaa'
const leftlabelticksize = 5

const hardcode_cellline = 'CELLLINE'
const novalue_max_cnvloh = 0 // for max scale of log2ratio and segmean, if there is no cnv or loh data in view range

// x space between label and box/circle
export const labelspace = 5 // when label is shown outside of box, the space between them

const stackheightscale = scaleLinear().domain([1, 3, 5, 10]).range([8, 4, 2, 1])

export function loadTk(tk, block) {
	/*
	works for both multi- and single-sample modes
	*/

	block.tkcloakon(tk)
	block.block_setheight()

	if (tk.uninitialized) {
		makeTk(tk, block)
		delete tk.uninitialized
	}

	Promise.resolve()
		.then(() => {
			return loadTk_mayinitiatecustomvcf(tk, block)
		})
		.then(() => {
			return loadTk_mayinitiaternabam(tk, block)
		})
		.then(() => {
			/*
		if error, throw error
		if no data, throw {nodata:1}
		else, set tk height and quiet
		*/
			return loadTk_do(tk, block)
		})
		.catch(err => {
			tk.height_main = 50

			if (err.nodata) {
				/*
			central place to handle "no data", no mutation data in any sample
			for both single/multi-sample
			*/
				trackclear(tk)
				// remove old data so the legend can update properly
				delete tk.data_vcf
				if (tk.singlesample) {
					delete tk.data
				} else {
					// multi
					delete tk._data
					delete tk.samplegroups
					may_showgeneexp_nomutationdata(tk, block)
				}
				update_legend(tk, block)
				return { error: tk.name + ': no data in view range' }
			}

			if (err.stack) console.error(err.stack)
			return { error: err.message }
		})
		.then(_final => {
			block.tkcloakoff(tk, { error: _final.error })
			block.block_setheight()
			block.setllabel()
		})
}

function may_showgeneexp_nomutationdata(tk, block) {
	/*
	multi-sample
	no mutation data in view range, thus no .samplegroup
	but still may be genes with expression, as in .gene2coord
	need to indicate them
	*/
	const genenames = []
	if (tk.gene2coord) {
		for (const gene in tk.gene2coord) genenames.push(gene)
	}
	if (genenames.length == 0) return

	if (!tk.gecfg) {
		console.error('but .gecfg is missing')
		return
	}

	// must reset cnvrightg y pos since it will be shifted if there was data previously
	tk.cnvrightg.attr('transform', 'translate(0,' + (4 + tk.height_main / 2) + ')')

	const text = tk.cnvrightg.append('text').attr('font-size', 12).attr('class', 'sja_clbtext2')

	if (genenames.length == 1) {
		/*
		just one gene in view range
		pretend it to be fixed gene
		and show the menu option
		*/

		text.text(genenames[0]).on('click', event => {
			const c = tk.gene2coord[genenames[0]]
			genebarconfig_fixed(
				{
					gene: genenames[0],
					chr: c.chr,
					start: c.start,
					stop: c.stop
				},
				tk,
				block
			)
			tk.tkconfigtip.showunder(event.target)
		})
		return
	}

	/*
	multiple genes in view range
	allow to select one gene and show menu like above
	*/

	text.text('Select gene').on('click', () => {
		tk.tkconfigtip.clear().showunder(text.node())
		for (const gene of genenames) {
			tk.tkconfigtip.d
				.append('div')
				.text(gene)
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					const c = tk.gene2coord[gene]
					genebarconfig_fixed(
						{
							gene: gene,
							chr: c.chr,
							start: c.start,
							stop: c.stop
						},
						tk,
						block
					)
				})
		}
	})
}

function loadTk_mayinitiaternabam(tk, block) {
	if (!tk.checkrnabam) return
	const tasks = []
	for (const s in tk.checkrnabam.samples) {
		const b = tk.checkrnabam.samples[s]
		tasks.push(
			client
				.dofetch('bamnochr', { genome: block.genome.name, file: b.file, url: b.url, indexURL: b.indexURL })
				.then(data => {
					if (data.error) throw { message: data.error }
					b.nochr = data.nochr
				})
		)
	}
	return Promise.all(tasks)
}

function loadTk_mayinitiatecustomvcf(tk, block) {
	if (!tk.iscustom) return

	if (tk.checkvcf && !tk.checkvcf.stringifiedObj) {
		// driven by svcnv file
		// load vcf meta keep on client for parsing vcf data
		const arg = ['genome=' + block.genome.name]
		if (tk.checkvcf.file) {
			arg.push('file=' + tk.checkvcf.file)
		} else {
			arg.push('url=' + tk.checkvcf.url)
			if (tk.checkvcf.indexURL) arg.push('indexURL=' + tk.checkvcf.indexURL)
		}
		return client.dofetch2('vcfheader?' + arg.join('&')).then(data => {
			if (!data) throw { message: 'server error!' }
			if (data.error) throw { message: data.error }

			const [info, format, samples, errs] = vcfparsemeta(data.metastr.split('\n'))
			if (errs) throw { message: 'Error parsing VCF meta lines: ' + errs.join('; ') }
			tk.checkvcf.info = info
			tk.checkvcf.format = format
			tk.checkvcf.samples = samples
			tk.checkvcf.nochr = data.nochr
			tk.checkvcf.stringifiedObj = JSON.stringify(tk.checkvcf)
		})
	}
}

function loadTk_do(tk, block) {
	const par = {
		//jwt:block.jwt,
		genome: block.genome.name,
		rglst: block.tkarg_maygm(tk)
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const [idx, r] of block.subpanels.entries()) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx: idx
			})
		}
	}

	addLoadParameter(par, tk)

	return client.dofetch('/mdssvcnv', par).then(data => {
		// throw errors

		if (data.error) throw { message: data.error }

		/*
		must keep the loaded "raw" data in _data_vcf, so it can later apply class filter without having to reload from server
		on serverside, the "class" won't be parsed out from csq, without gmmode/isoform info of the client
		*/
		tk._data_vcf = data.data_vcf

		tk.vcfrangelimit = data.vcfrangelimit // range too big
		vcfdata_prep(tk, block) // data for display is now in tk.data_vcf[]

		may_map_vcf(tk, block)

		if (tk.singlesample) {
			if (!data.lst || data.lst.length == 0) {
				// no cnv/sv
				if (!tk.data_vcf || tk.data_vcf.length == 0) {
					// no vcf, nothing to show
					throw { nodata: 1 }
				}
			}
			tk.data = data.lst
		} else {
			// multi-sample

			/*
			keep gene expression info,
			so even if no sample with mutation in view range, still be able to indicate available of gene expression
			*/
			tk.gene2coord = data.gene2coord
			tk.expressionrangelimit = data.expressionrangelimit

			// now samplegroups contains samples with any data type (cnv, sv, vcf), no matter dense or full
			if (!data.samplegroups || data.samplegroups.length == 0) {
				throw { nodata: 1 }
			}
			tk._data = data.samplegroups

			if (tk.sampleAttribute) {
				if (data.sampleannotation) {
					tk.sampleAttribute.samples = data.sampleannotation
				} else {
					tk.sampleAttribute.samples = {}
				}
			}

			if (tk.checkrnabam) {
				for (const samplename in tk.checkrnabam.samples) {
					delete tk.checkrnabam.samples[samplename].genes
					if (data.checkrnabam) {
						const g = data.checkrnabam.find(i => i.sample == samplename)
						if (g) tk.checkrnabam.samples[samplename].genes = g.genes
					}
				}
			}
		}

		// preps common to both single and multi sample
		if (tk.legend_svchrcolor) {
			tk.legend_svchrcolor.interchrs.clear()
			tk.legend_svchrcolor.row.style('display', 'none')
		}

		if (tk.singlesample) {
			render_singlesample(tk, block)
		} else {
			render_samplegroups(tk, block)
		}
		return {}
	})
}

export function trackclear(tk) {
	if (tk.singlesample) {
		tk.waterfall.axisg.selectAll('*').remove()
		tk.waterfall.lab1.text('')
		tk.waterfall.lab2.text('')
		tk.waterfall.lab3.text('')
		tk.svvcf_g.selectAll('*').remove()
		tk.cnv_g.selectAll('*').remove()
		if (tk.cnvcolor.cnvlegend) tk.cnvcolor.cnvlegend.row.style('display', 'none')
		if (tk.cnvcolor.lohlegend) tk.cnvcolor.lohlegend.row.style('display', 'none')
		return
	}
	tk.cnvleftg.selectAll('*').remove()
	tk.vcfdensitylabelg.selectAll('*').remove()
	tk.vcfdensityg.selectAll('*').remove()
	tk.svdensitylabelg.selectAll('*').remove()
	tk.svdensityg.selectAll('*').remove()
	tk.cnvmidg.selectAll('*').remove()
	tk.cnvrightg.selectAll('*').remove()
	tk.config_handle.transition().attr('text-anchor', 'start').attr('x', 0)
}

function addLoadParameter(par, tk) {
	if (tk.iscustom) {
		par.iscustom = 1
		par.file = tk.file
		par.url = tk.url
		par.indexURL = tk.indexURL

		if (tk.checkexpressionrank) {
			par.checkexpressionrank = {}
			for (const k in tk.checkexpressionrank) {
				par.checkexpressionrank[k] = tk.checkexpressionrank[k]
			}
		}

		if (tk.checkvcf) {
			par.checkvcf = tk.checkvcf.stringifiedObj
		}

		if (tk.checkrnabam) {
			rnabamtk_copyparam(tk, par, true)
		}
	} else {
		par.dslabel = tk.mds.label
		par.querykey = tk.querykey
	}

	if (tk.getallsamples) {
		par.getallsamples = true
	}

	// cnv
	if (tk.sampleset) par.sampleset = tk.sampleset
	if (tk.valueCutoff) par.valueCutoff = tk.valueCutoff
	if (Number.isInteger(tk.bplengthUpperLimit)) par.bplengthUpperLimit = tk.bplengthUpperLimit
	if (tk.showonlycnvwithsv) par.showonlycnvwithsv = 1
	par.hide_cnvgain = tk.hide_cnvgain
	par.hide_cnvloss = tk.hide_cnvloss

	// loh
	if (tk.segmeanValueCutoff) par.segmeanValueCutoff = tk.segmeanValueCutoff
	if (Number.isInteger(tk.lohLengthUpperLimit)) par.lohLengthUpperLimit = tk.lohLengthUpperLimit

	if (tk.singlesample) {
		// single sample
		par.singlesample = tk.singlesample.name
	} else {
		// multi sample
		// here are things not to be applied to single sample
		if (tk.sampleAttribute) {
			// mutation attribute applicable to all data types
			const key2value = {}
			let hashidden = false
			for (const key in tk.sampleAttribute.attributes) {
				const attr = tk.sampleAttribute.attributes[key]
				if (attr.hiddenvalues && attr.hiddenvalues.size) {
					key2value[key] = [...attr.hiddenvalues]
					hashidden = true
				}
			}
			if (hashidden) {
				par.hiddensampleattr = key2value
			}
		}
	}

	if (tk.mutationAttribute) {
		// mutation attribute applicable to all data types
		const key2value = {}
		let hashidden = false
		for (const key in tk.mutationAttribute.attributes) {
			const attr = tk.mutationAttribute.attributes[key]
			if (attr.hiddenvalues && attr.hiddenvalues.size) {
				key2value[key] = [...attr.hiddenvalues]
				hashidden = true
			}
		}
		if (hashidden) {
			par.hiddenmattr = key2value
		}
	}

	if (tk.alleleAttribute) {
		// mutation attribute applicable to all data types
		const key2value = {}
		let hashidden = false
		for (const key in tk.alleleAttribute.attributes) {
			const attr = tk.alleleAttribute.attributes[key]
			if (attr.disable) continue
			if (attr.isnumeric) {
				if (Number.isFinite(attr.cutoffvalue)) {
					key2value[key] = {
						cutoffvalue: attr.cutoffvalue,
						keeplowerthan: attr.keeplowerthan
					}
					hashidden = true
				}
			} else {
				// categorical
				if (attr.hiddenvalues && attr.hiddenvalues.size) {
					key2value[key] = [...attr.hiddenvalues]
					hashidden = true
				}
			}
		}
		if (hashidden) {
			par.filteralleleattr = key2value
		}
	}
	if (tk.locusAttribute) {
		// mutation attribute applicable to all data types
		const key2value = {}
		let hashidden = false
		for (const key in tk.locusAttribute.attributes) {
			const attr = tk.locusAttribute.attributes[key]
			if (attr.disable) continue
			if (attr.isnumeric) {
				if (Number.isFinite(attr.cutoffvalue)) {
					key2value[key] = {
						cutoffvalue: attr.cutoffvalue,
						keeplowerthan: attr.keeplowerthan
					}
					hashidden = true
				}
			} else {
				// categorical
				if (attr.hiddenvalues && attr.hiddenvalues.size) {
					key2value[key] = [...attr.hiddenvalues]
					hashidden = true
				}
			}
		}
		if (hashidden) {
			par.filterlocusattr = key2value
		}
	}

	{
		// from mclass.hidden, only dt are used for filtering, vcf class currently filter on client
		const hiddendt = []
		for (const k of tk.legend_mclass.hiddenvalues) {
			if (Number.isInteger(k)) hiddendt.push(k)
		}
		if (hiddendt.length) {
			par.hiddendt = hiddendt
		}
	}
}

/////////////////////// __multi

function render_samplegroups(tk, block) {
	/*
	multi-sample
	dense or full

	a sample should have 1 or more of cnv/sv/loh/itd/snvindel, cannot be empty
	sv that are fully in view range will be shown as 2 circles
	one sample per row, equal row height
	for dense/full

	draw stack items first (cnv/loh/itd); then sv; then vcf

	in dense mode, sv won't involve in tk.samplegroups
	need sv in separate list for dense plot
	*/

	trackclear(tk)

	// track labels will include both bold label and version label
	let labelheight = block.labelfontsize
	if (tk.versionlabel) labelheight += block.labelfontsize

	const [groups, svlst4dense] = prep_samplegroups(tk, block)

	tk.samplegroups = groups

	/*
	if dense, draw vcf density and return height; otherwise variants are dispersed among samplegroup and won't affect tk height
	when view range is too big, won't draw but show a message
	which will take vertical space, the height of which will also be returned
	*/
	const vcfdensityheight = render_multi_vcfdense(tk, block)

	// likewise for sv
	const svdensityheight = render_multi_svdense(svlst4dense, tk, block)

	// for each sample group, draw cnv bars, will draw sv and vcf if in full mode
	const cnvheight = render_multi_cnvloh(tk, block)

	multi_expressionstatus_ase_outlier(tk)

	multi_rnabam_asestatus(tk)

	const genebaraxisheight = render_multi_genebar(tk, block)

	// padding between sv/vcf, if both drawn
	const vcfsvpad = vcfdensityheight && svdensityheight ? 3 : 0

	// track top blank height
	let hpad = Math.max(labelheight, vcfdensityheight + svdensityheight + vcfsvpad, genebaraxisheight)

	// may increase hpad: don't allow tk label to overlap with density plot label
	if (vcfdensityheight) {
		hpad += Math.max(0, labelheight + 8 - (hpad - svdensityheight - vcfsvpad - vcfdensityheight / 2))
	} else if (svdensityheight) {
		hpad += Math.max(0, labelheight + 8 - (hpad - svdensityheight / 2))
	}

	// adjust config handle position by top blank height
	if (genebaraxisheight == 0 || hpad > genebaraxisheight + 3 + block.labelfontsize) {
		// enough space for label to be in usual place
		tk.config_handle.transition().attr('text-anchor', 'start').attr('x', 0)
	} else {
		tk.config_handle.transition().attr('text-anchor', 'end').attr('x', -block.rpad)
	}

	tk.cnvleftg.transition().attr('transform', 'translate(0,' + hpad + ')')
	tk.cnvmidg.transition().attr('transform', 'translate(0,' + hpad + ')')
	tk.vcfdensityg.transition().attr('transform', 'translate(0,' + (hpad - svdensityheight - vcfsvpad) + ')')
	tk.svdensityg.transition().attr('transform', 'translate(0,' + hpad + ')')
	tk.cnvrightg.transition().attr('transform', 'translate(0,' + hpad + ')')

	{
		// if showing density plots, put labels on left of density track
		const color = '#858585'
		if (vcfdensityheight && tk.data_vcf) {
			let c_snvindel = 0

			for (const m of tk.data_vcf) {
				if (m.x == undefined) continue
				if (m.dt == common.dtsnvindel) {
					c_snvindel += m.sampledata.length
				} else {
					console.error('unknown dt from data_vcf')
				}
			}

			const phrases = []
			if (c_snvindel) phrases.push(c_snvindel + ' SNV/indel' + (c_snvindel > 1 ? 's' : ''))

			tk.vcfdensitylabelg
				.attr('transform', 'translate(0,' + (hpad - vcfdensityheight - vcfsvpad - svdensityheight) + ')')
				.append('text')
				.text(phrases.join(', '))
				.attr('text-anchor', 'end')
				.attr('x', block.tkleftlabel_xshift)
				.attr('y', vcfdensityheight / 2)
				.attr('dominant-baseline', 'central')
				.attr('font-size', Math.min(block.labelfontsize, vcfdensityheight) - 1)
				.attr('font-family', client.font)
				.attr('fill', color)
				.each(function () {
					tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
				})

			tk.vcfdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('y2', vcfdensityheight)
				.attr('shape-rendering', 'crispEdges')
			tk.vcfdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('shape-rendering', 'crispEdges')
				.attr('x1', -leftlabelticksize)
				.attr('y1', vcfdensityheight / 2)
				.attr('y2', vcfdensityheight / 2)
			tk.vcfdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 1)
				.attr('shape-rendering', 'crispEdges')
				.attr('stroke-dasharray', '1,3')
				.attr('x2', block.width)
				.attr('y1', vcfdensityheight)
				.attr('y2', vcfdensityheight)
		}

		if (svdensityheight) {
			tk.svdensitylabelg
				.attr('transform', 'translate(0,' + (hpad - svdensityheight) + ')')
				.append('text')
				.text(svlst4dense.length + ' SV breakpoint' + (svlst4dense.length > 1 ? 's' : ''))
				.attr('text-anchor', 'end')
				.attr('x', block.tkleftlabel_xshift)
				.attr('y', svdensityheight / 2)
				.attr('dominant-baseline', 'central')
				.attr('font-size', Math.min(block.labelfontsize, svdensityheight) - 1)
				.attr('font-family', client.font)
				.attr('fill', color)
				.each(function () {
					tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
				})
			tk.svdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('y2', svdensityheight)
				.attr('shape-rendering', 'crispEdges')
			tk.svdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('shape-rendering', 'crispEdges')
				.attr('x1', -leftlabelticksize)
				.attr('y1', svdensityheight / 2)
				.attr('y2', svdensityheight / 2)
			tk.svdensitylabelg
				.append('line')
				.attr('stroke', color)
				.attr('stroke-width', 1)
				.attr('shape-rendering', 'crispEdges')
				.attr('stroke-dasharray', '1,3')
				.attr('x2', block.width)
				.attr('y1', svdensityheight)
				.attr('y2', svdensityheight)
		}
	}

	tk.height_main = tk.toppad + hpad + cnvheight + tk.bottompad

	update_legend(tk, block)
}

function render_multi_vcfdense(tk, block) {
	/*
	multi-sample
	native/custom
	dense
	*/
	if (tk.vcfrangelimit) {
		tk.vcfdensityg
			.append('text')
			.text('Zoom in under ' + common.bplen(tk.vcfrangelimit) + ' to show SNV/indel density')
			.attr('font-size', block.labelfontsize)
			.attr('font-family', client.font)
		return block.labelfontsize
	}
	if (!tk.isdense) return 0

	if (!tk.data_vcf || tk.data_vcf.length == 0) return 0

	const bins = render_multi_vcfdense_2bins(tk, block)

	// group m in each bin by class
	for (const b of bins) {
		if (b.lst.length == 0) continue
		const name2group = new Map()
		// k: mclass key
		// v: mlst[]

		for (const m of b.lst) {
			if (!name2group.has(m.class)) {
				name2group.set(m.class, [])
			}
			name2group.get(m.class).push(m)
		}

		const lst = []
		for (const [classname, mlst] of name2group) {
			let samplecount = 0 // total # of samples in this group
			for (const m of mlst) {
				if (m.dt == common.dtsnvindel) {
					samplecount += m.sampledata.length
				} else {
					console.error('unknown dt')
				}
			}

			lst.push({
				name: common.mclass[classname].label,
				items: mlst,
				color: common.mclass[classname].color,
				samplecount: samplecount
			})
		}
		lst.sort((i, j) => j.samplecount - i.samplecount)
		b.groups = lst
	}

	let maxcount = 0 // per group
	for (const b of bins) {
		if (!b.groups) continue
		for (const g of b.groups) {
			maxcount = Math.max(maxcount, g.samplecount)
		}
	}

	let maxheight = 0 // of all bins
	{
		const radius = 4
		let mrd = 0 // max radius
		const w = Math.pow(radius, 2) * Math.PI // unit area
		if (maxcount <= 3) {
			mrd = w * maxcount * 0.9
		} else if (maxcount <= 10) {
			mrd = w * 5
		} else if (maxcount <= 100) {
			mrd = w * 7
		} else {
			mrd = w * 10
		}
		const sf_discradius = scaleLinear()
			.domain([1, maxcount * 0.5 + 0.1, maxcount * 0.6 + 0.1, maxcount * 0.7 + 0.1, maxcount * 0.8 + 0.1, maxcount])
			.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])

		// note: must count # of samples in each mutation for radius & offset
		for (const bin of bins) {
			if (!bin.groups) continue

			for (const g of bin.groups) {
				// group dot radius determined by total number of samples in each mutation, not # of mutations

				g.radius = Math.sqrt(sf_discradius(g.samplecount) / Math.PI)
			}

			// offset of a bin determined by the total number of samples
			// count again for the bin
			const totalnum = bin.groups.reduce((i, j) => j.samplecount + i, 0)

			bin.offset = Math.sqrt(sf_discradius(totalnum) / Math.PI)

			const sumheight = bin.groups.reduce((i, j) => i + j.radius * 2, 0)

			maxheight = Math.max(maxheight, bin.offset + sumheight)
		}
	}

	for (const b of bins) {
		if (!b.groups) continue

		const g = tk.vcfdensityg.append('g').attr('transform', 'translate(' + b.x + ',0)')

		let y = b.offset

		for (const grp of b.groups) {
			/*
			one dot for each group

			.name
			.items[]
			.radius
			.color
			.samplecount
			*/

			y += grp.radius
			g.append('circle').attr('cy', -y).attr('r', grp.radius).attr('fill', grp.color).attr('stroke', 'white')

			if (grp.radius >= 8) {
				// big enough dot, show # of items
				const s = grp.radius * 1.5
				const text = grp.samplecount.toString()
				const fontsize = Math.min(s / (text.length * client.textlensf), s)

				g.append('text')
					.text(text)
					.attr('y', -y)
					.attr('dominant-baseline', 'central')
					.attr('text-anchor', 'middle')
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', 'white')
			}

			g.append('circle')
				.attr('cy', -y)
				.attr('r', grp.radius)
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('stroke', grp.color)
				.attr('stroke-opacity', 0)
				.attr('class', 'sja_aa_disckick')
				.on('mouseover', () => {
					tooltip_multi_vcfdense(grp, tk, block)
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})
				.on('click', () => {
					click_multi_vcfdense(grp, tk, block)
				})
			y += grp.radius
		}
		g.append('line').attr('y2', -b.offset).attr('stroke', b.groups[0].color)
	}
	return maxheight
}

function render_multi_vcfdense_2bins(tk, block) {
	if (block.exonsf >= 3) {
		// group by basepairs
		const bp2lst = new Map()
		for (const m of tk.data_vcf) {
			if (m.x == undefined) continue
			if (!bp2lst.has(m.pos)) {
				bp2lst.set(m.pos, {
					x: m.x,
					lst: []
				})
			}
			bp2lst.get(m.pos).lst.push(m)
		}
		const bins = []
		for (const b of bp2lst.values()) {
			bins.push(b)
		}
		return bins
	}

	// fixed pixel width
	const binw = 10 // pixel
	const bins = []
	let x = 0
	while (x < block.width) {
		bins.push({
			x1: x,
			x2: x + binw,
			x: x + binw / 2,
			lst: []
		})
		x += binw
	}
	x = block.width
	for (const p of block.subpanels) {
		x += p.leftpad
		let b = 0
		while (b < p.width) {
			bins.push({
				x1: x + b,
				x2: x + b + binw,
				lst: []
			})
			b += binw
		}
		x += p.width
	}

	// m to bins
	for (const m of tk.data_vcf) {
		if (m.x == undefined) {
			// unmapped
			continue
		}
		for (const b of bins) {
			if (b.x1 <= m.x && b.x2 >= m.x) {
				b.lst.push(m)
				break
			}
		}
	}
	return bins
}

function render_multi_svdense(svlst, tk, block) {
	/*
	multi-sample
	native/custom
	dense
	list of sv provided
	TODO change disc color to sv type
	*/
	if (!tk.isdense || svlst.length == 0) return 0

	const tmpbins = render_multi_svdense_2bins(svlst, tk, block)

	// since sv are breakends, one sv with both ends may be in the same bin, so much dedup
	const bins = []
	for (const b of tmpbins) {
		if (b.lst.length == 0) continue
		const b2 = {}
		for (const k in b) {
			b2[k] = b[k]
		}

		b2.lst = dedup_sv(b.lst)

		bins.push(b2)
	}

	// group items in each bin
	for (const b of bins) {
		const name2group = new Map()
		const nonamelst = []
		for (const i of b.lst) {
			if (i._samplegroup.name) {
				if (!name2group.has(i._samplegroup.name)) {
					name2group.set(i._samplegroup.name, [])
				}
				name2group.get(i._samplegroup.name).push(i)
			} else {
				nonamelst.push(i)
			}
		}
		const lst = []
		if (nonamelst.length) {
			lst.push({
				items: nonamelst,
				color: svdensitynogroupcolor
			})
		}
		for (const [name, items] of name2group) {
			lst.push({
				name: name,
				items: items,
				color: tk.legend_samplegroup ? tk.legend_samplegroup.color(name) : '#aaa'
			})
		}
		lst.sort((i, j) => j.items.length - i.items.length)
		b.groups = lst
	}

	let maxcount = 0 // per group
	for (const b of bins) {
		for (const g of b.groups) {
			maxcount = Math.max(maxcount, g.items.length)
		}
	}

	let maxheight = 0 // of all bins
	{
		const radius = 4
		let mrd = 0 // max radius
		const w = Math.pow(radius, 2) * Math.PI // unit area
		if (maxcount <= 3) {
			mrd = w * maxcount * 0.9
		} else if (maxcount <= 10) {
			mrd = w * 5
		} else if (maxcount <= 100) {
			mrd = w * 7
		} else {
			mrd = w * 10
		}
		const sf_discradius = scaleLinear()
			.domain([1, maxcount * 0.5 + 0.1, maxcount * 0.6 + 0.1, maxcount * 0.7 + 0.1, maxcount * 0.8 + 0.1, maxcount])
			.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])
		for (const b of bins) {
			if (!b.groups) continue
			for (const g of b.groups) {
				g.radius = Math.sqrt(sf_discradius(g.items.length) / Math.PI)
			}
			// offset of a bin determined by the total number of items
			b.offset = Math.sqrt(sf_discradius(b.lst.length) / Math.PI)
			const h = b.groups.reduce((i, j) => i + j.radius * 2, 0)
			maxheight = Math.max(maxheight, b.offset + h)
		}
	}

	for (const b of bins) {
		const g = tk.svdensityg.append('g').attr('transform', 'translate(' + b.x + ',0)')

		let y = b.offset

		for (const grp of b.groups) {
			// one dot for each group

			y += grp.radius
			g.append('circle').attr('cy', -y).attr('r', grp.radius).attr('fill', grp.color).attr('stroke', 'white')

			if (grp.radius >= 8) {
				// big enough dot, show # of items
				const s = grp.radius * 1.5
				const text = grp.items.length.toString()
				const fontsize = Math.min(s / (text.length * client.textlensf), s)

				g.append('text')
					.text(text)
					.attr('y', -y)
					.attr('dominant-baseline', 'central')
					.attr('text-anchor', 'middle')
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', 'white')
			}

			// cover
			g.append('circle')
				.attr('cy', -y)
				.attr('r', grp.radius)
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.attr('stroke', grp.color)
				.attr('stroke-opacity', 0)
				.attr('class', 'sja_aa_disckick')
				.on('mouseover', () => {
					tooltip_multi_svdense(grp, tk, block)
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})
				.on('click', () => {
					click_multi_svdense(grp, tk, block)
				})
			y += grp.radius
		}
		g.append('line').attr('y2', -b.offset).attr('stroke', b.groups[0].color)
	}
	return maxheight
}

function render_multi_svdense_2bins(svlst, tk, block) {
	// repetitive
	if (block.exonsf >= 3) {
		// group by basepairs
		const bp2lst = new Map()
		for (const m of svlst) {
			if (m.x == undefined) continue
			if (!bp2lst.has(m._pos)) {
				bp2lst.set(m._pos, {
					x: m.x,
					lst: []
				})
			}
			bp2lst.get(m._pos).lst.push(m)
		}
		const bins = []
		for (const b of bp2lst.values()) {
			bins.push(b)
		}
		return bins
	}

	// list of bins
	const binw = 10 // pixel
	const tmpbins = []
	let x = 0
	while (x < block.width) {
		tmpbins.push({
			x1: x,
			x2: x + binw,
			x: x + binw / 2,
			lst: []
		})
		x += binw
	}

	x = block.width
	for (const p of block.subpanels) {
		x += p.leftpad
		let b = 0
		while (b < p.width) {
			tmpbins.push({
				x1: x + b,
				x2: x + b + binw,
				lst: []
			})
			b += binw
		}
		x += p.width
	}

	// sv to bins
	for (const sv of svlst) {
		for (const b of tmpbins) {
			if (b.x1 <= sv.x && b.x2 >= sv.x) {
				b.lst.push(sv)
				break
			}
		}
	}
	return tmpbins
}

function render_multi_cnvloh(tk, block) {
	/*
	draws sample rows, each contain cnv & loh segments
	in full mode, include vcf data as well

	multi-sample
	official or custom
	full or dense

	in full mode:
		sample/group height determined on the fly
		for each sample, gather all stackable items: cnv/loh/itd
		then do stacking, generate item.stack_y and obtain height for this sample
		then commence rendering

	in dense mode:
		all samples have equal height, 1 pixel hardcoded
	*/

	{
		// get value cutoff for varying color of cnv or loh segments

		const gain = [], // log2ratio values
			loss = [],
			segmean = [] // segmean values

		for (const g of tk.samplegroups) {
			for (const s of g.samples) {
				for (const i of s.items) {
					if (i.dt == common.dtloh) {
						segmean.push(i.segmean)
						continue
					}
					if (i.dt == common.dtcnv) {
						if (i.value > 0) gain.push(i.value)
						else loss.push(-i.value)
					}
				}
			}
		}
		const gainmaxvalue = common.getMax_byiqr(gain, novalue_max_cnvloh)
		const lossmaxvalue = -common.getMax_byiqr(loss, novalue_max_cnvloh)
		tk.cnvcolor.cnvmax = Math.max(gainmaxvalue, -lossmaxvalue)

		if (segmean.length) {
			tk.cnvcolor.segmeanmax = Math.max(...segmean)
		} else {
			tk.cnvcolor.segmeanmax = novalue_max_cnvloh
		}
	}

	let groupspace // vertical spacing between groups
	if (tk.isdense) {
		tk.rowspace = 0
		groupspace = 4
	} else if (tk.isfull) {
		tk.rowspace = 1
		groupspace = 10
	}

	// for width of background bar of each sample
	const entirewidth = block.width + block.subpanels.reduce((i, j) => i + j.width + j.leftpad, 0)

	render_multi_cnvloh_stackeachsample(tk, block) // in each sample, process stackable items

	// sample height are set, but it doesn't set group height, because group height needs rowspace which is set above
	for (const g of tk.samplegroups) {
		g.height = tk.rowspace * (g.samples.length - 1) + g.samples.reduce((i, j) => j.height + i, 0)
	}

	const grouplabelfontsize = block.labelfontsize - (tk.isfull ? 0 : 1)

	let yoff = groupspace

	for (const [groupidx, samplegroup] of tk.samplegroups.entries()) {
		/*
		for each group (custom track has just 1)
		*/

		// a group may have just 1 sample so height is smaller than label font size, need to have a ypad
		let thisgroupypad = 0
		if (samplegroup.height < grouplabelfontsize) {
			thisgroupypad = (grouplabelfontsize - samplegroup.height) / 2
		}

		if (samplegroup.name) {
			// the group's got a name, show name and border lines
			const color = tk.legend_samplegroup ? tk.legend_samplegroup.color(samplegroup.name) : '#0A7FA6'

			const glabellst = [samplegroup.name + ' (' + samplegroup.samples.length]
			if (samplegroup.sampletotalnum)
				glabellst.push(', ' + Math.ceil((100 * samplegroup.samples.length) / samplegroup.sampletotalnum) + '%')
			if (tk.sampleset) {
				const s = tk.sampleset.find(i => i.name == samplegroup.name)
				if (s) glabellst.push(', ' + Math.ceil((100 * samplegroup.samples.length) / s.samples.length) + '%')
			}
			glabellst.push(')')

			tk.cnvleftg
				.append('text')
				.attr('font-size', grouplabelfontsize)
				.attr('font-family', client.font)
				.attr('y', yoff + thisgroupypad + samplegroup.height / 2)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('fill', color)
				.attr('x', block.tkleftlabel_xshift)
				.text(glabellst.join(''))
				.each(function () {
					tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
				})
				.on('mouseover', () => {
					tooltip_samplegroup(samplegroup, tk)
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})
				.on('click', event => {
					tk.tip2.clear()
					click_samplegroup_showmenu(samplegroup, tk, block)
					tk.tip2.showunder(event.target)
				})

			// v span
			tk.cnvleftg
				.append('line')
				.attr('y1', yoff + thisgroupypad)
				.attr('y2', yoff + thisgroupypad + samplegroup.height)
				.attr('stroke', color)
				.attr('shape-rendering', 'crispEdges')

			// tick
			tk.cnvleftg
				.append('line')
				.attr('y1', yoff + thisgroupypad + samplegroup.height / 2)
				.attr('y2', yoff + thisgroupypad + samplegroup.height / 2)
				.attr('x2', -leftlabelticksize)
				.attr('stroke', color)
				.attr('shape-rendering', 'crispEdges')
		}

		let yoff1 = yoff + thisgroupypad
		samplegroup.y = yoff1

		for (const sample of samplegroup.samples) {
			/*
			for each sample from this group
			*/

			// if to draw sample name

			if (!samplegroup.name && sample.samplename && sample.height >= minlabfontsize) {
				// show sample name there is no group name, and tall enough, no matter if custom/native/sampleset
				sample.svglabel = tk.cnvleftg
					.append('text')
					.text(sample.samplename)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.attr('fill', 'black')
					.attr('x', -5)
					.attr('y', yoff1 + sample.height / 2)
					.attr('font-family', client.font)
					.attr('font-size', Math.min(15, Math.max(minlabfontsize, sample.height + 1)))
					.each(function () {})
					.on('mouseover', () => {
						multi_sample_addhighlight(sample)
					})
					.on('mouseout', () => {
						multi_sample_removehighlight(sample)
					})
				tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, sample.svglabel.node().getBBox().width)
			}

			// container for all the browser track elements
			const g = tk.cnvmidg.append('g').attr('transform', 'translate(0,' + yoff1 + ')')

			if (tk.isfull) {
				sample.blockbg = g
					.append('rect')
					.attr('width', entirewidth)
					.attr('height', sample.height)
					.attr('fill', coverbarcolor_active)
					.attr('fill-opacity', 0)
					.on('mouseover', () => {
						multi_sample_addhighlight(sample)
					})
					.on('mouseout', () => {
						multi_sample_removehighlight(sample)
					})
			}

			/*
			jinghui nbl cell line mixed into st/nbl
			*/
			if (tk.isfull && sample.sampletype == hardcode_cellline) {
				g.append('rect')
					.attr('x', -5)
					.attr('y', 0)
					.attr('width', 5)
					.attr('height', sample.height)
					.attr('fill', 'black')
					.attr('shape-rendering', 'crispEdges')
			}

			/*
			draw cnv/loh/itd bars, before all others
			*/
			for (const item of sample.items) {
				if (item.dt != common.dtcnv && item.dt != common.dtloh && item.dt != common.dtitd) continue

				// segment color set by numeric value against a cutoff
				let color
				if (item.dt == common.dtloh) {
					if (item.segmean >= tk.cnvcolor.segmeanmax) {
						color = tk.cnvcolor.loh.str
					} else {
						color =
							'rgba(' +
							tk.cnvcolor.loh.r +
							',' +
							tk.cnvcolor.loh.g +
							',' +
							tk.cnvcolor.loh.b +
							',' +
							(item.segmean / tk.cnvcolor.segmeanmax).toFixed(2) +
							')'
					}
				} else if (item.dt == common.dtcnv) {
					// cnv
					if (item.value > 0) {
						if (item.value >= tk.cnvcolor.cnvmax) {
							color = tk.cnvcolor.gain.str
						} else {
							color =
								'rgba(' +
								tk.cnvcolor.gain.r +
								',' +
								tk.cnvcolor.gain.g +
								',' +
								tk.cnvcolor.gain.b +
								',' +
								(item.value / tk.cnvcolor.cnvmax).toFixed(2) +
								')'
						}
					} else {
						if (item.value <= -tk.cnvcolor.cnvmax) {
							color = tk.cnvcolor.loss.str
						} else {
							color =
								'rgba(' +
								tk.cnvcolor.loss.r +
								',' +
								tk.cnvcolor.loss.g +
								',' +
								tk.cnvcolor.loss.b +
								',' +
								(-item.value / tk.cnvcolor.cnvmax).toFixed(2) +
								')'
						}
					}
				} else if (item.dt == common.dtitd) {
					color = common.mclass[common.mclassitd].color
				}

				g.append('rect')
					.attr('x', Math.min(item.x1, item.x2))
					.attr('y', item.stack_y)
					.attr('width', Math.max(1, Math.abs(item.x1 - item.x2)))
					.attr('height', item.stack_h)
					.attr('shape-rendering', 'crispEdges')
					.attr('stroke', 'none')
					.attr('class', 'sja_aa_skkick')
					.attr('fill', color)
					.on('mouseover', () => {
						tooltip_singleitem({
							item: item,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						// FIXME prevent click while dragging
						click_multi_singleitem({
							item: item,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}

			/*
			draw sv/fusion circles, appears here in full mode, not in dense
			*/
			for (const item of sample.items) {
				if (item.dt != common.dtsv && item.dt != common.dtfusionrna) continue

				const otherchr = item.chrA == item._chr ? item.chrB : item.chrA

				const color = otherchr == item._chr ? intrasvcolor : tk.legend_svchrcolor.colorfunc(otherchr)

				const m_g = g.append('g').attr('transform', 'translate(' + item.x + ',' + sample.height / 2 + ')')

				const w = sample.crossboxw
				let coverstart = -w / 2,
					coverwidth = w

				const circle = m_g
					.append('circle')
					.attr('r', Math.min(5, Math.max(minsvradius, 1 + sample.height / 2)))
					.attr('fill', color)
					.attr('fill-opacity', 0)
					.attr('stroke', color)

				// whether to draw label is solely dependent on the flags
				if (item.labonleft) {
					m_g
						.append('text')
						.text(itemname_svfusion(item))
						.attr('text-anchor', 'end')
						.attr('dominant-baseline', 'central')
						.attr('font-family', client.font)
						.attr('font-size', w + 2)
						.attr('fill', color)
						.attr('x', -w / 2 - labelspace)
					coverstart = -w / 2 - labelspace - item.labelwidth
					coverwidth = w + labelspace + item.labelwidth
				} else if (item.labonright) {
					m_g
						.append('text')
						.text(itemname_svfusion(item))
						.attr('dominant-baseline', 'central')
						.attr('font-family', client.font)
						.attr('font-size', w + 2)
						.attr('fill', color)
						.attr('x', w / 2 + labelspace)
					coverwidth = w + labelspace + item.labelwidth
				}

				// mouseover cover
				m_g
					.append('rect')
					.attr('x', coverstart)
					.attr('y', -w / 2)
					.attr('width', coverwidth)
					.attr('height', w)
					.attr('fill', 'white')
					.attr('fill-opacity', 0)
					.on('mouseover', () => {
						circle.attr('fill-opacity', 1)
						tooltip_singleitem({
							item: item,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						circle.attr('fill-opacity', 0)
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: item,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}

			/*
			if in full mode (not dense), draw crosses for snv/indel
			*/
			if (tk.isfull && tk.data_vcf) {
				for (const m of tk.data_vcf) {
					if (m.dt != common.dtsnvindel) continue
					if (m.x == undefined) continue
					if (!m.sampledata) continue

					const w = sample.crossboxw

					//const color = common.mclass[m.class].color
					const color = multi_snvindelcolor(tk, m, sample)

					for (const ms of m.sampledata) {
						if (ms.sampleobj.name != sample.samplename) continue

						// a variant from this sample

						const m_g = g.append('g').attr('transform', 'translate(' + m.x + ',' + sample.height / 2 + ')')

						const bgbox = m_g
							.append('rect')
							.attr('x', -w / 2 - 1)
							.attr('y', -w / 2 - 1)
							.attr('width', w + 2)
							.attr('height', w + 2)
							.attr('fill', color)
							.attr('fill-opacity', 0)

						let bgline1, bgline2, fgline1, fgline2

						if (vcfvariantisgermline(ms, tk)) {
							// germline: 1 |  2 --
							bgline1 = m_g
								.append('line')
								.attr('stroke', 'white')
								.attr('stroke-width', 3)
								.attr('y1', -w / 2 - 1)
								.attr('y2', w / 2 + 1)
							bgline2 = m_g
								.append('line')
								.attr('stroke', 'white')
								.attr('stroke-width', 3)
								.attr('x1', -w / 2 - 1)
								.attr('x2', w / 2 + 1)
							fgline1 = m_g
								.append('line')
								.attr('stroke', color)
								.attr('stroke-width', 1.5)
								.attr('y1', -w / 2 - 1)
								.attr('y2', w / 2 + 1)
							fgline2 = m_g
								.append('line')
								.attr('stroke', color)
								.attr('stroke-width', 1.5)
								.attr('x1', -w / 2 - 1)
								.attr('x2', w / 2 + 1)
						} else {
							// somatic or not specified: 1 \  2 /
							bgline1 = m_g
								.append('line')
								.attr('stroke', 'white')
								.attr('stroke-width', 3)
								.attr('x1', -w / 2)
								.attr('x2', w / 2)
								.attr('y1', -w / 2)
								.attr('y2', w / 2)
							bgline2 = m_g
								.append('line')
								.attr('stroke', 'white')
								.attr('stroke-width', 3)
								.attr('x1', -w / 2)
								.attr('x2', w / 2)
								.attr('y1', w / 2)
								.attr('y2', -w / 2)
							fgline1 = m_g
								.append('line')
								.attr('stroke', color)
								.attr('stroke-width', 1.5)
								.attr('x1', -w / 2)
								.attr('x2', w / 2)
								.attr('y1', -w / 2)
								.attr('y2', w / 2)
							fgline2 = m_g
								.append('line')
								.attr('stroke', color)
								.attr('stroke-width', 1.5)
								.attr('x1', -w / 2)
								.attr('x2', w / 2)
								.attr('y1', w / 2)
								.attr('y2', -w / 2)
						}

						let coverstart = -w / 2,
							coverwidth = w

						if (ms.sampleobj.labonleft) {
							m_g
								.append('text')
								.text(m.mname)
								.attr('text-anchor', 'end')
								.attr('dominant-baseline', 'central')
								.attr('font-family', client.font)
								.attr('font-size', sample.crossboxw + 2)
								.attr('fill', color)
								.attr('x', -w / 2 - labelspace)
							coverstart = -w / 2 - labelspace - ms.sampleobj.labelwidth
							coverwidth = w + labelspace + ms.sampleobj.labelwidth
						} else if (ms.sampleobj.labonright) {
							m_g
								.append('text')
								.text(m.mname)
								.attr('dominant-baseline', 'central')
								.attr('font-family', client.font)
								.attr('font-size', sample.crossboxw + 2)
								.attr('fill', color)
								.attr('x', w / 2 + labelspace)
							coverwidth = w + labelspace + ms.sampleobj.labelwidth
						}

						// mouseover cover
						m_g
							.append('rect')
							.attr('x', coverstart)
							.attr('y', -w / 2)
							.attr('width', coverwidth)
							.attr('height', w)
							.attr('fill', 'white')
							.attr('fill-opacity', 0)
							.on('mouseover', () => {
								bgbox.attr('fill-opacity', 1)
								bgline1.attr('stroke-opacity', 0)
								bgline2.attr('stroke-opacity', 0)
								fgline1.attr('stroke', 'white')
								fgline2.attr('stroke', 'white')

								tooltip_singleitem({
									item: m,
									m_sample: ms,
									sample: sample,
									samplegroup: samplegroup,
									tk: tk,
									block: block
								})
							})
							.on('mouseout', () => {
								tk.tktip.hide()
								bgbox.attr('fill-opacity', 0)
								bgline1.attr('stroke-opacity', 1)
								bgline2.attr('stroke-opacity', 1)
								fgline1.attr('stroke', color)
								fgline2.attr('stroke', color)
								multi_sample_removehighlight(sample)
							})
							.on('click', () => {
								click_multi_singleitem({
									item: m,
									m_sample: ms,
									sample: sample,
									samplegroup: samplegroup,
									tk: tk,
									block: block
								})
							})
					}
				}
			}

			/*** done all items for this sample ***/
			yoff1 += sample.height + tk.rowspace
		}

		/*** done a group ***/
		yoff += samplegroup.height + thisgroupypad * 2 + groupspace
	}

	if (!tk.nocnvlohsv) {
		if (tk.cnvcolor.cnvmax == novalue_max_cnvloh) {
			// hide svg and show 'nodata'
			tk.cnvcolor.cnvlegend.svg.style('display', 'none')
			tk.cnvcolor.cnvlegend.nodatadiv.style('display', 'block')
		} else {
			// hide 'nodata' and show svg
			tk.cnvcolor.cnvlegend.svg.style('display', 'block')
			tk.cnvcolor.cnvlegend.nodatadiv.style('display', 'none')
			draw_colorscale_cnv(tk)
		}

		if (tk.cnvcolor.segmeanmax == novalue_max_cnvloh) {
			if (tk.cnvcolor.lohlegend) {
				// hide svg and show 'nodata'
				tk.cnvcolor.lohlegend.svg.style('display', 'none')
				tk.cnvcolor.lohlegend.nodatadiv.style('display', 'block')
			}
		} else {
			// hide 'nodata' and show svg
			tk.cnvcolor.lohlegend.svg.style('display', 'block')
			tk.cnvcolor.lohlegend.nodatadiv.style('display', 'none')
			draw_colorscale_loh(tk)
		}
	}

	return yoff
}

function multi_snvindelcolor(tk, m, sample) {
	/*
in multi-sample mode, snvindel drawn as x or +
decide the color
m{}
sample{}
	.samplename
*/
	if (tk.checkrnabam) {
		/* in rnabam mode
		if the variant has valid pvalue, show bright color, else gray
		*/
		const sbam = tk.checkrnabam.samples[sample.samplename]
		if (sbam && sbam.genes) {
			for (const g of sbam.genes) {
				if (g.snps) {
					const m2 = g.snps.find(i => i.pos == m.pos && i.ref == m.ref && i.alt == m.alt)
					if (m2 && m2.rnacount && m2.rnacount.pvalue != undefined) {
						return tk.checkrnabam.clientcolor_snpinuse
					}
				}
			}
		}
		return tk.checkrnabam.clientcolor_markernotinuse
	}
	return common.mclass[m.class].color
}

export function multi_sample_addhighlight(sample) {
	if (!sample) return
	// one of tk.samplegroup[].sample[]
	if (sample.svglabel) sample.svglabel.attr('fill', coverbarcolor_active)
	if (sample.blockbg) sample.blockbg.attr('fill-opacity', 0.1)
	if (sample.columnbars) {
		for (const b of sample.columnbars) {
			b.attr('fill', coverbarcolor_active)
		}
	}
}

export function multi_sample_removehighlight(sample) {
	if (!sample) return
	// one of tk.samplegroup[].sample[]
	if (sample.svglabel) sample.svglabel.attr('fill', coverbarcolor_silent)
	if (sample.blockbg) sample.blockbg.attr('fill-opacity', 0)
	if (sample.columnbars) {
		for (const b of sample.columnbars) {
			b.attr('fill', coverbarcolor_silent)
		}
	}
}

function render_multi_cnvloh_stackeachsample(tk, block) {
	/*
	called by render_multi_cnvloh()
	for each sample, set .height
	for each stackable item (cnv/loh/itd), set .stack_y, .stack_h

	for vcf/fusion/sv, check if can show label for each
	*/
	if (!tk.samplegroups || tk.samplegroups.length == 0) return

	if (tk.isdense) {
		// no stacking in dense mode, itd won't go into .items[]
		for (const g of tk.samplegroups) {
			for (const s of g.samples) {
				s.height = 1 // hardcoded
				for (const i of s.items) {
					if (i.dt == common.dtcnv || i.dt == common.dtloh || i.dt == common.dtitd) {
						i.stack_y = 0
						i.stack_h = 1
					}
				}
			}
		}
		return
	}

	/*
	before commencing, delete prior label-drawing flags from vcf sampleobj
	this can happen when toggling label show/hide without reloading data
	*/
	for (const g of tk.samplegroups) {
		for (const s of g.samples) {
			for (const i of s.items) {
				if (i.dt == common.dtsv || i.dt == common.dtfusionrna) {
					delete i.labonleft
					delete i.labonright
				}
			}
		}
	}
	if (tk.data_vcf) {
		for (const m of tk.data_vcf) {
			if (m.sampledata) {
				for (const s of m.sampledata) {
					if (s.sampleobj) {
						delete s.sampleobj.labonleft
						delete s.sampleobj.labonright
					}
				}
			}
		}
	}

	// full width
	const blockwidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	// full mode
	for (const g of tk.samplegroups) {
		for (const s of g.samples) {
			// for this sample, gather stackable items
			const items = []
			for (const i of s.items) {
				if (i.dt == common.dtcnv || i.dt == common.dtloh || i.dt == common.dtitd) {
					if (i.x1 != undefined && i.x2 != undefined) {
						i._boxstart = Math.min(i.x1, i.x2)
						i._boxwidth = Math.abs(i.x2 - i.x1)
						items.push(i)
					}
				}
			}

			dostack(s, items)

			s.crossboxw = Math.min(8, s.height) // determines label font size

			// after stacking, decide if to draw label for pointy items

			/*
			collect pointy items of this sample, sv/fusion/snv
			must collect all, even if its name is hidden or doesn't have a name, in order for collision detection to work
			*/
			const pointitems = []

			for (const i of s.items) {
				if (i.dt == common.dtfusionrna) {
					if (i.x == undefined) continue
					const item = {
						dt: i.dt,
						x: i.x,
						obj: i
					}
					if (tk.multihidelabel_fusion) {
						// no show
					} else {
						item.name = itemname_svfusion(i)
					}
					pointitems.push(item)
				} else if (i.dt == common.dtsv) {
					if (i.x == undefined) continue
					const item = {
						dt: i.dt,
						x: i.x,
						obj: i
					}
					if (tk.multihidelabel_sv) {
						// no show
					} else {
						item.name = itemname_svfusion(i)
					}
					pointitems.push(item)
				}
			}

			if (tk.data_vcf) {
				// collect vcf items for this sample
				for (const m of tk.data_vcf) {
					if (m.dt != common.dtsnvindel || m.x == undefined || !m.sampledata) continue
					const m_sample = m.sampledata.find(i => i.sampleobj.name == s.samplename)
					if (m_sample) {
						const item = {
							dt: m.dt,
							x: m.x,
							obj: m_sample.sampleobj
						}
						if (tk.multihidelabel_vcf) {
							// no show
						} else {
							item.name = m.mname
						}
						pointitems.push(item)
					}
				}
			}

			if (pointitems.length > 0) {
				pointitems.sort((i, j) => i.x - j.x)

				for (let pidx = 0; pidx < pointitems.length; pidx++) {
					/*
					dt, x, name, obj
					for each item, decide if/where to show label
					*/

					const pi = pointitems[pidx]

					if (!pi.name) {
						// no name
						continue
					}

					let labw
					tk.g
						.append('text')
						.text(pi.name)
						.attr('font-size', s.crossboxw + 2)
						.attr('font-family', client.font)
						.each(function () {
							labw = this.getBBox().width
						})
						.remove()

					labw += s.crossboxw / 2 + labelspace

					let nleft = false,
						nright = false

					if (labw > pi.x) {
						// no space on left
						nleft = true
					} else if (labw > blockwidth - pi.x) {
						// no space on right
						nright = true
					}

					// test segment items
					for (const i of s.items) {
						if (nleft && nright) break

						if (i.dt == common.dtcnv || i.dt == common.dtloh || i.dt == common.dtitd) {
							if (i.x1 == undefined || i.x2 == undefined) continue
							const x1 = Math.min(i.x1, i.x2)
							const x2 = Math.max(i.x1, i.x2)

							if (x1 < pi.x) {
								if (x2 < pi.x) {
									if (labw > pi.x - x2) {
										nleft = true
									}
								} else {
									nleft = true
									nright = true
								}
							} else {
								if (labw > x1 - pi.x) {
									nright = true
								}
							}
						}
					}

					if (nleft && nright) {
						// cannot show label
						continue
					}

					if (!nleft) {
						// check previous item for putting label on left
						for (let pidx2 = pidx - 1; pidx2 >= 0; pidx2--) {
							const pi0 = pointitems[pidx2]
							if (pi0.x == pi.x) {
								// possible, avoid label overlap
								if (pi0.obj.labonleft) {
									nleft = true
								} else if (pi0.obj.labonright) {
									nright = true
								} else {
									// do not prohibit
								}
							} else {
								if (labw > pi.x - pi0.x - (pi0.obj.labonright ? pi0.obj.labelwidth : 0)) {
									nleft = true
									break
								} else {
									// good space
									break
								}
							}
						}
					}

					if (nleft && nright) continue

					if (!nright) {
						// check rest of items for putting label on right
						for (let pidx2 = pidx + 1; pidx2 < pointitems.length; pidx2++) {
							const pi2 = pointitems[pidx2]

							if (pi2.x == pi.x) {
								// do not prohibit
							} else {
								if (labw > pi2.x - pi.x) {
									nright = true
									break
								} else {
									// allow label on right
									break
								}
							}
						}
					}

					if (nleft && nright) continue

					if (nleft) {
						if (!nright) {
							pi.obj.labonright = true
						}
					} else {
						if (nright) {
							pi.obj.labonleft = true
						} else {
							pi.obj.labonright = true // on right first
						}
					}

					if (pi.obj.labonleft || pi.obj.labonright) {
						pi.obj.labelwidth = labw
					}
				}
			}
		}
	}
}

export function itemname_svfusion(i) {
	if (i.cytogeneticname) return i.cytogeneticname
	return (i.geneA || i.chrA) + ' > ' + (i.geneB || i.chrB)
}

function dostack(sample, items) {
	// set sample.height

	if (items.length == 0) {
		// this sample has no stackable item, but it must have other pointy items
		// still set height
		sample.height = 8
		return
	}

	// stack

	items.sort((i, j) => i._boxstart - j._boxstart)

	const stacks = []
	for (const m of items) {
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] < m._boxstart) {
				m._stacki = i
				stacks[i] = m._boxstart + m._boxwidth
				break
			}
		}
		if (m._stacki == undefined) {
			m._stacki = stacks.length
			stacks.push(m._boxstart + m._boxwidth)
		}
	}

	let stackheight = stackheightscale(stacks.length)
	if (stackheight < 1) {
		// simpleminded scaling can make it negative
		stackheight = 1
	}

	// no spacing between stacks!!

	for (const i of items) {
		i.stack_y = i._stacki * stackheight
		i.stack_h = stackheight
		delete i._stacki
		delete i._boxstart
		delete i._boxwidth
	}

	sample.height = stackheight * stacks.length
}

export function multi_rnabam_asestatus(tk) {
	/*
	multi-sample, only ase for rna bam mode
	*/
	if (!tk.checkrnabam) return
	for (const s in tk.checkrnabam.samples) {
		const sbam = tk.checkrnabam.samples[s]
		if (sbam.genes) {
			for (const gene of sbam.genes) {
				expressionstat.measure(gene, tk.gecfg)
			}
		}
	}
}

export function multi_expressionstatus_ase_outlier(tk) {
	/*
	multi-sample
	for all genes
	calculate expression status including ase and outlier, using Yu's data & method
	only do this when getting new data, or changing cutoffs

	should process _data, since in dense mode, .samplegroups[] will not contain sv-only samples
	*/
	//if(!tk.samplegroups) return
	if (!tk._data) return
	if (!tk.gecfg) return
	if (tk.gecfg.no_ase) return
	for (const g of tk._data) {
		if (!g.samples) continue
		for (const s of g.samples) {
			if (!s.expressionrank) continue
			for (const gene in s.expressionrank) {
				const v = s.expressionrank[gene]
				expressionstat.measure(v, tk.gecfg)
			}
		}
	}
}

export function draw_colorscale_cnv(tk) {
	tk.cnvcolor.cnvlegend.row.style('display', 'table-row')
	client.axisstyle({
		axis: tk.cnvcolor.cnvlegend.axisg.call(
			axisTop()
				.scale(
					scaleLinear()
						.domain([-tk.cnvcolor.cnvmax, 0, tk.cnvcolor.cnvmax])
						.range([0, tk.cnvcolor.cnvlegend.barw, tk.cnvcolor.cnvlegend.barw * 2])
				)
				.tickValues([-tk.cnvcolor.cnvmax, 0, tk.cnvcolor.cnvmax])
				.tickSize(tk.cnvcolor.cnvlegend.axistickh)
		)
	})
}

export function draw_colorscale_loh(tk) {
	if (!tk.cnvcolor.lohlegend) return

	tk.cnvcolor.lohlegend.row.style('display', 'table-row')
	client.axisstyle({
		axis: tk.cnvcolor.lohlegend.axisg.call(
			axisTop()
				.scale(scaleLinear().domain([0, tk.cnvcolor.segmeanmax]).range([0, tk.cnvcolor.lohlegend.barw]))
				.tickValues([0, tk.cnvcolor.segmeanmax])
				.tickSize(tk.cnvcolor.lohlegend.axistickh)
		)
	})
}

export async function focus_singlesample(p) {
	/*
	multi-sample
	native or custom
	launch a new block instance, show sv-cnv-vcf-expression track in single-sample mode,
	view range determined by cnv or sv
	if vcf, will use block view range

	.m
	.sample
		.samplename
		.sampletype
	.samplegroup
		.attributes[]
	.tk
	.block
	*/

	const { m, sample, samplegroup, tk, block } = p

	let holder

	if (p.holder) {
		holder = p.holder
	} else {
		const pane = client.newpane({ x: 100, y: 100 })
		holder = pane.body
	}

	const assaytkbuttondiv = holder.append('div')

	// for launching block
	const arg = {
		style: {
			margin: '0px'
		},

		// this is to hide green button in sub block
		//hide_mdsHandleHolder:1,

		tklst: [],
		holder,
		subpanels: []
	}

	client.first_genetrack_tolist(block.genome, arg.tklst)

	if (tk.checkrnabam && tk.checkvcf) {
		// detour
		// do not consider other assay tracks
		const sbam = tk.checkrnabam.samples[sample.samplename]
		if (sbam) {
			arg.chr = block.rglst[0].chr
			arg.start = block.rglst[0].start
			arg.stop = block.rglst[0].stop

			const asetk = {
				type: common.tkt.ase,
				name: sample.samplename + ' ASE',
				samplename: sample.samplename,
				rnabamfile: sbam.file,
				rnabamurl: sbam.url,
				rnabamindexURL: sbam.indexURL,
				rnabamtotalreads: sbam.totalreads,
				vcffile: tk.checkvcf.file,
				vcfurl: tk.checkvcf.url,
				vcfindexURL: tk.checkvcf.indexURL
			}

			rnabamtk_copyparam(tk, asetk, false)

			arg.tklst.push(asetk)
			const b = block.newblock(arg)
			if (block.debugmode) {
				window.bbb = b
			}

			return
		}
	}

	// should also root out error when showing that

	// expression rank
	if (tk.iscustom) {
		if (tk.checkexpressionrank) {
			const et = {
				type: client.tkt.mdsexpressionrank,
				name: sample.samplename + ' expression rank',
				sample: sample.samplename,
				iscustom: 1
			}
			for (const k in tk.checkexpressionrank) {
				et[k] = tk.checkexpressionrank[k]
			}
			arg.tklst.push(et)
		}
		// other assay tracks
		if (tk.sample2assaytrack && tk.sample2assaytrack[sample.samplename]) {
			for (const t of tk.sample2assaytrack[sample.samplename]) {
				arg.tklst.push(t)
			}
		}
	} else if (tk.mds && tk.mds.queries[tk.querykey].checkexpressionrank) {
		// official mds

		if (samplegroup) {
			const et = {
				type: client.tkt.mdsexpressionrank,
				name: sample.samplename + ' expression rank',
				dslabel: tk.mds.label,
				querykey: tk.mds.queries[tk.querykey].checkexpressionrank.querykey,
				sample: sample.samplename,
				attributes: samplegroup.attributes
			}
			arg.tklst.push(et)
		} else {
			// in dense mode, vcf samples may not have group
		}
	}

	// add sv-cnv-vcf track in single-sample mode
	const t2 = {
		bplengthUpperLimit: 0, // sample view to show all cnvs by default, not just focal
		valueCutoff: tk.valueCutoff,
		lohLengthUpperLimit: tk.lohLengthUpperLimit,
		segmeanValueCutoff: tk.segmeanValueCutoff,
		singlesample: {
			name: sample.samplename
		}
	}
	if (tk.iscustom) {
		t2.type = client.tkt.mdssvcnv
		t2.file = tk.file
		t2.url = tk.url
		t2.indexURL = tk.indexURL
		t2.iscustom = true
		t2.legend_vorigin = tk.legend_vorigin
	} else {
		// official
		t2.mds = tk.mds
		t2.querykey = tk.querykey
		for (const k in tk.mds.queries[tk.querykey]) {
			if (k == 'bplengthUpperLimit' || k == 'valueCutoff') {
				// do not use default
				continue
			}
			t2[k] = tk.mds.queries[tk.querykey][k]
		}
	}

	// custom vcf track to be declared in t2
	if (tk.iscustom && tk.checkvcf) {
		t2.checkvcf = tk.checkvcf
	}

	arg.tklst.push(t2)

	if (m) {
		if (m.dt == common.dtcnv || m.dt == common.dtloh) {
			const span = Math.ceil((m.stop - m.start) / 2)
			arg.chr = m.chr
			arg.start = Math.max(0, m.start - span)
			arg.stop = Math.min(block.genome.chrlookup[m.chr.toUpperCase()].len, m.stop + span)
		} else if (m.dt == common.dtsv || m.dt == common.dtfusionrna) {
			if (m.chrA == m.chrB) {
				const span = Math.ceil(Math.abs(m.posA - m.posB) / 4)
				arg.chr = m.chrA
				arg.start = Math.max(0, Math.min(m.posA, m.posB) - span)
				arg.stop = Math.min(block.genome.chrlookup[m.chrA.toUpperCase()].len, Math.max(m.posA, m.posB) + span)
			} else {
				const span = 10000
				arg.chr = m.chrA
				arg.start = Math.max(0, m.posA - span)
				arg.stop = Math.min(block.genome.chrlookup[m.chrA.toUpperCase()].len, m.posA + span)
				arg.subpanels.push({
					chr: m.chrB,
					start: Math.max(0, m.posB - span),
					stop: Math.min(block.genome.chrlookup[m.chrB.toUpperCase()].len, m.posB + span),
					width: 600,
					leftpad: 10,
					leftborder: 'rgba(50,50,50,.1)'
				})
			}
		}
	}

	if (!arg.chr) {
		// no view range set
		const r = block.tkarg_maygm(tk)[0]

		if (m && m.dt == common.dtsnvindel) {
			// is snvindel

			const span = 10000 // hardcoded

			if (span < r.stop - r.start) {
				// current view range is bigger than span, use span
				arg.chr = m.chr
				arg.start = Math.max(0, m.pos - span)
				arg.stop = Math.min(block.genome.chrlookup[m.chr.toUpperCase()].len, m.pos + span)
			}
		}

		if (!arg.chr) {
			// is not snvindel

			arg.chr = r.chr
			arg.start = r.start
			arg.stop = r.stop
		}
	}

	let assaytklst

	if (!tk.iscustom) {
		// official track
		// get sample-level track from serverside dataset config
		const data = await client.dofetch2('mdssvcnv', {
			method: 'POST',
			body: JSON.stringify({
				genome: block.genome.name,
				dslabel: tk.mds.label,
				querykey: tk.querykey,
				gettrack4singlesample: sample.samplename
			})
		})
		if (data.error) throw data.error
		if (data.tracks) {
			// important: must duplicate as block init will erase the .hidden tag
			assaytklst = data.tracks
			for (const t of data.tracks) {
				arg.tklst.push(JSON.parse(JSON.stringify(t)))
			}
		}
	}
	const bb = block.newblock(arg)

	if (m) {
		if (m.dt == common.dtcnv || m.dt == common.dtloh) {
			bb.addhlregion(m.chr, m.start, m.stop, cnvhighlightcolor)
		}
	}
	if (assaytklst) {
		// display buttons for toggling each assay track
		assaytkbuttondiv
			.style('display', 'inline-block')
			.style('margin', '0px 10px 20px 10px')
			.append('div')
			.style('margin-bottom', '3px')
			.text('Show/hide available assay tracks for ' + sample.samplename)
			.style('font-size', '.7em')
			.style('opacity', 0.5)
		const d = assaytkbuttondiv.append('div').style('border', 'solid 1px #ccc').style('border-radius', '7px')
		for (const t of assaytklst) {
			const label = d
				.append('div')
				.style('display', 'inline-block')
				.style('white-space', 'nowrap')
				.style('margin', '10px')
				.style('font-size', '.8em')
				.append('label')
			label
				.append('input')
				.attr('type', 'checkbox')
				.style('margin-right', '3px')
				.property('checked', !t.hidden)
				.on('change', event => {
					if (event.target.checked) {
						bb.turnOnTrack(t)
					} else {
						bb.turnOffTrack(t)
					}
				})
			label.append('span').text(t.name)
		}
	}
}

export function rnabamtk_copyparam(from, to, copysample) {
	// both tk obj
	if (!from.checkrnabam) return
	to.checkrnabam = {}
	for (const k in from.checkrnabam) {
		if (k == 'samples') continue
		if (k == 'legend') continue
		to.checkrnabam[k] = from.checkrnabam[k]
	}
	// the sample part is only for xhr
	if (copysample) {
		to.checkrnabam.samples = {}
		for (const samplename in from.checkrnabam.samples) {
			const s = from.checkrnabam.samples[samplename]
			to.checkrnabam.samples[samplename] = {
				file: s.file,
				url: s.url,
				indexURL: s.indexURL,
				nochr: s.nochr,
				totalreads: s.totalreads,
				pairedend: s.pairedend
			}
		}
	}
}

function prep_samplegroups(tk, block) {
	/*
	multi-sample
	from tk._data, prepare samplegroups for plotting
	map sv/cnv/loh/itd to view range, exclude unmappable items
	*/

	if (!tk._data) {
		// could be that all dt are hidden
		return [[], []]
	}

	const svlst4dense = []

	let plotgroups = []

	for (const samplegroup of tk._data) {
		const g2 = {}
		for (const k in samplegroup) g2[k] = samplegroup[k]
		g2.samples = []

		for (const sample of samplegroup.samples) {
			const s2 = {}
			for (const k in sample) s2[k] = sample[k]
			s2.items = []

			for (const item of sample.items) {
				if (item.dt == common.dtsv || item.dt == common.dtfusionrna) {
					// sv
					map_sv_2(item, block)
					if (item.x == undefined) {
						console.log('unmappable sv: ' + item._chr + ' ' + item._pos)
						continue
					}

					if (item.chrA != item._chr) {
						tk.legend_svchrcolor.interchrs.add(item.chrA)
						tk.legend_svchrcolor.colorfunc(item.chrA)
					}
					if (item.chrB != item._chr) {
						tk.legend_svchrcolor.interchrs.add(item.chrB)
						tk.legend_svchrcolor.colorfunc(item.chrB)
					}

					if (tk.isdense) {
						const i = {
							_samplegroup: samplegroup,
							_sample: sample
						}
						for (const k in item) {
							i[k] = item[k]
						}
						svlst4dense.push(i)
						continue
					}

					// not dense
					s2.items.push(item)

					continue
				}

				// cnv, loh, itd
				map_cnv(item, tk, block)
				if (item.x1 == undefined || item.x2 == undefined) {
					console.log('unmappable stack item: ', item)
					continue
				}
				s2.items.push(item)
			}

			if (s2.items.length == 0) {
				/*
				no cnv/sv/loh for this sample, may drop it
				however if vcf is in full mode, must check if this sample has vcf data
				since vcf data is not bundled in items[]
				*/
				if (tk.isfull && tk.data_vcf) {
					let samplehasvcf = false

					for (const m of tk.data_vcf) {
						if (samplehasvcf) break
						if (m.x == undefined) continue

						if (m.dt == common.dtsnvindel) {
							if (!m.sampledata) continue
							for (const s of m.sampledata) {
								if (s.sampleobj.name == sample.samplename) {
									samplehasvcf = true
									break
								}
							}
							continue
						}
					}

					if (!samplehasvcf) {
						// this sample has no vcf either
						if (if_getallsamples(tk)) {
							// QUICK FIX!!!!
							// when this is set, will keep samples with empty .items[]
						} else {
							continue
						}
					}
				} else {
					if (if_getallsamples(tk)) {
						// QUICK FIX!!!!
						// when this is set, will keep samples with empty .items[]
					} else {
						continue
					}
				}
			}

			g2.samples.push(s2)
		}
		if (g2.samples.length == 0) continue

		// only for tal1 figure
		//maysortsamplesingroupbydt(g2)

		plotgroups.push(g2)
	}

	if (tk.groupsamplebyattr) {
		const sortgroupby = tk.groupsamplebyattr.sortgroupby
		if (sortgroupby && sortgroupby.key && sortgroupby.order) {
			// sort groups, may be available for official track
			const lst = []
			for (const value of sortgroupby.order) {
				for (const g of plotgroups) {
					if (!g.attributes) continue
					for (const at of g.attributes) {
						if (at.k == sortgroupby.key && at.kvalue == value) {
							// is one
							g._sorted = 1
							lst.push(g)
							break
						}
					}
				}
			}
			for (const g of plotgroups) {
				if (!g._sorted) lst.push(g)
			}
			for (const g of lst) delete g._sorted
			plotgroups = lst
		}
	}
	if (tk.sampleset) {
		//sort plotgroups in same order as tk.sampleset
		const sortOrder = tk.sampleset.map(i => i.name)
		plotgroups.sort((a, b) => {
			if (sortOrder.indexOf(a.name) > sortOrder.indexOf(b.name)) return 1
			else return -1
		})
		// for each group, sort samples by the order given
		for (const sampleset of tk.sampleset) {
			const plotgroup = plotgroups.find(pg => pg.name == sampleset.name)
			if (!plotgroup || !plotgroup.samples) continue
			const foundsamples = []
			for (const name of sampleset.samples) {
				const s = plotgroup.samples.find(j => j.samplename == name)
				if (s) {
					foundsamples.push(s)
				}
			}
			plotgroup.samples = foundsamples
		}
	}
	return [plotgroups, svlst4dense]
}

function if_getallsamples(tk) {
	// QUICK FIX
	if (!tk.getallsamples) return false
	if (tk.iscustom) return true
	if (tk.mds && tk.mds.allow_getallsamples) return true
	return false
}

function maysortsamplesingroupbydt(g) {
	/*
	temporary, only for making tal1 figure
	by default samples are ordered by the first genomic position of their mutations

	arg: a group with .samples[ {} ]
	*/
	const cnv = []
	const fusioninter = []
	const fusionintra = []
	const rest = []
	for (const s of g.samples) {
		if (s.items.find(m => m.dt == common.dtcnv && m.start < 47720000 && m.stop > 47720000)) {
			// skip tiny cnvs not overlapping with stil promoter
			cnv.push(s)
			continue
		}
		{
			const m = s.items.find(m => m.dt == common.dtfusionrna || m.dt == common.dtsv)
			if (m) {
				if (m.chrA == m.chrB) {
					// intra-chr
					if (m.posA < 48000000 && m.posB < 48000000) {
						cnv.push(s)
					} else {
						fusionintra.push(s)
					}
				} else {
					// inter-chr
					fusioninter.push(s)
				}
				continue
			}
		}
		rest.push(s)
	}

	g.samples = [...cnv, ...fusionintra, ...fusioninter, ...rest]
}

////////////////////// __multi ends

/////////////  __maketk

function copy_attributes(from, to) {
	// from mds.mutationAttribute to tk.mutationAttribute
	for (const k in from) {
		to[k] = from[k]
	}
	if (from.attributes) {
		to.attributes = {}
		for (const m in from.attributes) {
			to.attributes[m] = {}
			for (const n in from.attributes[m]) {
				to.attributes[m][n] = from.attributes[m][n]
			}
		}
	}
}

function makeTk(tk, block) {
	/*
for both multi- and single-sample
*/

	if (tk.mds) {
		/*
		in ds.js, these attributes belong to mds, but not the svcnv query track,
		meant to be applied to all tracks of this mds
		previously, on client, these two attributes were recorded on the svcnv track object
		now they reside in the mds registry object of genome
		however, they are still copied to tk object so that all the code will work!!

		tk.mutationAttribute = tk.mds.mutationAttribute
		tk.sampleAttribute = tk.mds.sampleAttribute
		tk.locusAttribute = tk.mds.locusAttribute
		tk.alleleAttribute = tk.mds.alleleAttribute
		*/

		if (tk.mds.mutationAttribute) {
			tk.mutationAttribute = {}
			copy_attributes(tk.mds.mutationAttribute, tk.mutationAttribute)
		}
		if (tk.mds.sampleAttribute) {
			tk.sampleAttribute = {}
			copy_attributes(tk.mds.sampleAttribute, tk.sampleAttribute)
		}
		if (tk.mds.locusAttribute) {
			tk.locusAttribute = {}
			copy_attributes(tk.mds.locusAttribute, tk.locusAttribute)
		}
		if (tk.mds.alleleAttribute) {
			tk.alleleAttribute = {}
			copy_attributes(tk.mds.alleleAttribute, tk.alleleAttribute)
		}

		tk.nocnvlohsv = true
		tk.isdense = true
		tk.isfull = false
		if (tk.mds.queries) {
			for (const k in tk.mds.queries) {
				const t = tk.mds.queries[k]
				if (t.type == common.tkt.mdssvcnv) {
					// mds has a svcnv track
					delete tk.nocnvlohsv
					if (t.isfull) {
						tk.isfull = true
						tk.isdense = false
					}
				}
			}
		}
	} else if (tk.iscustom) {
		if (!tk.file && !tk.url) {
			// custom track without svcnv file, should be in rnabam mode
			// do not show legend and config for cnv loh sv fusion
			tk.nocnvlohsv = true
		}
	}

	/*
	must do this first
	it may set singlesample{} as is defined in datasetqueries of embedding call
	*/
	apply_customization_oninit(tk, block)

	if (tk.singlesample) {
		// single-sample

		tk.waterfall = {
			inuse: false,
			axisheight: 100,
			bottompad: 10,
			axisgg: tk.gleft.append('g')
		}
		if (tk.singlesample.waterfall) {
			// default setting sneaked in from embedding call
			tk.waterfall.inuse = tk.singlesample.waterfall.inuse
		}

		tk.waterfall.axisg = tk.waterfall.axisgg.append('g')
		tk.waterfall.lab1 = tk.waterfall.axisgg
			.append('text')
			.attr('font-size', 13)
			.attr('text-anchor', 'end')
			.attr('x', -10)
		tk.waterfall.lab2 = tk.waterfall.axisgg
			.append('text')
			.attr('font-size', 13)
			.attr('text-anchor', 'end')
			.attr('x', -10)
		tk.waterfall.lab3 = tk.waterfall.axisgg
			.append('text')
			.attr('font-size', 13)
			.attr('text-anchor', 'end')
			.attr('x', -10)
	} else {
		// in multi-sample

		tk.samplematrices = []

		// allow hidding some labels
		// do not override config from native dataset
		if (tk.multihidelabel_vcf == undefined) {
			tk.multihidelabel_vcf = true
		}
		if (tk.multihidelabel_fusion == undefined) {
			tk.multihidelabel_fusion = true
		}
		if (tk.multihidelabel_sv == undefined) {
			tk.multihidelabel_sv = true
		}
	}

	// if not set, will set default mode here
	if (!tk.singlesample && !tk.isdense && !tk.isfull) {
		if (tk.iscustom) {
			tk.isdense = false
			tk.isfull = true
		} else {
			tk.isdense = true
			tk.isfull = false
			if (tk.showfullmode) {
				tk.isdense = false
				tk.isfull = true
			}
		}
	}

	tk.tip2 = new client.Menu({ padding: '0px' })

	if (tk.singlesample) {
		// set default values
		if (!tk.midpad) tk.midpad = 3
		if (!tk.stem1) {
			tk.stem1 = 10
			tk.stem2 = 0
			tk.stem3 = 5
		}
		if (!tk.legheight) tk.legheight = 40
		if (!tk.discradius) tk.discradius = 8
		if (!tk.valueCutoff) tk.valueCutoff = 0.2
		// length limit could be 0
		if (!Number.isInteger(tk.bplengthUpperLimit)) tk.bplengthUpperLimit = 2000000
		if (!Number.isInteger(tk.lohLengthUpperLimit)) tk.lohLengthUpperLimit = 2000000
		if (!tk.segmeanValueCutoff) tk.segmeanValueCutoff = 0.1

		if (tk.fixname) {
			tk.name = tk.fixname
			tk.tklabel.text(tk.name)
			delete tk.fixname
		} else {
			tk.tklabel.text((tk.name ? tk.name + ', ' : '') + tk.singlesample.name)
		}

		// tklabel name updated, must do below
		tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width
		block.setllabel()

		tk.svvcf_g = tk.glider.append('g') // show sv as lollipops
		tk.cnv_g = tk.glider.append('g') // show cnv/loh as bed track
	} else {
		// multi-sample
		if (tk.mds && tk.mds.version && tk.mds.version.label) {
			tk.versionlabel = block.maketklefthandle(tk, block.labelfontsize).text(tk.mds.version.label)
			if (tk.mds.version.link) {
				tk.versionlabel.on('click', () => {
					window.open(tk.mds.version.link)
				})
			}
		}
		tk.cnvleftg = tk.gleft.append('g')
		tk.vcfdensityg = tk.glider.append('g')
		tk.vcfdensitylabelg = tk.gleft.append('g')
		tk.svdensityg = tk.glider.append('g')
		tk.svdensitylabelg = tk.gleft.append('g')
		tk.cnvmidg = tk.glider.append('g')
		tk.cnvrightg = tk.gright.append('g')
	}

	tk.cnvcolor = {}
	{
		const t = d3rgb(tk.gaincolor)
		tk.cnvcolor.gain = {
			str: tk.gaincolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.gaincolor
	}
	{
		const t = d3rgb(tk.losscolor)
		tk.cnvcolor.loss = {
			str: tk.losscolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.losscolor
	}
	{
		const t = d3rgb(tk.lohcolor)
		tk.cnvcolor.loh = {
			str: tk.lohcolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.lohcolor
	}

	if (tk.iscustom) {
		// default value for naive custom track
		if (tk.valueCutoff == undefined) tk.valueCutoff = 0.2
		if (tk.bplengthUpperLimit == undefined) tk.bplengthUpperLimit = 2000000
		if (tk.segmeanValueCutoff == undefined) tk.segmeanValueCutoff = 0.1
		if (tk.lohLengthUpperLimit == undefined) tk.lohLengthUpperLimit = 2000000
	}

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	if (tk.checkrnabam) {
		/* defaults for parameters
		make this before legend
		*/
		rnabamtk_initparam(tk.checkrnabam)
	}

	makeTk_legend(block, tk)

	// gene expression config
	// make sure do not overwrite gecfg from custom setting

	let hasexpression = false
	if (tk.iscustom) {
		// custom
		if (tk.checkexpressionrank) {
			hasexpression = true
			if (!tk.gecfg) tk.gecfg = {}
			tk.gecfg.datatype = tk.checkexpressionrank.datatype
		} else if (tk.checkrnabam) {
			hasexpression = true
			if (!tk.gecfg) tk.gecfg = {}
			tk.gecfg.datatype = 'FPKM'
		}
	} else {
		// official
		if (tk.mds.queries[tk.querykey].checkexpressionrank) {
			hasexpression = true
			const cp = tk.mds.queries[tk.mds.queries[tk.querykey].checkexpressionrank.querykey]
			if (tk.gecfg && tk.gecfg.fixed_pend) {
				// copy over custom settings
				cp.fixed_pend = tk.gecfg.fixed_pend
			}
			tk.gecfg = cp
		}
	}
	if (hasexpression) {
		/* inherit configs from official tk, if not, rebuild
		this can make sure the same configurations are also available under the dataset.queries.genefpkm
		allowing it to be shared for boxplots etc.
		*/
		if (!tk.gecfg) tk.gecfg = {}

		if (!tk.gecfg.fixed) {
			/*
			upon initing multi-sample view, fixed[] is added
			when launching a single-sample from multi, makeTk will be called again
			since gecfg is referencing the original object but not a duplicate, must not overwrite fixed[]
			should really be a duplicate object instead
			*/
			tk.gecfg.fixed = []
		}

		if (!tk.gecfg.no_ase) {
			expressionstat.init_config(tk.gecfg)
		}
	}

	// end of makeTk
}

function apply_customization_oninit(tk, block) {
	/*
	customization attr from embedding
	either native or custom track
	copy them to attributes
	will override some previous settings

	for filtering attributes, must do it before initiating legend
	because novel keys will be added anew
	*/

	// if is custom, the "customization" will be tk itself

	const c = tk.iscustom ? tk : tk.customization

	if (!c) return

	if (c.singlesample) {
		/*
		this method will pop up panel and show all associated tracks, not in use now

		const s = c.singlesample
		focus_singlesample({
			sample: { samplename: s.name },
			samplegroup: { attributes: s.attributes },
			tk: tk,
			block: block,
		})
		*/

		// for now, simply turn the mds track into single-sample mode
		tk.singlesample = c.singlesample
	} else if (c.sampleset) {
		tk.sampleset = c.sampleset
	}

	// rest are multi-sample
	tk.hide_cnvgain = c.hide_cnvgain
	tk.hide_cnvloss = c.hide_cnvloss

	if (c.isfull) {
		tk.isdense = false
		tk.isfull = true
	} else if (c.isdense) {
		tk.isdense = true
		tk.isfull = false
	}

	if (c.sampleAttribute) {
		if (!tk.sampleAttribute) tk.sampleAttribute = {}
		if (!tk.sampleAttribute.attributes) tk.sampleAttribute.attributes = {}
		for (const k in c.sampleAttribute) {
			const cust = c.sampleAttribute[k]
			if (!tk.sampleAttribute.attributes[k]) {
				// a customized attribute is not found in registry, allow it
				tk.sampleAttribute.attributes[k] = {
					label: k
				}
			}
			const attr = tk.sampleAttribute.attributes[k]
			if (!attr.hiddenvalues) attr.hiddenvalues = new Set()
			if (cust.hiddenvalues) {
				for (const v of cust.hiddenvalues) attr.hiddenvalues.add(v)
			}
		}
	}

	tk.legend_mclass = {
		hiddenvalues: new Set()
	}
	if (c.vcf) {
		if (c.vcf.hiddenclass) {
			for (const m of c.vcf.hiddenclass) tk.legend_mclass.hiddenvalues.add(m)
		}
	}
	if (c.cnv) {
		if (c.cnv.hidden) tk.legend_mclass.hiddenvalues.add(common.dtcnv)
		if (Number.isInteger(c.cnv.upperlengthlimit)) tk.bplengthUpperLimit = c.cnv.upperlengthlimit
	}
	if (c.loh) {
		if (c.loh.hidden) tk.legend_mclass.hiddenvalues.add(common.dtloh)
		if (Number.isInteger(c.loh.upperlengthlimit)) tk.lohLengthUpperLimit = c.loh.upperlengthlimit
	}
	if (c.fusion) {
		if (c.fusion.hidden) tk.legend_mclass.hiddenvalues.add(common.dtfusionrna)
	}
	if (c.sv) {
		if (c.sv.hidden) tk.legend_mclass.hiddenvalues.add(common.dtsv)
	}
	if (c.itd) {
		if (c.itd.hidden) tk.legend_mclass.hiddenvalues.add(common.dtitd)
	}
	if (c.fixedgeneexpression) {
		if (!tk.gecfg) tk.gecfg = {}
		tk.gecfg.fixed_pend = c.fixedgeneexpression
	}
}

function multi_changemode(tk, block) {
	tk.tkconfigtip.hide()
	if (tk.mode_radio_1.property('checked')) {
		tk.isdense = true
		tk.isfull = false
	} else if (tk.mode_radio_2.property('checked')) {
		tk.isdense = false
		tk.isfull = true
	}

	if (!tk._data) {
		// no data
		return
	}

	render_samplegroups(tk, block)
	block.block_setheight()
	block.setllabel()
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear()

	may_show_samplematrix_button(tk, block)

	may_allow_modeswitch(tk, block)

	may_allow_samplesearch(tk, block)

	makeoption_sampleset(tk, block)

	may_allow_showhidelabel_multi(tk, block)

	may_allow_togglewaterfall_single(tk, block)

	configPanel_cnvloh(tk, block)

	configPanel_rnabam(tk, block, loadTk)

	tk.tkconfigtip.showunder(tk.config_handle.node())
}

function makeoption_sampleset(tk, block) {
	if (tk.singlesample) return
	const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '25px')
	if (tk.sampleset) {
		row
			.append('span')
			.style('opacity', 0.5)
			.style('padding-right', '10px')
			.text('Restricted to ' + tk.sampleset.reduce((i, j) => i + j.samples.length, 0) + ' samples')
		row
			.append('button')
			.text('Edit')
			.on('click', () => {
				showinput_sampleset(tk, block)
			})
		row
			.append('button')
			.text('Remove')
			.on('click', () => {
				tk.tkconfigtip.hide()
				delete tk.sampleset
				loadTk(tk, block)
			})
		return
	}
	// allow to enter sampleset
	row
		.append('button')
		.text('Use a sample list')
		.on('click', () => {
			showinput_sampleset(tk, block)
		})

	// QUICKFIX
	// ways to inhibit this button: when sampleset is in use; or if official dataset doesn't say this is allowed
	// while not using sampleset, check condition if to allow to show all samples
	if (tk.iscustom || (tk.mds && tk.mds.allow_getallsamples)) {
		row
			.append('button')
			.style('margin-left', '10px')
			.text(tk.getallsamples ? 'Only show samples with variants' : 'Show all samples')
			.on('click', () => {
				tk.getallsamples = !tk.getallsamples
				tk.tkconfigtip.hide()
				loadTk(tk, block)
			})
	}
}

function showinput_sampleset(tk, block) {
	// for editing existing set or create new
	tk.tkconfigtip.clear()
	const d = tk.tkconfigtip.d.append('div')
	const ta = d
		.append('textarea')
		.attr('placeholder', 'One sample per row. Each row has sample and optional group name, joined by space or tab.')
	if (tk.sampleset) {
		const lst = []
		for (const l of tk.sampleset) {
			for (const s of l.samples) {
				lst.push(s + ' ' + l.name)
			}
		}
		ta.property('value', lst.join('\n')).style('width', '250px').style('height', '200px')
	} else {
		ta.style('width', '200px').style('height', '100px')
	}
	d.append('button')
		.text('Submit')
		.style('display', 'block')
		.on('click', () => {
			const lst = ta.property('value').trim().split('\n')
			if (lst.length == 0) return
			const g2l = new Map()
			const samplesnogrp = []
			for (const line of lst) {
				const [sample, group] = line.split(/[\s\t]/)
				if (!sample) continue
				if (!group) {
					samplesnogrp.push(sample)
				} else {
					if (!g2l.has(group)) g2l.set(group, [])
					g2l.get(group).push(sample)
				}
			}
			tk.sampleset = []
			for (const [name, samples] of g2l) {
				tk.sampleset.push({ name, samples })
			}
			if (samplesnogrp.length) {
				const g = { samples: samplesnogrp }
				// has samples without group name, if there are others with group name, use default, otherwise use none
				if (g2l.size) {
					g.name = 'Unnamed group'
				}
				tk.sampleset.push(g)
			}
			tk.tkconfigtip.hide()
			loadTk(tk, block)
		})
}

function may_allow_togglewaterfall_single(tk, block) {
	/*
in single sample, when snvindel has more than 1, may show as waterfall
the cutoff "1" may be configurable
*/
	if (!tk.singlesample) return

	const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')

	if (!tk.data_vcf || tk.data_vcf.length < 2) {
		// not enough snvindel
		row.style('opacity', 0.5).text('No waterfall plot: not enough SNV/indels')
		return
	}

	const id = Math.random()
	row
		.append('input')
		.attr('type', 'checkbox')
		.attr('id', id)
		.property('checked', tk.waterfall.inuse)
		.on('change', event => {
			tk.waterfall.inuse = event.target.checked
			render_singlesample(tk, block)
			block.block_setheight()
		})
	row.append('label').attr('for', id).html('&nbsp;use Waterfall plot for SNV/indels')
}

function configPanel_cnvloh(tk, block) {
	if (tk.nocnvlohsv) return

	const holder = tk.tkconfigtip.d
	/*
	// filter cnv with sv
	{
		// do not use!!! see notes on server
		const row=holder.append('div').style('margin-bottom','15px')
		const id = Math.random().toString()
		row.append('input')
			.attr('type','checkbox')
			.attr('id', id)
			.property( 'checked', tk.showonlycnvwithsv )
			.on('change',(event)=>{
				tk.showonlycnvwithsv = event.target.checked
				loadTk(tk, block)
			})
		row.append('label')
			.attr('for',id)
			.html('&nbsp;Show only CNV with SV support')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('SV breakpoint must be inside a CNV or within its 1 Kb flanking.')
	}
	*/

	// cnv log2 ratio
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('CNV log2(ratio) cutoff&nbsp;')
		row
			.append('input')
			.property('value', tk.valueCutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseFloat(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (tk.valueCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.valueCutoff = 0
						loadTk(tk, block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (tk.valueCutoff) {
					// cutoff has been set
					if (tk.valueCutoff == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.valueCutoff = v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.valueCutoff = v
					loadTk(tk, block)
				}
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.html(
				'Only show CNV with absolute log2(ratio) no less than cutoff.<br>Set to 0 to show all. Press ENTER to update.'
			)
	}

	// focal cnv
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('CNV segment size limit&nbsp;')
		row
			.append('input')
			.property('value', tk.bplengthUpperLimit || 0)
			.attr('type', 'number')
			.style('width', '80px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseInt(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (tk.bplengthUpperLimit) {
						// cutoff has been set, cancel and refetch data
						tk.bplengthUpperLimit = 0
						loadTk(tk, block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (tk.bplengthUpperLimit) {
					// cutoff has been set
					if (tk.bplengthUpperLimit == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.bplengthUpperLimit = v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.bplengthUpperLimit = v
					loadTk(tk, block)
				}
			})
		row.append('span').text('bp')
		row
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to show all. Press ENTER to update.')
	}

	// cnv color
	{
		const row = holder.append('div')
		row.append('span').html('Copy number gain&nbsp;')
		row
			.append('input')
			.attr('type', 'color')
			.property('value', tk.cnvcolor.gain.str)
			.on('change', event => {
				tk.cnvcolor.gain.str = event.target.value
				const c = d3rgb(tk.cnvcolor.gain.str)
				tk.cnvcolor.gain.r = c.r
				tk.cnvcolor.gain.g = c.g
				tk.cnvcolor.gain.b = c.b
				tk.cnvcolor.cnvlegend.gain_stop.attr('stop-color', tk.cnvcolor.gain.str)
				if (tk.singlesample) {
					render_singlesample(tk, block)
				} else {
					render_samplegroups(tk, block)
				}
			})
		row.append('span').html('&nbsp;&nbsp;loss&nbsp;')
		row
			.append('input')
			.attr('type', 'color')
			.property('value', tk.cnvcolor.loss.str)
			.on('change', event => {
				tk.cnvcolor.loss.str = event.target.value
				const c = d3rgb(tk.cnvcolor.loss.str)
				tk.cnvcolor.loss.r = c.r
				tk.cnvcolor.loss.g = c.g
				tk.cnvcolor.loss.b = c.b
				tk.cnvcolor.cnvlegend.loss_stop.attr('stop-color', tk.cnvcolor.loss.str)
				if (tk.singlesample) {
					render_singlesample(tk, block)
				} else {
					render_samplegroups(tk, block)
				}
			})
	}

	if (tk.cnvcolor.lohlegend) {
		holder.append('hr').style('margin', '20px')

		// loh segmean cutoff
		{
			const row = holder.append('div').style('margin-bottom', '15px')
			row.append('span').html('LOH seg.mean cutoff&nbsp;')
			row
				.append('input')
				.property('value', tk.segmeanValueCutoff || 0)
				.attr('type', 'number')
				.style('width', '50px')
				.on('keyup', event => {
					if (event.code != 'Enter' && event.code != 'NumpadEnter') return
					let v = Number.parseFloat(event.target.value)
					if (!v || v < 0) {
						// invalid value, set to 0 to cancel
						v = 0
					}
					if (v == 0) {
						if (tk.segmeanValueCutoff) {
							// cutoff has been set, cancel and refetch data
							tk.segmeanValueCutoff = 0
							loadTk(tk, block)
						} else {
							// cutoff has not been set, do nothing
						}
						return
					}
					// set cutoff
					if (tk.segmeanValueCutoff) {
						// cutoff has been set
						if (tk.segmeanValueCutoff == v) {
							// same as current cutoff, do nothing
						} else {
							// set new cutoff
							tk.segmeanValueCutoff = v
							loadTk(tk, block)
						}
					} else {
						// cutoff has not been set
						tk.segmeanValueCutoff = v
						loadTk(tk, block)
					}
				})
			row
				.append('div')
				.style('font-size', '.7em')
				.style('color', '#858585')
				.html('Only show LOH with seg.mean no less than cutoff.<br>Set to 0 to show all. Press ENTER to update.')
		}

		// focal loh
		{
			const row = holder.append('div').style('margin-bottom', '15px')
			row.append('span').html('LOH segment size limit&nbsp;')
			row
				.append('input')
				.property('value', tk.lohLengthUpperLimit || 0)
				.attr('type', 'number')
				.style('width', '80px')
				.on('keyup', event => {
					if (event.code != 'Enter' && event.code != 'NumpadEnter') return
					let v = Number.parseInt(event.target.value)
					if (!v || v < 0) {
						// invalid value, set to 0 to cancel
						v = 0
					}
					if (v == 0) {
						if (tk.lohLengthUpperLimit) {
							// cutoff has been set, cancel and refetch data
							tk.lohLengthUpperLimit = 0
							loadTk(tk, block)
						} else {
							// cutoff has not been set, do nothing
						}
						return
					}
					// set cutoff
					if (tk.lohLengthUpperLimit) {
						// cutoff has been set
						if (tk.lohLengthUpperLimit == v) {
							// same as current cutoff, do nothing
						} else {
							// set new cutoff
							tk.lohLengthUpperLimit = v
							loadTk(tk, block)
						}
					} else {
						// cutoff has not been set
						tk.lohLengthUpperLimit = v
						loadTk(tk, block)
					}
				})
			row.append('span').text('bp')
			row
				.append('div')
				.style('font-size', '.7em')
				.style('color', '#858585')
				.html('Limit the LOH segment length to show only focal events.<br>Set to 0 to show all. Press ENTER to update.')
		}

		// loh color
		{
			const row = holder.append('div').style('margin-bottom', '1px')
			row.append('span').html('LOH color&nbsp;')
			row
				.append('input')
				.attr('type', 'color')
				.property('value', tk.cnvcolor.loh.str)
				.on('change', event => {
					tk.cnvcolor.loh.str = event.target.value
					const c = d3rgb(tk.cnvcolor.loh.str)
					tk.cnvcolor.loh.r = c.r
					tk.cnvcolor.loh.g = c.g
					tk.cnvcolor.loh.b = c.b
					tk.cnvcolor.lohlegend.loh_stop.attr('stop-color', tk.cnvcolor.loh.str)
					if (tk.singlesample) {
						render_singlesample(tk, block)
					} else {
						render_samplegroups(tk, block)
					}
				})
		}
	}

	// end of config
}

function may_allow_modeswitch(tk, block) {
	// only for multi-sample
	if (tk.singlesample) return

	const div = tk.tkconfigtip.d
		.append('div')
		.style('background', '#FAF9DE')
		.style('margin-bottom', '20px')
		.style('padding', '15px')

	const id1 = Math.random().toString()
	const id2 = Math.random().toString()
	const name = Math.random().toString()
	const row1 = div.append('div').style('margin-bottom', '5px')
	tk.mode_radio_1 = row1
		.append('input')
		.attr('type', 'radio')
		.attr('id', id1)
		.attr('name', name)
		.property('checked', tk.isdense)
		.on('change', () => {
			multi_changemode(tk, block)
		})
	row1
		.append('label')
		.attr('for', id1)
		.attr('class', 'sja_clbtext')
		.html(
			'&nbsp;Dense <span style="font-size:.7em;color:#858585;">Showing densities of SV breakpoints and SNV/indels, over all samples</span>'
		)

	const row2 = div.append('div')
	tk.mode_radio_2 = row2
		.append('input')
		.attr('type', 'radio')
		.attr('id', id2)
		.attr('name', name)
		.property('checked', tk.isfull)
		.on('change', () => {
			multi_changemode(tk, block)
		})
	row2
		.append('label')
		.attr('for', id2)
		.attr('class', 'sja_clbtext')
		.html('&nbsp;Expanded <span style="font-size:.7em;color:#858585;">Showing SV/SNV/indel for each sample</span>')
}

function may_allow_showhidelabel_multi(tk, block) {
	// only for multi-sample
	if (tk.singlesample) return
	tk.tkconfigtip.d
		.append('div')
		.style('margin-bottom', '5px')
		.text('Show text labels in expanded mode')
		.style('opacity', 0.5)

	const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '20px')
	{
		// TODO if no vcf tk, do not show it
		const id = Math.random().toString()
		row
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', id)
			.property('checked', !tk.multihidelabel_vcf)
			.on('change', () => {
				tk.multihidelabel_vcf = !tk.multihidelabel_vcf
				render_samplegroups(tk, block)
			})
		row.append('label').attr('for', id).attr('class', 'sja_clbtext').html('&nbsp;SNV/indel')
	}

	if (!tk.nocnvlohsv) {
		{
			const id = Math.random().toString()
			row
				.append('input')
				.attr('type', 'checkbox')
				.style('margin-left', '20px')
				.attr('id', id)
				.property('checked', !tk.multihidelabel_sv)
				.on('change', () => {
					tk.multihidelabel_sv = !tk.multihidelabel_sv
					render_samplegroups(tk, block)
				})
			row.append('label').attr('for', id).attr('class', 'sja_clbtext').html('&nbsp;DNA SV')
		}
		{
			const id = Math.random().toString()
			row
				.append('input')
				.attr('type', 'checkbox')
				.style('margin-left', '20px')
				.attr('id', id)
				.property('checked', !tk.multihidelabel_fusion)
				.on('change', () => {
					tk.multihidelabel_fusion = !tk.multihidelabel_fusion
					render_samplegroups(tk, block)
				})
			row.append('label').attr('for', id).attr('class', 'sja_clbtext').html('&nbsp;RNA fusion')
		}
	}
}

/////////////  __maketk ENDS

export function map_cnv(item, tk, block) {
	/*
	cnv, loh, itd
	*/
	const main = block.tkarg_maygm(tk)[0]

	if (item.chr == main.chr && Math.max(item.start, main.start) < Math.min(item.stop, main.stop)) {
		item.x1 = block.seekcoord(item.chr, Math.max(item.start, main.start))[0].x
		// in case item.stop is beyond chr length,
		// main.stop has to -1 to allow it to work with seekcoord
		item.x2 = block.seekcoord(item.chr, Math.min(item.stop, main.stop - 1))[0].x
	}

	let x = block.width
	for (const p of block.subpanels) {
		x += p.leftpad
		if (item.chr == p.chr && Math.max(item.start, p.start) < Math.min(item.stop, p.stop)) {
			const x1 = x + (Math.max(item.start, p.start) - p.start) * p.exonsf
			const x2 = x + (Math.min(item.stop, p.stop) - p.start) * p.exonsf
			if (item.x1 == undefined) {
				item.x1 = x1
				item.x2 = x2
			} else {
				item.x2 = x2
			}
		}
		x += p.width
	}

	if (item.x1 != undefined && block.gmmode && block.gmmode != common.gmmode.genomic) {
		// mapped item, in gmmode, may adjust

		const pxw = block.width + block.subpanels.reduce((i, j) => j.width + j.leftpad, 0)

		if (item.x1 < item.x2) {
			if (item.x2 < 0 || item.x1 > pxw) {
				// out of range
				item.x1 = undefined
				item.x2 = undefined
				return
			}
			if (item.x1 < 0) {
				item.x1 = 0
			}
			if (item.x2 > pxw) {
				item.x2 = pxw
			}
		} else if (item.x1 > item.x2) {
			// reversed
			if (item.x1 < 0 || item.x2 > pxw) {
				// out of range
				item.x1 = undefined
				item.x2 = undefined
				return
			}
			if (item.x2 < 0) {
				item.x2 = 0
			}
			if (item.x1 > pxw) {
				item.x1 = pxw
			}
		}
	}
}

function map_sv_2(item, block) {
	const lst = block.seekcoord(item._chr, item._pos)
	for (const r of lst) {
		if (r.ridx != undefined) {
			// in main, if outside won't show this end
			if (r.x > 0 && r.x < block.width) {
				item.x = r.x
				break
			}
		} else if (r.subpanelidx != undefined) {
			item.x = r.x
		}
	}
}

function may_map_vcf(tk, block) {
	// map to view range: snvindel, itd
	if (!tk.data_vcf) return
	for (const m of tk.data_vcf) {
		if (m.dt == common.dtsnvindel) {
			m._chr = m.chr
			m._pos = m.pos
			map_sv_2(m, block)
			if (m.x == undefined) {
				console.log('snvindel unmapped: ' + m.chr + ':' + m.pos)
			} else {
				delete m._chr
				delete m._pos
			}
		} else {
			console.error('may_map_vcf: unknown dt')
		}
	}
}

function vcfdata_prep(tk, block) {
	/*
	_data_vcf returned by server
	will be filtered to data_vcf for display
	changing mclass filtering option won't call this, will reload all datatypes from server, sorry about the trouble
	*/
	if (!tk._data_vcf || tk._data_vcf.length == 0) {
		tk.data_vcf = null
		return
	}

	const mlst = tk._data_vcf

	tk.data_vcf = []

	for (const m of mlst) {
		if (m.dt == common.dtsnvindel) {
			common.vcfcopymclass(m, block)
		} else {
			throw 'unknown dt ' + m.dt
		}
		if (!tk.legend_mclass.hiddenvalues.has(m.class)) {
			tk.data_vcf.push(m)
		}
	}
}

export function dedup_sv(lst) {
	/* sv are breakends
	dedup
	*/
	const key2sv = new Map()
	for (const i of lst) {
		key2sv.set(
			i.sample + '.' + i.chrA + '.' + i.posA + '.' + i.strandA + '.' + i.chrB + '.' + i.posB + '.' + i.strandB,
			i
		)
	}
	return [...key2sv.values()]
}

export function vcfvariantisgermline(ms, tk) {
	/*
	harcode: either somatic or germline
	ms as an item from tk.data_vcf[].sampledata[]
	tk
	*/

	if (!ms) return false

	if (tk.legend_vorigin && tk.legend_vorigin.key) {
		const v = ms[tk.legend_vorigin.key]
		if (v) {
			if (v.toLowerCase() == tk.legend_vorigin.germline) return true
		}
	}
	return false
}

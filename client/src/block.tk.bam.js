import { select as d3select, event as d3event, mouse as d3mouse } from 'd3-selection'
import { axisRight, axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from './dom/axisstyle'
import { newpane } from './client'
import { Menu } from './dom/menu'
import { sayerror } from './dom/sayerror'
import { appear } from './dom/animation'
import { dofetch3 } from './common/dofetch'
import { make_radios } from './dom/radiobutton'
import { make_one_checkbox } from './dom/checkbox'
import urlmap from './common/urlmap'

/*
important: tk.uninitialized will be deleted by getData at the first launch
to tell backend to provide color scale

tk can predefine if bam file has chr or not

******* rows ********

see makeTk for order of rows; following boolean flags indicate visibility of rows
tk.pileup_shown
tk.toomanyreads
tk.gdc{} // if defined. delete later!
tk.dom.variantg // if defined.

******* attributes ********

tk.downloadgdc // Downloads bam file from gdc
tk.gdc // Renders gdc bam file
tk.variants[ {} ]
	.chr/pos/ref/alt
        .altseq  // Contains leftflankseq + alt_allele + rightflankseq
        .refseq  // Contains leftflankseq + ref_allele + rightflankseq
        .leftflankseq // Contains sequence on the left hand side of the variant 
        .rightflankseq // Contains sequence on the right hand side of the variant
tk.pileupheight
tk.pileupbottompad
tk.alleleAlreadyUpdated // When true (in case of pan/zoom by user) prevents repeated reference genome queries for alt/refallele and left/rightflankseq


tk.dom{}
.pileup_axis // left side
.pileup_g // contains image
.pileup_img
.vsliderg
.read_limit_g
.read_limit_text

tk.groups[]
.data{}
	.type
	.messages[ {t} ] 
	.templatebox[{}] // optional, about the templates in view range
	         // server decides if to return template boxes (at poststack_adjustq)
	.count {r,t} // r for reads, t for templates
.data_fullstack{}
	.stackcount
	.stackheight
	.allowpartstack
.dom{}
	.groupg
	.message_rowg
	.imgg
	.img_fullstack
	.img_partstack
	.box_move
	.box_stay
	.vslider{}
		.g
		.bar <rect> // gray rail
		.boxg <g> // green slider
		.box <rect>
		.boxbotline
		.boxtopline
		.boxh
		.boxy
	.variantg <g>
	.variantrowheight
	.variantrowbottompad
        .gdc
        .gdcrowheight
        .gdcrowbottompad
        .fs_string // For displaying fisher strand score
.clickedtemplate // set when a template is clicked
	.qname
	.isfirst
	.islast
.partstack{}
	.start
	.stop
.height
.file
.url
.gdc   // one string with token and case id joined by comma

enter_partstack()
getReadInfo
   alignment_button // For displaying read alignment between read vs ref/alt allele when q.variant is true
*/

const labyspace = 5
const stackpagesize = 60
const slider_rail_color = '#eee'
const slider_color = '#c7edc5'
const slider_color_dark = '#9ed19b'
const slider_color_dark_line = '#36a32f'
const messagerowheight = 15 // message row height

export async function loadTk(tk, block) {
	block.tkcloakon(tk)
	block.block_setheight()

	if (tk.uninitialized) {
		makeTk(tk, block)
	}

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = []

	let xoff = 0
	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: xoff
		})
		xoff += r.width + block.regionspace
	}

	for (const [idx, r] of block.subpanels.entries()) {
		xoff += r.leftpad
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			exonsf: r.exonsf,
			subpanelidx: idx,
			x: xoff
		})
		xoff += r.width
	}
	tk.regions = regions

	try {
		// loadTk is called by pan/zoom, and will always cancel partstack
		if (tk.groups) {
			for (const g of tk.groups) {
				delete g.partstack
				delete g.dom.rightg.vslider.boxy
			}
		}

		const data = await getData(tk, block)
		if (data.error) throw data.error // including "no reads" message
		if (data.colorscale) {
			// available from 1st query, cache
			tk.colorscale = data.colorscale
		}

		// When original ref or alt allele given by user is missing or "-"
		if (tk.variants && tk.variants[0].pos != data.allele_pos) {
			tk.variants[0].pos = data.allele_pos
			tk.variants[0].ref = data.ref_allele
			tk.variants[0].alt = data.alt_allele
		}

		renderTk(data, tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		if (tk.pileup_shown) {
			tk.dom.pileup_axis.selectAll('*').remove()
			tk.dom.pileup_img.attr('width', 0)
		}
		if (tk.groups) {
			for (const g of tk.groups) {
				g.dom.img_fullstack.attr('width', 0).attr('height', 0)
				g.dom.img_partstack.attr('width', 0).attr('height', 0)
				g.dom.img_cover.attr('width', 0).attr('height', 0)
			}
		}
		tk.height_main = tk.height = 100
		block.tkcloakoff(tk, { error: e.message || e })
	}

	block.block_setheight()
}

async function getData(tk, block, additional = []) {
	let headers
	let lst = [
		'genome=' + block.genome.name,
		'regions=' + JSON.stringify(tk.regions),
		'nucleotide_length=' + block.exonsf,
		'pileupheight=' + tk.pileupheight,
		...additional
	]
	if (tk.variants) {
		lst.push(
			'variant=' + tk.variants.map(m => m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt + '.' + m.strictness).join('.')
		)
		lst.push('diff_score_plotwidth=' + tk.dom.diff_score_plotwidth)
		if (Number.isFinite(tk.max_diff_score)) {
			lst.push('max_diff_score=' + tk.max_diff_score)
			lst.push('min_diff_score=' + tk.min_diff_score)
		}
	}
	if (tk.variants && tk.alleleAlreadyUpdated) {
		// Prevent passing of refseq and altseq from server to client side in subsequent request
		lst.push('alleleAlreadyUpdated=1')
		lst.push('refseq=' + tk.variants[0].refseq)
		lst.push('altseq=' + tk.variants[0].altseq)
		lst.push('leftflankseq=' + tk.variants[0].leftflankseq)
		lst.push('rightflankseq=' + tk.variants[0].rightflankseq)
	}
	if (tk.uninitialized) {
		lst.push('getcolorscale=1')
		delete tk.uninitialized
	}
	if (tk.asPaired) {
		lst.push('asPaired=1')
	}
	if ('nochr' in tk) {
		lst.push('nochr=' + tk.nochr)
	}

	if (tk.gdc) {
		headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		headers['X-Auth-Token'] = tk.gdc
	}
	if (tk.gdc_file) {
		lst.push('gdc_file=' + tk.gdc_file)
	}

	// FIXME clean up
	//delete orig_regions
	let gdc_bam_files
	let orig_regions = []
	if (tk.downloadgdc) {
		lst.push('downloadgdc=' + tk.downloadgdc)
		gdc_bam_files = await dofetch3('tkbam?' + lst.join('&'), { headers })
		tk.file = gdc_bam_files[0] // This will need to be changed to a loop when viewing multiple regions in the same sample
		if (gdc_bam_files.error) throw gdc_bam_files.error
		delete tk.downloadgdc
		lst = lst.filter(a => a != 'downloadgdc=1') //remove this key after file download
		for (const r of tk.regions) {
			orig_regions.push(r)
		}
		tk.orig_regions = orig_regions
	}

	if (tk.file) lst.push('file=' + tk.file)

	if (tk.url) lst.push('url=' + tk.url)
	if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)

	if (tk.drop_pcrduplicates) lst.push('drop_pcrduplicates=1')

	if (window.devicePixelRatio > 1) lst.push('devicePixelRatio=' + window.devicePixelRatio)
	const data = await dofetch3('tkbam?' + lst.join('&'), { headers })
	if (tk.variants && !tk.alleleAlreadyUpdated) {
		tk.variants[0].refseq = data.refseq
		tk.variants[0].altseq = data.altseq
		tk.variants[0].leftflankseq = data.leftflankseq
		tk.variants[0].rightflankseq = data.rightflankseq
		tk.alleleAlreadyUpdated = true
	}
	if (data.error) throw data.error
	return data
}

function renderTk(data, tk, block) {
	/*
server can either generate groups anew (1. upon init 2. change blast parameter),
or update existing groups, in which groupidx will be provided
1. pan or zoom
2. update indel match parameter
3. change/cancel variant
*/

	if ('nochr' in data) tk.nochr = data.nochr // only set to tk when nochr is returned from server

	if (data.pileup_data) {
		// update the pileup image
		tk.pileup_shown = true
		tk.dom.pileup_img
			.attr('xlink:href', data.pileup_data.src)
			.attr('width', data.pileup_data.width)
			.attr('height', tk.pileupheight)
		// update axis
		tk.dom.pileup_axis.selectAll('*').remove()
		const scale = scaleLinear()
			.domain([0, data.pileup_data.maxValue])
			.range([tk.pileupheight, 0])
		axisstyle({
			axis: tk.dom.pileup_axis.call(
				axisRight()
					.scale(scale)
					.ticks(5)
			), // at most 5 ticks
			color: 'black',
			showline: true
		})
	} else {
		// pileup not returned when there's no visible reads (other cases?)
		tk.pileup_shown = false
		tk.dom.pileup_axis.selectAll('*').remove()
		tk.dom.pileup_img.attr('width', 0)
	}

	if (data.count.read_limit_reached) {
		// too many reads
		tk.toomanyreads = true
		tk.dom.read_limit_text
			.text(
				`Downsampled to ${data.groups.reduce((i, j) => i + j.count.r, 0)} from ${
					data.count.read_limit_reached
				} reads. Try zooming into a smaller region.`
			)
			.attr('x', data.pileup_data.width / 2)
			.attr('transform', 'scale(1)')
	} else {
		tk.toomanyreads = false
		tk.dom.read_limit_text.attr('transform', 'scale(0)')
	}

	may_render_variant(data, tk, block)

	if (!tk.groups) {
		tk.groups = []
		for (const g of data.groups) {
			const gd = makeGroup(g, tk, block, data)
			tk.groups.push(gd)
			/*
			if (tk.variants && (gd.data.type == 'support_alt' || gd.data.type == 'support_ref')) {
				gd.dom.message_row
					.on('mouseover', () => {
						gd.dom.message_row.style('text-decoration', 'underline')
					})
					.on('mouseleave', () => {
						gd.dom.message_row.style('text-decoration', 'none')
					})
				gd.dom.message_row.on('click', async () => {
					getMultiReadAligInfo(tk, gd, block) // Generating multiple sequence alignment against ref/alt allele
				})
			}
			*/
		}
	} else {
		updateExistingGroups(data, tk, block)
	}

	// show messages
	for (const g of tk.groups) {
		g.dom.message_rowg.selectAll('*').remove()
		let y = 0
		for (const m of g.data.messages) {
			const msg = g.dom.message_rowg
				.append('text')
				.attr('x', block.width / 2)
				.attr('y', y + messagerowheight - 1)
				.attr('font-size', messagerowheight)
				.attr('text-anchor', 'middle')
				.text(m.t)
			if (m.isheader) {
				// this message is the header of the group, allow clickable
				msg.attr('class', 'sja_clbtext2').on('click', () => {
					click_groupheader(tk, g, block)
				})
			}
			y += messagerowheight
		}
	}

	setTkHeight(tk)

	let countr = 0, // #read
		countt = 0 // #templates
	for (const g of tk.groups) {
		countr += g.data.count.r
		if (tk.asPaired) {
			countt += g.data.count.t
		}
	}
	tk.label_count
		.text((countr ? countr + ' reads' : '') + (countt ? ', ' + countt + ' templates' : ''))
		.each(function() {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	if (data.count.skipped) {
		tk.label_skip.text(data.count.skipped + ' reads skipped').each(function() {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	} else {
		tk.label_skip.text('')
	}
	block.setllabel()
	tk.kmer_diff_scores_asc = data.kmer_diff_scores_asc
}

function may_render_gdc(data, tk, block) {
	// call everytime track is updated, so that variant box can be positioned based on view range; even when there's no variant
	// in tk.dom.gdc, indicate location and status of the variant
	// TODO show variant info alongside box, when box is wide enough, show
	tk.dom.gdc_g.selectAll('*').remove()
	let x1, x2 // on screen pixel start/stop of the variant box
	{
		// Currently this supports only single-region. In the future, multiregion support will be added.
		const hits = block.seekcoord(tk.orig_regions[0].chr, tk.orig_regions[0].start)
		if (hits.length == 0) return
		if (hits) {
			x1 = hits[0].x - block.exonsf / 2
		}
	}
	{
		const hits = block.seekcoord(tk.orig_regions[0].chr, tk.orig_regions[0].stop)
		if (hits.length == 0) return
		if (hits) {
			x2 = hits[0].x - block.exonsf / 2
		}
	}
	if (x1 >= block.width || x2 <= 0) {
		// gdc viewrange is out of range, do not show
		return
	}

	// will render gdc region box in a row
	//tk.dom.gdc_g
	//	.append('rect')
	//	.attr('x', x1)
	//	.attr('width', x2 - x1)
	//	.attr('height', tk.dom.gdcrowheight - 2)
	//
	//const gdc_string = 'Query region'
	//// Determining where to place the text. Before, inside or after the box
	//let gdc_start_text_pos = 0
	//const space_param = 10
	//const pad_param = 15
	//if (gdc_string.length * space_param < x1) {
	//	gdc_start_text_pos = 0
	//} else {
	//	gdc_start_text_pos = x2 + pad_param
	//}
	//
	//tk.dom.gdc_g
	//	.append('text')
	//	.attr('x', gdc_start_text_pos)
	//	.attr('y', tk.dom.gdcrowheight)
	//	.attr('font-size', tk.dom.gdcrowheight)
	//	.text(gdc_string)
}

function may_render_variant(data, tk, block) {
	// call everytime track is updated, so that variant box can be positioned based on view range; even when there's no variant
	// in tk.dom.variantg, indicate location and status of the variant
	// TODO show variant info alongside box, when box is wide enough, show
	if (!tk.dom.variantg) return
	tk.dom.variantg.selectAll('*').remove()
	let x1, x2 // on screen pixel start/stop of the variant box
	{
		const hits = block.seekcoord(tk.variants[0].chr, tk.variants[0].pos)
		if (hits) {
			x1 = hits[0].x - block.exonsf / 2
		}
	}
	{
		const hits = block.seekcoord(tk.variants[0].chr, tk.variants[0].pos + tk.variants[0].ref.length)
		if (hits) {
			x2 = hits[0].x - block.exonsf / 2
		}
	}
	if (x1 >= block.width || x2 <= 0) {
		// variant is out of range, do not show
		return
	}

	// will render variant in a row
	let variant_box_width = x2 - x1
	if (x2 > data.pileup_data.width) {
		variant_box_width = data.pileup_data.width - x1
	} else if (x1 < 0) {
		variant_box_width = x2
	}

	tk.dom.variantg
		.append('rect')
		.attr('x', Math.max(0, x1))
		.attr('width', variant_box_width)
		.attr('height', tk.dom.variantrowheight)
		.attr('fill', 'grey')

	const variant_string =
		tk.variants[0].chr + '.' + (data.allele_pos + 1).toString() + '.' + data.ref_allele + '.' + data.alt_allele
	// Determining where to place the text. Before, inside or after the box
	let variant_start_text_pos = 0
	const space_param = 10
	const pad_param = 15

	const var_str = tk.dom.variantg
		.append('text')
		.attr('y', tk.dom.variantrowheight - 2) // -2 is a quick fix to put text at vertical center (need better method)
		.attr('font-size', tk.dom.variantrowheight)
		.text(variant_string)

	const var_str_bbox = var_str.node().getBBox() // .node() will get the DOM/SVG

	if (var_str_bbox.width + space_param < x1) {
		// Before variant box
		variant_start_text_pos = x1 - var_str_bbox.width - space_param
	} else if (var_str_bbox.width < variant_box_width) {
		// Inside variant box, center align
		variant_start_text_pos = Math.max(0, x1) + (variant_box_width - var_str_bbox.width) / 2
	} else if (x2 + var_str_bbox.width < data.pileup_data.width) {
		// After variant box but when variant_string length is lower than pileup plot width
		variant_start_text_pos = x2 + space_param
	}
	var_str.attr('x', variant_start_text_pos)

	if (data.refalleleerror == true) {
		// When ref allele is not correct
		let text_start_pos = 0
		const incorrect_string = tk.dom.variantg
			.append('text')
			.attr('x', text_start_pos)
			.attr('y', tk.dom.variantrowheight)
			.style('fill', 'red')
			.attr('font-size', tk.dom.variantrowheight)
			.text('Incorrect reference allele')

		const incorrect_ref_bbox = incorrect_string.node().getBBox() // .node() will get the DOM/SVG

		// Determining position to place the string and avoid overwriting variant string
		if (variant_start_text_pos == 0 && incorrect_ref_bbox.width + space_param < x1 - var_str_bbox.width - space_param) {
			// When variant string starts from zero (when string is too big)
			text_start_pos = var_str_bbox.width + space_param
		} else if (
			variant_start_text_pos == 0 &&
			incorrect_ref_bbox.width + space_param > x1 - var_str_bbox.width - space_param // When variant string starts from zero (when string is too big)
		) {
			text_start_pos = x2 + space_param
		} else if (
			var_str_bbox.width + space_param < x1 &&
			x2 + incorrect_ref_bbox.width + space_param < data.pileup_data.width
		) {
			// When variant string is rendered before variant box and incorrect string can fit after variant box
			text_start_pos = x2 + space_param
		} else if (
			var_str_bbox.width + space_param < x1 &&
			x2 + incorrect_ref_bbox.width + space_param >= data.pileup_data.width &&
			incorrect_ref_bbox.width + space_param < variant_box_width
		) {
			// When variant string is rendered before variant box and incorrect string cannot fit after variant box, then rendered within variant box
			text_start_pos = Math.max(0, x1)
		} else if (
			var_str_bbox.width + space_param < x1 &&
			x2 + incorrect_ref_bbox.width + space_param >= data.pileup_data.width
		) {
			text_start_pos = x1 - var_str_bbox.width - space_param * 2 - incorrect_ref_bbox.width
		} else if (var_str_bbox.width < variant_box_width && incorrect_ref_bbox.width + space_param < x1) {
			// When variant string inside variant box and incorrect string as sufficient space on left hand side
			text_start_pos = x1 - incorrect_ref_bbox.width - space_param
		} else if (var_str_bbox.width < variant_box_width && incorrect_ref_bbox.width + space_param >= x1) {
			// When variant string inside variant box and incorrect string as sufficient space on right hand side
			text_start_pos = x2 + space_param
		} else if (x2 + var_str_bbox.width < data.pileup_data.width && incorrect_ref_bbox.width + space_param < x1) {
			// When variant string after variant box and incorrect space has sufficient space on left hand side
			text_start_pos = x1 - incorrect_ref_bbox.width - space_param
		} else if (x2 + var_str_bbox.width < data.pileup_data.width && incorrect_ref_bbox.width + space_param >= x1) {
			// When variant string after variant box and incorrect space has sufficient space on right hand side
			text_start_pos = x2 + var_str_bbox.width + 2 * space_param
		} else if (x2 + var_str_bbox.width < data.pileup_data.width && incorrect_ref_bbox.width < variant_box_width) {
			// When variant string after variant box and incorrect space has sufficient space inside variant box
			text_start_pos = Math.max(0, x1)
		}

		incorrect_string.attr('x', text_start_pos)
	}

	// Rendering FS score
	let text_fs_score = 0
	tk.fs_string.text('FS = ' + data.strand_probability)

	if (data.strand_significance) {
		// Change color to red if FS score is significant
		tk.fs_string.style('fill', 'red')
	} else {
		// Change color back to black when its no longer significant
		tk.fs_string.style('fill', 'black')
	}

	//Show information about FS in tooltip on click
	tk.fs_string.on('click', () => {
		tk.tktip.clear().showunder(d3event.target)
		tk.tktip.d
			.append('div')
			.style('width', '300px')
			.html(
				"<span>Fisher strand (FS) analysis score containing p-values in phred scale (-10*log(p-value)). If FS > <a href='https://gatk.broadinstitute.org/hc/en-us/articles/360035890471' target='_blank'>60</a>, the variant maybe a sequencing artifact and highlighted in red.</br></br>To compute the p-value, Fisher's exact test is used for variants with a sequencing depth <= 300. If depth > 300, chi-squared test is used.</span>"
			)
			.style('font-size', '12px')
	})

	if (Number.isFinite(data.max_diff_score)) {
		// Should always be true if variant field was given by user, but may change in the future
		tk.dom.variantg
			.append('text')
			.attr('x', data.pileup_data.width + 5)
			.attr('y', -20 + tk.dom.variantrowheight)
			.attr('font-size', tk.dom.variantrowheight)
			.text('Diff Score')
	}
}

function setTkHeight(tk) {
	// FIXME TODO should set yoffset of all subtracks here (pileup, read_limit, variant, gdc, groups)
	// call after any group is updated
	let h = 0
	if (tk.pileup_shown) h += tk.pileupheight + tk.pileupbottompad
	if (tk.toomanyreads) {
		h += tk.dom.read_limit_height
		tk.dom.read_limit_text.attr('y', h)
		h += tk.dom.read_limit_bottompad
	}
	//if (tk.gdc) {
	//	tk.dom.gdc_g.attr('transform', 'translate(0,' + h + ')')
	//	h += tk.dom.gdcrowheight + tk.dom.gdcrowbottompad
	//}
	if (tk.dom.variantg) {
		tk.dom.variantg.attr('transform', 'translate(0,' + h + ')')
		h += tk.dom.variantrowheight + tk.dom.variantrowbottompad
	}
	for (const g of tk.groups) {
		g.dom.groupg.transition().attr('transform', 'translate(0,' + h + ')')
		g.dom.rightg.transition().attr('transform', 'translate(0,' + h + ')') // Both diff_score plot and vslider are inside this

		const msgheight = messagerowheight * g.data.messages.length // sum of height from all messages
		//g.dom.message_rowg.transition().attr('transform', 'translate(0,0)') //not needed
		g.dom.imgg.transition().attr('transform', 'translate(0,' + msgheight + ')')

		if (tk.variants) {
			g.dom.diff_score_barplot_fullstack.transition().attr('transform', 'translate(0,' + msgheight + ')')
		}
		if (g.partstack) {
			// slider visible
			if (tk.variants) {
				g.dom.diff_score_barplot_partstack.transition().attr('transform', 'translate(0,' + msgheight + ')')
				g.dom.rightg.vslider.g
					.transition()
					.attr('transform', 'translate(' + tk.dom.diff_score_plotwidth * 1.1 + ',' + msgheight + ') scale(1)')
			} else {
				g.dom.rightg.vslider.g.transition().attr('transform', 'translate(0,0) scale(1)')
			}
		}
		h += g.data.height + msgheight
	}
	tk.height_main = tk.height = h
	tk.height_main += tk.toppad + tk.bottompad
}

function updateExistingGroups(data, tk, block) {
	// to update all existing groups and reset each group to fullstack
	for (const gd of data.groups) {
		const group = tk.groups.find(g => g.data.type == gd.type)
		if (!group) continue // throw 'unknown group type: ' + gd.type
		group.data = gd

		update_boxes(group, tk, block)

		// in full stack
		group.dom.img_fullstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)

		if (tk.variants) {
			group.dom.diff_score_barplot_fullstack
				.attr('xlink:href', gd.diff_scores_img.src)
				.attr('width', gd.diff_scores_img.width)
				.attr('height', gd.diff_scores_img.height)
		}

		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		if (tk.variants) {
			group.dom.diff_score_barplot_partstack.attr('width', 0).attr('height', 0)
		}

		//tk.config_handle.transition().attr('x', 0)
		group.dom.rightg.vslider.g.transition().attr('transform', 'scale(0)')
		group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
	}
}

function update_boxes(group, tk, block) {
	// update move/stay boxes after getting new data
	group.dom.box_move.attr('width', 0)
	update_box_stay(group, tk, block)
}

function update_box_stay(group, tk, block) {
	// just the stay box
	if (!group.data.templatebox) {
		group.dom.box_stay.attr('width', 0)
		return
	}
	if (!group.clickedtemplate) {
		group.dom.box_stay.attr('width', 0)
		return
	}
	for (const t of group.data.templatebox) {
		if (t.qname == group.clickedtemplate.qname) {
			if (tk.asPaired || (t.isfirst && group.clickedtemplate.isfirst) || (t.islast && group.clickedtemplate.islast)) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				group.dom.box_stay
					.attr('width', bx2 - bx1)
					.attr('height', t.y2 - t.y1)
					.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
				return
			}
		}
	}
	// clicked template not found
	group.dom.box_stay.attr('width', 0)
}

function makeTk(tk, block) {
	may_add_urlparameter(tk)

	// if to hide PCR or optical duplicates
	if (tk.drop_pcrduplicates == undefined) {
		// attribute is not set, set to true by default
		tk.drop_pcrduplicates = true
	}

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})

	tk.readpane = newpane({ x: 100, y: 100, closekeep: 1 })
	tk.readpane.pane.style('display', 'none')

	tk.alignpane = newpane({ x: 100, y: 100, closekeep: 1 }) // Panel for showing multi_read alignment to ref/alt allele
	tk.alignpane.pane.style('display', 'none')

	tk.pileupheight = 100
	tk.pileupbottompad = 6

	///////////// row #1: pileup
	tk.dom = {
		pileup_g: tk.glider.append('g'),
		pileup_axis: tk.glider.append('g'),
		read_limit_height: 15,
		read_limit_bottompad: 6,
		read_limit_g: tk.glider.append('g')
	}
	tk.dom.pileup_img = tk.dom.pileup_g.append('image') // pileup track height is defined

	///////////// row #2: too many reads
	tk.dom.read_limit_text = tk.dom.read_limit_g
		.append('text')
		.style('fill', 'red')
		.attr('text-anchor', 'middle')
		.attr('font-size', tk.dom.read_limit_height)
		.attr('transform', 'scale(0)')

	///////////// row #3: variant
	if (tk.variants) {
		// assuming that variant will only be added upon track initiation
		tk.dom.variantg = tk.glider.append('g')
		tk.dom.variantrowheight = 15
		tk.dom.variantrowbottompad = 5
		tk.dom.diff_score_axis = tk.gright.append('g') // For storing axis of bar plot of diff_score
		tk.dom.diff_score_plotwidth = 50
		tk.fs_string = block.maketklefthandle(tk, tk.pileupheight + tk.dom.variantrowheight / 2) // Will contain Fisher strand value which will be added in may_render_variant function
	}

	///////////// row #4: gdc region XXX delete and replace with bedj indicator track
	//if (tk.gdc) {
	//	tk.dom.gdc_g = tk.glider.append('g')
	//	tk.dom.gdcrowheight = 15
	//	tk.dom.gdcrowbottompad = 5
	//}

	///////////// row #5+: one for each group; <g> of a group is added dynamically to glider

	tk.asPaired = false

	let laby = block.labelfontsize + 5
	tk.label_count = block.maketklefthandle(tk, laby)
	laby += block.labelfontsize
	tk.label_skip = block.maketklefthandle(tk, laby).text('')
}

// may add additional parameters from url that specifically apply to the bam track
function may_add_urlparameter(tk) {
	const u2p = urlmap()

	if (u2p.has('variant')) {
		/* XXX only a quick fix!
		to supply one or multiple variant from url parameter
		if there are multiple bam tracks, no way to specifiy which bam track to add the variant to
		will overwrite the existing tk.variants{}

		Do no use in production!

		the variant may be added on the fly from e.g. a vcf track in the same browser session
		*/
		const tmp = u2p.get('variant').split('.')
		if (tmp.length < 4) {
			console.log('urlparam variant should be at least 4 fields joined by .')
		} else {
			tk.variants = []
			//for (let i = 0; i < tmp.length; i += 4) {
			//	const pos = Number(tmp[i + 1])
			//	if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
			//	if (!tmp[i + 2]) return console.log('ref allele missing')
			//	if (!tmp[i + 3]) return console.log('alt allele missing')
			//	tk.variants.push({ chr: tmp[i], pos: pos - 1, ref: tmp[i + 2], alt: tmp[i + 3] })
			//}

			// The 5th value is the strictness. If multiple variants are given, strictness may have to be compulsory to avoid confusion
			for (let i = 0; i < tmp.length; i += 5) {
				const pos = Number(tmp[i + 1])
				let strictness
				if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
				//if (!tmp[i + 2]) return console.log('ref allele missing')
				//if (!tmp[i + 3]) return console.log('alt allele missing')
				if (!tmp[i + 4]) {
					strictness = 1 // Default strictness
				} else if (!Number.isFinite(Number(tmp[i + 4]))) {
					return 'Strictness must be a positive number'
				} else if (Number(tmp[i + 4]) > 2) return 'Invalid strictness'
				// For now, there are only three levels of strictness. More will be added in the future
				else {
					strictness = Number(tmp[i + 4])
				}
				tk.variants.push({ chr: tmp[i], pos: pos - 1, ref: tmp[i + 2], alt: tmp[i + 3], strictness: strictness })
			}
		}
	}

	// Checking to see if need to query GDC for bam file
	if (u2p.has('gdc')) {
		const str = u2p.get('gdc')
		if (str.indexOf(',') == -1) {
			console.log('Both gdc token and gdc case id must be present')
		} else {
			tk.gdc = str
			tk.downloadgdc = 'TRUE'
		}
	}
}

function makeGroup(gd, tk, block, data) {
	// make a group object using returned data for this group, and show tk image
	const group = {
		data: gd,
		dom: {
			groupg: tk.glider.append('g'),
			rightg: tk.gright.append('g')
		}
	}
	/*
	groupg contains two <g>: message_rowg and imgg
	message_rowg:
	  render message from each group. This is later made clickable to display multi-read alignment
	  is always on the top, position does not change
	  if not empty, message_rowg will push down imgg
	*/
	group.dom.message_rowg = group.dom.groupg.append('g')
	group.dom.imgg = group.dom.groupg.append('g')
	group.dom.rightg.vslider = group.dom.rightg.append('g')
	group.dom.rightg.vslider.g = group.dom.rightg.vslider.append('g').attr('transform', 'scale(0)')

	if (tk.variants) {
		group.dom.diff_score_g = group.dom.rightg.append('g') // For storing bar plot of diff_score
		group.dom.diff_score_barplot_fullstack = group.dom.diff_score_g
			.append('image')
			.attr('xlink:href', gd.diff_scores_img.src)
			.attr('width', gd.diff_scores_img.width)
			.attr('height', gd.diff_scores_img.height)
		group.dom.diff_score_barplot_partstack = group.dom.diff_score_g
			.append('image')
			.attr('xlink:href', gd.diff_scores_img.src)
			.attr('width', 0)
			.attr('height', 0)

		if (!group.allowpartstack && !Number.isFinite(tk.max_diff_score) && tk.variants) {
			// Set max and min diff_score in full stack mode
			tk.max_diff_score = data.max_diff_score
			tk.min_diff_score = data.min_diff_score
		}

		let diff_score_height = tk.pileupheight + tk.dom.variantrowheight * 2

		if (tk.toomanyreads) {
			// When reads are downsampled a new row is created, therefore an additional row is needed, so the diff_score_axis needs to be pushed one row down so that it does not overlap with "Diff Score" text
			diff_score_height = tk.pileupheight + tk.dom.variantrowheight * 3
		}
		const axis = axisTop()
			.tickValues([tk.min_diff_score.toFixed(1), tk.max_diff_score.toFixed(1)])
			.scale(
				scaleLinear()
					.domain([tk.min_diff_score.toFixed(1), tk.max_diff_score.toFixed(1)])
					.range([0, gd.diff_scores_img.width])
			)
		axisstyle({
			axis: tk.dom.diff_score_axis
				.transition()
				.attr('transform', 'translate(' + 0 + ',' + diff_score_height + ')')
				.call(axis),
			color: 'black',
			showline: true
		})
	}

	group.dom.img_fullstack = group.dom.imgg
		.append('image')
		.attr('xlink:href', group.data.src)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
	group.dom.img_partstack = group.dom.imgg
		.append('image')
		.attr('width', 0)
		.attr('height', 0)

	// put flyers behind cover
	group.dom.box_move = group.dom.imgg
		.append('rect')
		.attr('stroke', 'black')
		.attr('fill', 'none')
	group.dom.box_stay = group.dom.imgg
		.append('rect')
		.attr('stroke', 'magenta')
		.attr('fill', 'none')

	let mousedownx // not to trigger clicking after press and drag on a read
	group.dom.img_cover = group.dom.imgg
		.append('rect')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
		.on('mousedown', () => {
			mousedownx = d3event.clientX
		})
		.on('mousemove', () => {
			if (group.data.allowpartstack) {
				// TODO expand dom.box_move with full width and height to cover minimum expandable reads
				return
			}
			if (!group.data.templatebox) return
			const [mx, my] = d3mouse(group.dom.img_cover.node())
			for (const t of group.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					group.dom.box_move
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
					return
				}
			}
		})
		.on('click', () => {
			if (mousedownx != d3event.clientX) return
			const [mx, my] = d3mouse(group.dom.img_cover.node())
			if (group.data.allowpartstack) {
				enter_partstack(group, tk, block, my, data)
				return
			}
			if (!group.data.templatebox) return
			for (const t of group.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					if (group.clickedtemplate && group.clickedtemplate.qname == t.qname) {
						// same template
						if (
							tk.asPaired ||
							(t.isfirst && group.clickedtemplate.isfirst) ||
							(t.islast && group.clickedtemplate.islast)
						) {
							// paired mode
							// or single mode and correct read
							// box under cursor is highlighted, cancel
							delete group.clickedtemplate
							group.dom.box_stay.attr('width', 0)
							return
						}
					}
					// a different template or different read from the same template
					// overwrite
					group.clickedtemplate = {
						qname: t.qname
					}
					if (tk.asPaired) {
						group.clickedtemplate.isfirst = true
					} else {
						if (t.isfirst) group.clickedtemplate.isfirst = true
						if (t.islast) group.clickedtemplate.islast = true
					}
					group.dom.box_stay
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')

					getReadInfo(tk, block, t, block.pxoff2region(mx)[0])
					return
				}
			}
		})

	group.dom.rightg.vslider.bar = group.dom.rightg.vslider.g
		.append('rect')
		.attr('fill', slider_rail_color)
		.attr('x', 10)
		.attr('width', 20)
		.on('mouseover', () => group.dom.rightg.vslider.bar.attr('fill', '#fae8e8'))
		.on('mouseout', () => group.dom.rightg.vslider.bar.attr('fill', slider_rail_color))
		.on('click', () => {
			delete group.dom.rightg.vslider.boxy
			delete group.partstack
			group.data = group.data_fullstack
			renderGroup(group, tk, block)
			setTkHeight(tk)
			block.block_setheight()
		})
	group.dom.rightg.vslider.boxg = group.dom.rightg.vslider.g.append('g')
	group.dom.rightg.vslider.box = group.dom.rightg.vslider.boxg
		.append('rect')
		.attr('fill', slider_color)
		.attr('width', 40)
		.on('mousedown', () => {
			d3event.preventDefault()
			group.dom.rightg.vslider.box.attr('fill', slider_color_dark)
			const scrollableheight = group.data.height
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.rightg.vslider.boxy + d <= 0) return
				} else {
					if (group.dom.rightg.vslider.boxy + d >= scrollableheight - group.dom.rightg.vslider.boxh) return
				}
				deltay = d
				group.dom.rightg.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.rightg.vslider.boxy + deltay) + ')')
				group.dom.img_partstack.attr(
					'y',
					-((deltay * group.data_fullstack.stackcount * group.data.stackheight) / scrollableheight)
				)
				group.dom.box_move.attr('width', 0)
				group.dom.box_stay.attr('width', 0)
			})
			b.on('mouseup', async () => {
				group.dom.rightg.vslider.box.attr('fill', slider_color)
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.rightg.vslider.boxy += deltay
				const delta = Math.ceil((group.data_fullstack.stackcount * deltay) / scrollableheight)
				group.partstack.start += delta
				group.partstack.stop += delta
				block.tkcloakon(tk)
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop,
					'grouptype=' + group.data.type
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				setTkHeight(tk)
				block.tkcloakoff(tk, {})
				block.block_setheight()
			})
		})

	group.dom.rightg.vslider.boxtopline = group.dom.rightg.vslider.boxg
		.append('line')
		.attr('stroke', slider_color_dark)
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.rightg.vslider.boxtopline.attr('stroke', slider_color_dark_line))
		.on('mouseout', () => group.dom.rightg.vslider.boxtopline.attr('stroke', slider_color_dark))
		.on('mousedown', () => {
			d3event.preventDefault()
			const scrollableheight = group.data.height
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.rightg.vslider.boxy + d <= 0) return
				} else {
					if (group.dom.rightg.vslider.boxh - d <= (stackpagesize * scrollableheight) / group.data_fullstack.stackcount)
						return
				}
				deltay = d
				group.dom.rightg.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.rightg.vslider.boxy + deltay) + ')')
				group.dom.rightg.vslider.box.attr('height', group.dom.rightg.vslider.boxh - deltay)
				group.dom.rightg.vslider.boxbotline
					.attr('y1', group.dom.rightg.vslider.boxh - deltay)
					.attr('y2', group.dom.rightg.vslider.boxh - deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.rightg.vslider.boxy += deltay
				group.partstack.start += Math.ceil((group.data_fullstack.stackcount * deltay) / scrollableheight)
				block.tkcloakon(tk)
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop,
					'grouptype=' + group.data.type
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				block.tkcloakoff(tk, {})
				setTkHeight(tk)
				block.block_setheight()
			})
		})
	group.dom.rightg.vslider.boxbotline = group.dom.rightg.vslider.boxg
		.append('line')
		.attr('stroke', slider_color_dark)
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.rightg.vslider.boxbotline.attr('stroke', slider_color_dark_line))
		.on('mouseout', () => group.dom.rightg.vslider.boxbotline.attr('stroke', slider_color_dark))
		.on('mousedown', () => {
			d3event.preventDefault()
			const scrollableheight = group.data.height
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.rightg.vslider.boxh + d <= (stackpagesize * scrollableheight) / group.data_fullstack.stackcount)
						return
				} else {
					if (group.dom.rightg.vslider.boxy + d >= scrollableheight - group.dom.rightg.vslider.boxh) return
				}
				deltay = d
				group.dom.rightg.vslider.box.attr('height', group.dom.rightg.vslider.boxh + deltay)
				group.dom.rightg.vslider.boxbotline
					.attr('y1', group.dom.rightg.vslider.boxh + deltay)
					.attr('y2', group.dom.rightg.vslider.boxh + deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.rightg.vslider.boxh += deltay
				group.partstack.stop += Math.ceil((group.data_fullstack.stackcount * deltay) / scrollableheight)
				block.tkcloakon(tk)
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop,
					'grouptype=' + group.data.type
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				setTkHeight(tk)
				block.tkcloakoff(tk, {})
				block.block_setheight()
			})
		})

	return group
}

async function align_reads_to_allele(tk, group, block) {
	// Read alignment against allele is only done when tk.variants is defined
	const alig_lst = []
	alig_lst.push('alignOneGroup=' + group.data.type)
	alig_lst.push('genome=' + block.genome.name)
	alig_lst.push('regions=' + JSON.stringify(tk.regions))
	if (tk.file) alig_lst.push('file=' + tk.file)
	alig_lst.push(
		'variant=' + tk.variants.map(m => m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt + '.' + m.strictness).join('.')
	)
	if (tk.alleleAlreadyUpdated) {
		// This should always be true when this function is invoked, but adding this if condition for safety sake
		alig_lst.push('alleleAlreadyUpdated=1')
		alig_lst.push('refseq=' + tk.variants[0].refseq)
		alig_lst.push('altseq=' + tk.variants[0].altseq)
		alig_lst.push('leftflankseq=' + tk.variants[0].leftflankseq)
		alig_lst.push('rightflankseq=' + tk.variants[0].rightflankseq)
	}
	if (tk.uninitialized) {
		alig_lst.push('getcolorscale=1')
		delete tk.uninitialized
	}
	if (tk.asPaired) {
		alig_lst.push('asPaired=1')
	}
	if ('nochr' in tk) {
		alig_lst.push('nochr=' + tk.nochr)
	}
	if (tk.drop_pcrduplicates) alig_lst.push('drop_pcrduplicates=1')
	if (group.partstack) {
		alig_lst.push('stackstart=' + group.partstack.start)
		alig_lst.push('stackstop=' + group.partstack.stop)
		alig_lst.push('grouptype=' + group.data.type)
	}
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	return await dofetch3('tkbam?' + alig_lst.join('&'), { headers })
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const d = tk.tkconfigtip.d.append('div')

	{
		const row = d.append('div')
		row
			.append('span')
			.html('Show reads as:&nbsp;')
			.style('opacity', 0.5)
			.style('margin', '10px 5px')
		make_radios({
			holder: row,
			options: [
				{ label: 'Single', value: false, checked: !tk.asPaired },
				{ label: 'Paired', value: true, checked: tk.asPaired }
			],
			styles: { display: 'inline-block', margin: '10px 5px' },
			callback: v => {
				tk.asPaired = v
				loadTk(tk, block)
			},
			inputName: 'show-reads-radios' /* Fix for show reads and strictness radio 
			buttons operating independently */
		})
	}
	{
		make_one_checkbox({
			holder: d.append('div'),
			labeltext: 'Drop PCR or optical duplicates',
			checked: tk.drop_pcrduplicates,
			callback: () => {
				tk.drop_pcrduplicates = !tk.drop_pcrduplicates
				loadTk(tk, block)
			}
		})
	}
	if (tk.variants) {
		if (!tk.variants[0].strictness) {
			// When using example.bam.indel.html the strictness value is not defined. In such cases using a default value of strictness = 1.
			tk.variants[0].strictness = 1
		}
		const row = d.append('div')
		row
			.append('span')
			.html('Strictness:&nbsp;')
			.style('opacity', 0.5)
			.style('margin', '10px 5px')
		make_radios({
			holder: row,
			options: [
				{ label: '0', value: 0, checked: tk.variants[0].strictness == 0 },
				{ label: '1', value: 1, checked: tk.variants[0].strictness == 1 },
				{ label: '2', value: 2, checked: tk.variants[0].strictness == 2 }
			],
			styles: { display: 'inline-block', margin: '10px 5px' },
			callback: v => {
				tk.variants[0].strictness = v
				loadTk(tk, block)
			},
			inputName: 'strictness-radios' /* Fix for show reads and strictness radio 
			buttons operating independently */
		})
	}

	d
		.append('div')
		.style('font-size', '.8em')
		.style('width', '300px').html(`
	<ul style="padding-left:15px">
	  <li><b>Matches</b> are rendered as gray boxes aligned to the reference.</li>
	  <li><b>Mismatches</b> will be checked when 1 bp is wider than 1 pixel, and are rendered as red boxes aligned to the reference.</li>
	  <li><b>Softclips</b> are rendered as blue boxes not aligned to the reference.</li>
	  <li><b>Base qualities</b> are rendered when 1 bp is wider than 2 pixels. See color scale below. When base quality is not used or is unavailable, full colors are used.</li>
	  <li><b>Sequences</b> from mismatch and softclip will be printed when 1 bp is wider than 7 pixels.</li>
	  <li>An <b>insertion</b> with on-screen size wider than 1 pixel will be rendered as cyan text between aligned bases, in either a letter or the number of inserted bp. Text color scales by average base quality when that is in use.</li>
	  <li><b>Deletions</b> are gaps joined by red horizontal lines.</li>
	  <li><b>Split reads</b> and splice junctions are indicated by solid gray lines.</li>
	  <li><b>Read pairs</b> are joined by dashed gray lines.</li>
	</ul>`)
	d.append('div')
		.style('margin-top', '10px')
		.append('img')
		.attr('src', tk.colorscale)
}

/*
get info for a read/template
if is single mode, will be single read and with first/last info
if is pair mode, is the template
box{}
  qname, start, stop
*/

function click_groupheader(tk, group, block) {
	if (tk.variants && (group.data.type == 'support_alt' || group.data.type == 'support_ref')) {
		// when merge to master, add this condition
		//if (urlmap().has('clustalo')) {
		getMultiReadAligInfo(tk, group, block)
		//}
	}
}
async function getMultiReadAligInfo(tk, group, block) {
	appear(tk.alignpane.pane)
	tk.alignpane.pane.style('display', 'table')
	tk.alignpane.header.text('Alignment info')
	tk.alignpane.body.selectAll('*').remove()
	const wait = tk.alignpane.body.append('div').text('Loading...')
	const multi_read_alig_data = await align_reads_to_allele(tk, group, block) // Sending server side request for aligning reads to ref/alt
	console.log('multi_read_alig_data:', multi_read_alig_data.alignmentData)
	wait.remove()

	const num_read_div = tk.alignpane.body // Printing number of reads aligned in alignment panel
		.append('div')
		.text('Number of reads aligned = ' + multi_read_alig_data.alignmentData.read_count)
		.style('text-align', 'center')
	if (multi_read_alig_data.alignmentData.partstack_start) {
		// In partstack mode
		const partstack_div = tk.alignpane.body
			.append('div')
			.text(
				'Reads aligned from ' +
					multi_read_alig_data.alignmentData.partstack_start +
					' to ' +
					multi_read_alig_data.alignmentData.partstack_stop
			)
			.style('text-align', 'center')
	}

	const div = tk.alignpane.body.append('div').style('margin', '20px')
	const readAlignmentTable = div
		.append('table')
		.style('font-family', 'Courier')
		.style('font-size', '0.8em')
		.style('color', '#303030')
		.style('margin', '5px 5px 20px 5px')
	readAlignmentTable
		.style('border-spacing', 0)
		.style('border-collapse', 'separate')
		.style('text-align', 'center')
		.style('empty-cells', 'show')

	// Drawing ref/alt allele bar
	let refallele_tr = readAlignmentTable
		.append('tr')
		.style('color', 'white')
		.style('background-color', 'white')
	let variant_string // This will contain the variant bar along with Refeerence/ Alternate allele label
	let nclt_count = 0
	let allele_start = 0 // Flag to tell if the variant region has been reached or not. After that position alternate/reference allele will be rendered
	let variant_string_count = 0 // Iterator for variant string letters

	// Determine if alt/ref allele string needs to be placed inside variant box
	let inside_variant_box = 1 // Flag for determining if variant string needs to be placed inside variant box or to the right of it. 0 for inside and 1 for being placed on the right
	if (group.data.type == 'support_alt') {
		variant_string = 'Alternate allele'
		if (variant_string.length < tk.variants[0].alt.length) {
			inside_variant_box = 0
		} else {
			variant_string = ' Alternate allele'
		}
	} else if (group.data.type == 'support_ref') {
		variant_string = 'Reference allele'
		if (variant_string.length < tk.variants[0].ref.length) {
			inside_variant_box = 0
		} else {
			variant_string = ' Reference allele'
		}
	}

	for (const nclt of multi_read_alig_data.alignmentData.final_read_align[0]) {
		nclt_count += 1
		const refallele_td = refallele_tr.append('td')

		// Drawing ref/alt allele bar
		if (
			group.data.type == 'support_alt' &&
			nclt_count > tk.variants[0].leftflankseq.length + multi_read_alig_data.alignmentData.gaps_before_variant &&
			nclt_count <=
				tk.variants[0].leftflankseq.length +
					tk.variants[0].alt.length +
					multi_read_alig_data.alignmentData.gaps_before_variant
		) {
			if (inside_variant_box == 1) {
				allele_start = 1
				refallele_td
					.text(' ')
					.style('text-align', 'right')
					.style('font-weight', '550')
					.style('margin', '5px 5px 10px 5px')
					.style('color', 'black')
					.style('background-color', 'black')
			} else {
				if (variant_string_count < variant_string.length) {
					refallele_td
						.text(variant_string[variant_string_count])
						.style('text-align', 'right')
						.style('font-weight', '550')
						.style('margin', '5px 5px 10px 5px')
						.style('color', 'white')
						.style('background-color', 'black')
					variant_string_count += 1
				} else {
					refallele_td
						.text(' ')
						.style('text-align', 'right')
						.style('font-weight', '550')
						.style('margin', '5px 5px 10px 5px')
						.style('color', 'black')
						.style('background-color', 'black')
				}
			}
		} else if (
			group.data.type == 'support_ref' &&
			nclt_count > tk.variants[0].leftflankseq.length + multi_read_alig_data.alignmentData.gaps_before_variant &&
			nclt_count <=
				tk.variants[0].leftflankseq.length +
					tk.variants[0].ref.length +
					multi_read_alig_data.alignmentData.gaps_before_variant
		) {
			if (inside_variant_box == 1) {
				allele_start = 1
				refallele_td
					.text('')
					.style('text-align', 'right')
					.style('font-weight', '550')
					.style('margin', '5px 5px 10px 5px')
					.style('color', 'black')
					.style('background-color', 'black')
			} else {
				if (variant_string_count < variant_string.length) {
					refallele_td
						.text(variant_string[variant_string_count])
						.style('text-align', 'right')
						.style('font-weight', '550')
						.style('margin', '5px 5px 10px 5px')
						.style('color', 'white')
						.style('background-color', 'black')
					variant_string_count += 1
				} else {
					refallele_td
						.text('')
						.style('text-align', 'right')
						.style('font-weight', '550')
						.style('margin', '5px 5px 10px 5px')
						.style('color', 'black')
						.style('background-color', 'black')
				}
			}
		} else if (allele_start == 1 && inside_variant_box == 1) {
			refallele_td
				.text(variant_string[variant_string_count])
				.style('text-align', 'right')
				.style('font-weight', '550')
				.style('margin', '5px 5px 10px 5px')
				.style('color', 'black')
				.style('background-color', 'white')
			variant_string_count += 1
			if (variant_string_count == variant_string.length) {
				allele_start = 0
			}
		} else {
			refallele_td
				.text('')
				.style('text-align', 'right')
				.style('font-weight', '550')
				.style('margin', '5px 5px 10px 5px')
				.style('color', 'white')
				.style('background-color', 'white')
		}
	}

	// Drawing alignments for ref/alt allele and each of the reads
	let read_count = 0
	for (const read of multi_read_alig_data.alignmentData.final_read_align) {
		const read_tr = readAlignmentTable
			.append('tr')
			.style('color', 'white')
			.style('background-color', 'grey')
		const r_colors = multi_read_alig_data.alignmentData.qual_r[read_count].split(',')
		const g_colors = multi_read_alig_data.alignmentData.qual_g[read_count].split(',')
		const b_colors = multi_read_alig_data.alignmentData.qual_b[read_count].split(',')

		let nclt_count = 0
		for (const nclt of read) {
			nclt_count += 1
			let nclt_td
			if (read_count == 0) {
				nclt_td = read_tr
					.append('td')
					.text(nclt)
					.style('background-color', 'white')
					.style('color', 'black')
					.style('font-weight', '550')
			} else {
				nclt_td = read_tr
					.append('td')
					.text(nclt)
					.style(
						'background-color',
						'rgb(' + r_colors[nclt_count - 1] + ',' + g_colors[nclt_count - 1] + ',' + b_colors[nclt_count - 1] + ')'
					)
				if (nclt != '-') {
					nclt_td.style('color', 'white')
				} else {
					nclt_td.style('color', 'black')
				}
			}

			// Highlighting nucleotides that are within the ref/alt allele
			if (
				group.data.type == 'support_alt' &&
				nclt_count > tk.variants[0].leftflankseq.length + multi_read_alig_data.alignmentData.gaps_before_variant &&
				nclt_count <=
					tk.variants[0].leftflankseq.length +
						tk.variants[0].alt.length +
						multi_read_alig_data.alignmentData.gaps_before_variant
			) {
				nclt_td.style('color', 'black')
			} else if (
				group.data.type == 'support_ref' &&
				nclt_count > tk.variants[0].leftflankseq.length + multi_read_alig_data.alignmentData.gaps_before_variant &&
				nclt_count <=
					tk.variants[0].leftflankseq.length +
						tk.variants[0].ref.length +
						multi_read_alig_data.alignmentData.gaps_before_variant
			) {
				nclt_td.style('color', 'black')
			}
		}
		read_count += 1
	}
}

async function getReadInfo(tk, block, box, ridx) {
	appear(tk.readpane.pane)
	tk.readpane.header.text('Read info')
	tk.readpane.body.selectAll('*').remove()
	const wait = tk.readpane.body.append('div').text('Loading...')
	const req_data = getparam()
	if (tk.variants) {
		req_data.lst.push('refseq=' + tk.variants[0].refseq)
		req_data.lst.push('altseq=' + tk.variants[0].altseq)
	}
	const data = await dofetch3('tkbam?' + req_data.lst.join('&'), { headers: req_data.headers })
	if (data.error) {
		sayerror(wait, data.error)
		return
	}
	wait.remove()

	for (const r of data.lst) {
		// {seq, alignment (html), info (html) }
		const div = tk.readpane.body.append('div').style('margin', '20px')

		div.append('div').html(r.alignment)

		/*** 
			Firefox does not seem to support the permision query name == 'clipboard-write'. 
			Tested that removing this permission check works in Chrome, Safari, FF.
			May need to reactivate the permission check if users report issues. 
		***/
		/*const result = await navigator.permissions.query({ name: 'clipboard-write' })
		if (result.state != 'granted' && result.state != 'prompt') {
			console.log(681, result)
			// no copy button
		} else {
		}*/

		const row = div.append('div').style('margin-top', '10px')
		row
			.append('button')
			.text('Copy read sequence')
			.on('click', function() {
				navigator.clipboard.writeText(r.seq).then(() => {}, console.warn)
				d3select(this)
					.append('span')
					.html('&nbsp;&check;')
			})
		/*Creates read alignment table when 'Read alignment' button
		is clicked. 
		type
			'Ref' - reference
			'Alt' - alternate */
		//TODO: make pane scrollable if the read is too long. Detect if pane is 1000px for example
		function makeReadAlignmentTable(div, type, tk, read_start_pos) {
			let q_align, align_wrt, r_align
			if (type == 'Ref') {
				q_align = data.lst[0].q_align_ref
				align_wrt = data.lst[0].align_wrt_ref
				r_align = data.lst[0].r_align_ref
			}
			if (type == 'Alt') {
				q_align = data.lst[0].q_align_alt
				align_wrt = data.lst[0].align_wrt_alt
				r_align = data.lst[0].r_align_alt
			}
			div
				.append('span')
				.text(type + ' alignment')
				.style('font-family', 'Courier')
				.style('font-size', '15px')
				.style('color', '#303030')
				.style('margin', '5px 5px 10px 5px')
			const readAlignmentTable = div
				.append('table')
				.style('font-family', 'Courier')
				.style('font-size', '0.8em')
				.style('color', '#303030')
				.style('margin', '5px 5px 20px 5px')
			const query_tr = readAlignmentTable.append('tr')
			query_tr
				.append('td')
				.text('Read')
				.style('text-align', 'right')
				.style('font-weight', '550')
			let nclt_count = 0
			for (const nclt of q_align) {
				nclt_count += 1
				if (nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos)) {
					query_tr.append('td').text(nclt)
				} else if (
					type == 'Ref' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].ref.length
				) {
					query_tr
						.append('td')
						.text(nclt)
						.style('color', 'red')
				} else if (
					type == 'Alt' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].alt.length
				) {
					query_tr
						.append('td')
						.text(nclt)
						.style('color', 'red')
				} else {
					query_tr.append('td').text(nclt)
				}
			}
			const alignment_tr = readAlignmentTable.append('tr')
			alignment_tr.append('td')
			nclt_count = 0
			for (const align_str of align_wrt) {
				nclt_count += 1
				if (nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos)) {
					alignment_tr.append('td').text(align_str)
				} else if (
					type == 'Ref' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].ref.length
				) {
					alignment_tr
						.append('td')
						.text(align_str)
						.style('color', 'red')
				} else if (
					type == 'Alt' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].alt.length
				) {
					alignment_tr
						.append('td')
						.text(align_str)
						.style('color', 'red')
				} else {
					alignment_tr.append('td').text(align_str)
				}
			}
			const refAlt_tr = readAlignmentTable.append('tr')
			refAlt_tr
				.append('td')
				.text(type + ' allele')
				.style('text-align', 'right')
				.style('font-weight', '550')
				.style('white-space', 'nowrap')
			nclt_count = 0
			for (const nclt of r_align) {
				nclt_count += 1
				if (nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos)) {
					refAlt_tr.append('td').text(nclt)
				} else if (
					type == 'Ref' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].ref.length
				) {
					refAlt_tr
						.append('td')
						.text(nclt)
						.style('color', 'red')
				} else if (
					type == 'Alt' &&
					nclt_count > Math.abs(tk.variants[0].pos - read_start_pos) &&
					nclt_count <= Math.abs(tk.variants[0].pos - read_start_pos) + tk.variants[0].alt.length
				) {
					refAlt_tr
						.append('td')
						.text(nclt)
						.style('color', 'red')
				} else {
					refAlt_tr.append('td').text(nclt)
				}
			}
		}

		if (data.lst[0].q_align_alt) {
			// Invoked only if variant is specified
			d3select(this)
				.append('span')
				.html('&nbsp;')
			const alignment_button = row
				.append('button')
				.style('margin-left', '10px')
				.text('Read alignment')

			let first = true // use this flag to only make the table once when clicking the button for the first time
			alignment_button.on('click', async () => {
				if (first) {
					first = false
					makeReadAlignmentTable(variantAlignmentTable, 'Ref', tk, data.lst[0].start_readpos - 1)
					makeReadAlignmentTable(variantAlignmentTable, 'Alt', tk, data.lst[0].start_readpos - 1)
				}
				if (variantAlignmentTable.style('display') == 'none') {
					variantAlignmentTable.style('display', 'block')
				} else {
					variantAlignmentTable.style('display', 'none')
				}
			})
		}

		if (r.unmapped_mate && !tk.asPaired) {
			// this read has unmapped mate
			// only show button to request unmapped mate when tk is in single-read mode
			// if tk is in paired mode, then the unmapped read is already displayed
			const mate_button = row
				.append('button')
				.style('margin-left', '10px')
				.text('Show unmapped mate')
				.on('click', async () => {
					mate_button.property('disabled', true) // disable this button
					const wait = tk.readpane.body.append('div').text('Loading...')
					const req_data = getparam('show_unmapped=1')
					const data2 = await dofetch3('tkbam?' + req_data.lst.join('&'), { headers: req_data.headers })
					if (data2.error) {
						wait.text('')
						sayerror(wait, data2.error)
						mate_button.property('disabled', false) // reenable this button
						return
					}
					wait.remove()
					mate_button.remove()

					const r2 = data2.lst[0]
					div.append('div').html(r2.alignment)

					const row = div.append('div').style('margin-top', '10px')
					row
						.append('button')
						.text('Copy read sequence')
						.on('click', function() {
							navigator.clipboard.writeText(r2.seq).then(() => {}, console.warn)
							d3select(this)
								.append('span')
								.html('&nbsp;&check;')
						})
					mayshow_blatbutton(r2, row, tk, block)
					div.append('div').html(r2.info)
				})
		}

		mayshow_blatbutton(r, row, tk, block)
		div.append('div').html(r.info)
		//empty div for read alignment tables
		const variantAlignmentTable = div.append('div').style('display', 'none')
	}

	function getparam(extra) {
		// reusable helper
		const r = block.rglst[ridx]
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		const lst = [
			'getread=1',
			'qname=' + encodeURIComponent(box.qname), // convert + to %2B, so it can be kept the same but not a space instead
			'genome=' + block.genome.name,
			'chr=' + r.chr,
			'start=' + r.start,
			'stop=' + r.stop
		]
		if (tk.nochr) lst.push('nochr=1')
		if (tk.file) lst.push('file=' + tk.file)
		if (tk.url) lst.push('url=' + tk.url)
		if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)
		if (tk.gdc) {
			headers['X-Auth-Token'] = tk.gdc
		}
		if (tk.asPaired) {
			lst.push('getpair=1')
		} else {
			if (box.isfirst) {
				lst.push('getfirst=1')
			} else if (box.islast) {
				lst.push('getlast=1')
			} else {
				// unknown order for this read
				// supply read position to identify it on server
				lst.push('unknownorder=1')
				lst.push('readstart=' + box.start)
				lst.push('readstop=' + box.stop)
			}
		}
		if (extra) lst.push(extra)
		return { lst, headers }
	}
}

function mayshow_blatbutton(read, div, tk, block) {
	if (!block.genome.blat) {
		// blat not enabled
		return
	}
	const button = div
		.append('button')
		.style('margin-left', '10px')
		.text('BLAT')
		.on('click', async () => {
			button.property('disabled', true)
			blatdiv.selectAll('*').remove()
			const wait = blatdiv.append('div').text('Loading...')
			try {
				const data = await dofetch3(
					'blat?genome=' +
						block.genome.name +
						'&seq=' +
						read.seq +
						'&soft_starts=' +
						read.soft_starts +
						'&soft_stops=' +
						read.soft_stops
				)
				if (data.error) throw data.error
				if (data.nohit) throw 'No hit'
				if (!data.hits) throw '.hits[] missing'
				wait.remove()
				show_blatresult(data.hits, blatdiv, tk, block)
			} catch (e) {
				wait.text(e.message || e)
				if (e.stack) console.log(e.stack)
			}
			button.property('disabled', false)
		})

	const blatdiv = div.append('div')
}
function show_blatresult3(hits, div, tk, block, lst) {
	tk.readpane.body.selectAll('*').remove()

	for (const r of lst) {
		// {seq, alignment (html), info (html) }
		const div = tk.readpane.body.append('div').style('margin', '20px')
		div.append('div').html(r.alignment)
	}

	const width = 200
	const height = 200
	const svg = div
		.append('svg')
		.attr('width', width)
		.attr('height', height)
	svg
		.append('line')
		.attr('x1', 100)
		.attr('y1', 100)
		.attr('x2', 200)
		.attr('y2', 200)
		.style('stroke', 'rgb(255,0,0)')
		.style('stroke-width', 2)
}

function show_blatresult2(hits, div, tk, block) {
	const table = div.append('table')
	const tr = table
		.append('tr')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
	tr.append('td').text('Score')
	tr.append('td').text('QStart')
	tr.append('td').text('QStrand')
	tr.append('td').text('QAlignLen')
	tr.append('td').text('RChr')
	tr.append('td').text('RStrand')
	tr.append('td').text('RStart')
	tr.append('td').text('RAlignLen')
	let repeat_file_present = 0
	for (const track of block.genome.tracks) {
		if (track['name'] == 'RepeatMasker') {
			tr.append('td').text('InRepeatRegion')
			repeat_file_present = 1
			break
		}
	}
	tr.append('td').text('SeqAlign')

	let soft_clipped_region = ''
	let non_soft_clipped_region = ''
	for (const h of hits) {
		let tr = table.append('tr')
		tr.append('td').text(h.score)
		tr.append('td').text(h.query_startpos)
		tr.append('td').text(h.query_strand)
		tr.append('td').text(h.query_alignlen)
		tr.append('td').text(h.ref_chr)
		tr.append('td').text(h.ref_strand)
		tr.append('td').text(h.ref_startpos)
		tr.append('td').text(h.ref_alignlen)
		if (repeat_file_present == 1) {
			//console.log('h.ref_in_repeat:', h.ref_in_repeat)
			tr.append('td').text(h.ref_in_repeat)
		}

		if (h.query_insoftclip == true) {
			if (h.query_soft_boundaries == '-1') {
				// Alignment completely inside softclip
				tr.append('td')
					.text(h.query_alignment.toUpperCase() + ' Query')
					.style('font-family', 'courier')
					.style('color', 'blue')
			} else {
				const boundaries = h.query_soft_boundaries.split(':')
				const direction = boundaries[0]
				const boundary = parseInt(boundaries[1])
				if (direction == 'right') {
					// Softclip is on left side and alignment extends onto the right
					soft_clipped_region = h.query_alignment.substr(0, boundary - parseInt(h.query_startpos))
					non_soft_clipped_region = h.query_alignment.substr(boundary - parseInt(h.query_startpos), h.query_stoppos)
					const td = tr.append('td')
					td.append('span')
						.text(soft_clipped_region.toUpperCase())
						.style('font-family', 'courier')
						.style('color', 'black')
					td.append('span')
						.text(non_soft_clipped_region.toUpperCase())
						.style('font-family', 'courier')
						.style('color', 'blue')
					td.append('span')
						.text(' Query')
						.style('font-family', 'courier')
						.style('color', 'black')
				} else if (direction == 'left') {
					// Softclip is on right side and alignment extends onto the left
					non_soft_clipped_region = h.query_alignment.substr(0, boundary - parseInt(h.query_startpos))
					soft_clipped_region = h.query_alignment.substr(boundary - parseInt(h.query_startpos), h.query_stoppos)
					const td = tr.append('td')
					td.append('span')
						.text(non_soft_clipped_region.toUpperCase())
						.style('font-family', 'courier')
						.style('color', 'blue')
					td.append('span')
						.text(soft_clipped_region.toUpperCase())
						.style('font-family', 'courier')
						.style('color', 'black')
					td.append('span')
						.text(' Query')
						.style('font-family', 'courier')
						.style('color', 'black')
				} else {
					console.log('Something is not right, please check!!')
				}
			}
		} else {
			tr.append('td')
				.text(h.query_alignment.toUpperCase() + ' Query')
				.style('font-family', 'courier')
		}

		tr = table.append('tr')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td').text('')
		tr.append('td')
			.text(h.ref_alignment.toUpperCase() + ' Ref')
			.style('font-family', 'courier')
		//                if (h.query_insoftclip==true) {
		//		   tr.append('td')
		//			.text(h.ref_alignment.toUpperCase() + ' Ref')
		//			.style('font-family', 'courier').style('color', 'blue')
		//                }
		//                else {
		//		   tr.append('td')
		//			.text(h.ref_alignment.toUpperCase() + ' Ref')
		//			.style('font-family', 'courier')
		//                }
	}
}

async function enter_partstack(group, tk, block, y, data) {
	/* for a group, enter part stack mode rom full stack mode
	will only update data and rendering of this group, but not other groups
	*/
	group.data_fullstack = group.data
	const clickstackidx = (group.partstack ? group.partstack.start : 0) + Math.floor(y / group.data.stackheight)
	// set start/stop of tk.partstack, ensure stop-start=stackpagesize
	if (clickstackidx < stackpagesize / 2) {
		// clicked too close to top
		group.partstack = {
			start: 0,
			stop: stackpagesize
		}
	} else if (clickstackidx > group.data_fullstack.stackcount - stackpagesize / 2) {
		// clicked too close to bottom
		group.partstack = {
			start: group.data_fullstack.stackcount - stackpagesize,
			stop: group.data_fullstack.stackcount
		}
	} else {
		group.partstack = {
			start: clickstackidx - stackpagesize / 2,
			stop: clickstackidx + stackpagesize / 2
		}
	}
	block.tkcloakon(tk)
	const _d = await getData(tk, block, [
		'stackstart=' + group.partstack.start,
		'stackstop=' + group.partstack.stop,
		'grouptype=' + group.data.type
	])
	group.data = _d.groups[0]
	renderGroup(group, tk, block)

	setTkHeight(tk)
	block.tkcloakoff(tk, {})
	block.block_setheight()
}

function show_blatresult(hits, div, tk, block) {
	const table = div.append('table')
	const tr = table
		.append('tr')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
	tr.append('td').text('QScore')
	tr.append('td').text('QStart')
	tr.append('td').text('QStop')
	tr.append('td').text('QStrand')
	tr.append('td').text('QAlignLen')
	tr.append('td').text('RChr')
	tr.append('td').text('RStart')
	tr.append('td').text('RStop')
	tr.append('td').text('RAlignLen')

	for (const h of hits) {
		let tr = table.append('tr').style('font-size', '.8em')
		tr.append('td').text(h.query_match)
		tr.append('td').text(h.query_startpos)
		tr.append('td').text(h.query_stoppos)
		tr.append('td').text(h.query_strand)
		tr.append('td').text(h.query_alignlen)
		tr.append('td').text(h.ref_chr)
		tr.append('td').text(h.ref_startpos)
		tr.append('td').text(h.ref_stoppos)
		tr.append('td').text(h.ref_alignlen)
	}
}

function renderGroup(group, tk, block) {
	update_boxes(group, tk, block)
	if (group.partstack) {
		if (tk.variants) {
			group.dom.diff_score_barplot_partstack
				.attr('xlink:href', group.data.diff_scores_img.src)
				.attr('width', group.data.diff_scores_img.width)
				.attr('height', group.data.diff_scores_img.height)
		}
		group.dom.img_partstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
			.attr('y', 0)
		group.dom.img_fullstack.attr('width', 0).attr('height', 0)
		if (tk.variants) {
			group.dom.diff_score_barplot_fullstack.attr('width', 0).attr('height', 0)
		}
		// group vslider.g y position is set and turned visible in setTkHeight(), but not here
		const scrollableheight = group.data.height
		group.dom.rightg.vslider.bar.transition().attr('height', scrollableheight)
		group.dom.rightg.vslider.boxy = (scrollableheight * group.partstack.start) / group.data_fullstack.stackcount
		group.dom.rightg.vslider.boxh =
			(scrollableheight * (group.partstack.stop - group.partstack.start)) / group.data_fullstack.stackcount
		group.dom.rightg.vslider.box.transition().attr('height', group.dom.rightg.vslider.boxh)
		group.dom.rightg.vslider.boxbotline
			.transition()
			.attr('y1', group.dom.rightg.vslider.boxh)
			.attr('y2', group.dom.rightg.vslider.boxh)
		group.dom.rightg.vslider.boxg.transition().attr('transform', 'translate(0,' + group.dom.rightg.vslider.boxy + ')')
	} else {
		group.dom.img_fullstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		if (tk.variants) {
			if (group.dom.diff_score_barplot_partstack) {
				group.dom.diff_score_barplot_partstack.attr('width', 0).attr('height', 0)
			}
			group.dom.diff_score_barplot_fullstack
				.attr('width', group.data.diff_scores_img.width)
				.attr('height', group.data.diff_scores_img.height)
		}
		group.dom.rightg.vslider.g.transition().attr('transform', 'scale(0)')
	}
	group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
}

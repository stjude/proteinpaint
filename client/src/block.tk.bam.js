import { select as d3select } from 'd3-selection'
import { pointer } from 'd3-selection'
import { axisRight, axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { dofetch3 } from '#common/dofetch'
import { Menu, axisstyle, sayerror, make_radios, make_table_2col, make_one_checkbox } from '#dom'
import urlmap from '#common/urlmap'

/*
important: tk.uninitialized will be deleted by getData at the first launch
to tell backend to provide color scale

tk can predefine if bam file has chr or not

******* rows ********

see makeTk for order of rows; following boolean flags indicate visibility of rows
tk.pileup_shown
tk.toomanyreads
tk.dom.variantg // if defined.

******* attributes ********

tk.gdcFile={} // the tk runs on a valid gdc bam slice
	.uuid=str
	.position=str
tk.gdcToken // gdc token string
tk.variants[ {} ]
	.chr/pos/ref/alt
        .altseq  // Contains leftflankseq + alt_allele + rightflankseq
        .refseq  // Contains leftflankseq + ref_allele + rightflankseq
        .leftflankseq // Contains sequence on the left hand side of the variant 
        .rightflankseq // Contains sequence on the right hand side of the variant
tk.pileupheight
tk.pileupbottompad
tk.alleleAlreadyUpdated // When true (in case of pan/zoom by user) prevents repeated reference genome queries for alt/refallele and left/rightflankseq
tk.drop_pcrduplicates // By default, hides PCR duplicates. Can be changed to show PCR duplicates from config panel
tk.drop_supplementary_alignments // By default, hides supplementary alignments. Can be changed to show supplementary alignments from config panel
tk.show_readnames // Shows read names when this flag is true. By default, read names are hidden

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
const stackheight_min = 7 // Minimum stack height for displaying read names

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
	// Check if there ia any common region between the two regions (assuming there are only two regions), if yes then show only one region
	// This does not fully work on testing. When pan/zoomed into common region but only one region shows reads, the other is empty
	//if (regions.length == 2) {
	//	if (
	//		regions[0].chr == regions[1].chr &&
	//		regions[0].start <= regions[1].start &&
	//		regions[1].start <= regions[0].stop
	//	) {
	//		regions[0].stop = regions[1].stop
	//		tk.regions = [regions[0]]
	//	} else if (
	//		regions[0].chr == regions[1].chr &&
	//		regions[1].start <= regions[0].start &&
	//		regions[0].start <= regions[1].stop
	//	) {
	//		regions[0].start = regions[1].start
	//		tk.regions = [regions[0]]
	//	} else {
	//		tk.regions = regions
	//	}
	//} else {
	//	tk.regions = regions
	//}
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
		if (tk.variants) {
			for (let var_idx = 0; var_idx < tk.variants.length; var_idx++) {
				if (tk.variants[var_idx].pos != data.allele_positions[var_idx]) {
					tk.variants[var_idx].pos = data.allele_positions[var_idx]
					tk.variants[var_idx].ref = data.ref_alleles[var_idx]
					tk.variants[var_idx].alt = data.alt_alleles[var_idx]
				}
			}
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

		if (typeof e == 'string' && e.startsWith('No reads in view range')) {
			// makeshift method for server to signal "no read" to client and wipe these labels
			tk.leftlabel_count.text('')
			tk.leftlabel_skip.text('')
		}

		block.tkcloakoff(tk, { error: e.message || e })
	}
	setLeftlabelWidth(tk, block)

	block.block_setheight()
}

async function getData(tk, block, additional = {}) {
	const body = {
		genome: block.genome.name,
		regions: tk.regions,
		nucleotide_length: block.exonsf,
		pileupheight: tk.pileupheight,
		...additional
	}

	if (tk.gdcFile) {
		body.gdcFileUUID = tk.gdcFile.uuid
		body.gdcFilePosition = tk.gdcFile.position
	}

	if (tk.variants) {
		body.variant = tk.variants.map(m => m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt).join('.')
		body.strictness = tk.strictness
		body.diff_score_plotwidth = tk.dom.diff_score_plotwidth
		if (Number.isFinite(tk.max_diff_score)) {
			body.max_diff_score = tk.max_diff_score
			body.min_diff_score = tk.min_diff_score
		}
	} else if (tk.sv) {
		if (tk.sv[0].strandA == '+') {
			tk.sv[0].strandA = 'positive'
		} else if (tk.sv[0].strandA == '-') {
			tk.sv[0].strandA = 'negative'
		}
		if (tk.sv[0].strandB == '+') {
			tk.sv[0].strandB = 'positive'
		} else if (tk.sv[0].strandB == '-') {
			tk.sv[0].strandB = 'negative'
		}

		body.sv = tk.sv
			.map(m => m.chrA + '.' + m.startA + '.' + m.strandA + '.' + m.chrB + '.' + m.startB + '.' + m.strandB)
			.join('.')
	}

	if (tk.variants && tk.alleleAlreadyUpdated) {
		// Prevent passing of refseq and altseq from server to client side in subsequent request
		body.alleleAlreadyUpdated = 1
		body.refseqs = tk.variants.refseqs
		body.altseqs = tk.variants.altseqs
		body.leftflankseqs = tk.variants.leftflankseqs
		body.rightflankseqs = tk.variants.rightflankseqs
		body.ref_positions = tk.variants.ref_positions
		body.refalleles = tk.variants.refalleles
		body.altalleles = tk.variants.altalleles
	}
	if (tk.uninitialized) {
		body.getcolorscale = 1
		delete tk.uninitialized
	}
	if (tk.asPaired) body.asPaired = 1
	if ('nochr' in tk) body.nochr = tk.nochr

	if (tk.file) body.file = tk.file
	if (tk.url) body.url = tk.url
	if (tk.indexURL) body.indexURL = tk.indexURL

	if (tk.drop_pcrduplicates) body.drop_pcrduplicates = 1
	if (tk.drop_supplementary_alignments) body.drop_supplementary_alignments = 1
	if (window.devicePixelRatio > 1) body.devicePixelRatio = window.devicePixelRatio

	const data = await dofetch3('tkbam', { headers: getHeaders(tk), body })

	if (tk.variants && !tk.alleleAlreadyUpdated) {
		tk.variants.refseqs = data.refseqs
		tk.variants.altseqs = data.altseqs
		tk.variants.refalleles = data.refalleles
		tk.variants.altalleles = data.altalleles
		tk.variants.leftflankseqs = data.leftflankseqs
		tk.variants.rightflankseqs = data.rightflankseqs
		tk.variants.ref_positions = data.ref_positions
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
		const scale = scaleLinear().domain([0, data.pileup_data.maxValue]).range([tk.pileupheight, 0])
		axisstyle({
			axis: tk.dom.pileup_axis.call(axisRight().scale(scale).ticks(5)), // at most 5 ticks
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
					click_groupheader_showMultiReadAlign(tk, gd, block) // Generating multiple sequence alignment against ref/alt allele
				})
			}
			*/
		}
	} else {
		updateExistingGroups(data, tk, block)
	}
	may_render_variant(data, tk, block)

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
			/*
			TODO !tk.gdcFile
				clicking header has unresolved issues in GFF, disable it in GDC until after softlaunch
				- click on 1st group will show what's from the 4th group
				- the realignment panel y position can be too high and got covered up by gdc portal component
			*/
			if (m.isheader && !tk.gdcFile) {
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

	tk.leftlabel_count.text(
		(countr ? countr + ' read' + (countr > 1 ? 's' : '') : '') +
			(countt ? ', ' + countt + ' template' + (countt > 1 ? 's' : '') : '')
	)

	if (data.count.skipped) {
		tk.leftlabel_skip.text(`${data.count.skipped} read${data.count.skipped > 1 ? 's' : ''} skipped`)
	} else {
		tk.leftlabel_skip.text('')
	}
	tk.read_alignment_diff_scores_asc = data.read_alignment_diff_scores_asc
}

// update tk.leftLabelMaxwidth and call block.setllabel() at the end of normal and error rendering
function setLeftlabelWidth(tk, block) {
	const lst = [
		tk.tklabel.node().getBBox().width,
		tk.leftlabel_count.node().getBBox().width,
		tk.leftlabel_skip.node().getBBox().width,
		tk.leftlabel_about ? tk.leftlabel_about.node().getBBox().width : 0
	]
	if (tk.show_readnames) {
		for (const g of tk.groups) lst.push(g.ReadNameMaxwidth)
	}
	tk.leftLabelMaxwidth = Math.max(...lst)
	block.setllabel() // calculate left margin based on max left width
}

function may_render_variant(data, tk, block) {
	// call everytime track is updated, so that variant box can be positioned based on view range; even when there's no variant
	// in tk.dom.variantg, indicate location and status of the variant
	// TODO show variant info alongside box, when box is wide enough, show

	if (!tk.dom.variantg || tk.sv) return
	let var_idx = 0
	for (const g of tk.groups) {
		if (g.data.type.includes('support_alt')) {
			if (g.variantg) {
				g.variantg.selectAll('*').remove()
			} else {
				g.variantg = tk.glider.append('g')
			}
			let x1, x2 // on screen pixel start/stop of the variant box
			{
				const hits = block.seekcoord(tk.variants[0].chr, tk.variants[var_idx].pos)
				if (hits[0]) {
					x1 = hits[0].x - block.exonsf / 2
				}
			}
			{
				const hits = block.seekcoord(tk.variants[0].chr, tk.variants[var_idx].pos + tk.variants[var_idx].ref.length)
				if (hits[0]) {
					x2 = hits[0].x - block.exonsf / 2
				}
			}

			if (x1 === undefined || x2 === undefined || x1 >= block.width || x2 <= 0) return // variant is out of range, do not show

			// will render variant in a row
			let variant_box_width = x2 - x1
			if (x2 > data.pileup_data.width) {
				variant_box_width = data.pileup_data.width - x1
			} else if (x1 < 0) {
				variant_box_width = x2
			}

			if (tk.variants.length == 1) {
				g.variantg
					.append('rect')
					.attr('x', Math.max(0, x1))
					.attr('width', variant_box_width)
					.attr('height', tk.dom.variantrowheight)
					.attr('fill', 'grey')
			} else {
				g.variantg
					.append('rect')
					.attr('x', Math.max(0, x1))
					.attr('width', variant_box_width)
					.attr('height', tk.dom.variantrowheight)
					.attr('fill', g.data.group_color)
			}

			const variant_string =
				tk.variants[0].chr +
				'.' +
				(data.allele_positions[var_idx] + 1).toString() +
				'.' +
				data.ref_alleles[var_idx] +
				'.' +
				data.alt_alleles[var_idx] // This is only showing the first allele, need to think of a way to show the other alleles (if present). Maybe show for each alternate allele?
			// Determining where to place the text. Before, inside or after the box
			let variant_start_text_pos = 0
			const space_param = 10
			const pad_param = 15

			const var_str = g.variantg
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
				const incorrect_string = g.variantg
					.append('text')
					.attr('x', text_start_pos)
					.attr('y', tk.dom.variantrowheight)
					.style('fill', 'red')
					.attr('font-size', tk.dom.variantrowheight)
					.text('Incorrect reference allele')

				const incorrect_ref_bbox = incorrect_string.node().getBBox() // .node() will get the DOM/SVG

				// Determining position to place the string and avoid overwriting variant string
				if (
					variant_start_text_pos == 0 &&
					incorrect_ref_bbox.width + space_param < x1 - var_str_bbox.width - space_param
				) {
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
			var_idx += 1
		}
	}

	if (tk.variants.length == 1) {
		// Rendering FS score
		tk.fs_string.text('FS = ' + data.strand_probability)

		if (data.strand_significance) {
			// Change color to red if FS score is significant
			tk.fs_string.style('fill', 'red')
		} else {
			// Change color back to black when its no longer significant
			tk.fs_string.style('fill', 'black')
		}

		//Show information about FS in tooltip on click
		tk.fs_string.on('click', event => {
			tk.tktip.clear().showunder(event.target)
			tk.tktip.d
				.append('div')
				.style('width', '350px')
				.html(
					`Fisher strand (FS) analysis score containing p-values in phred scale (-10*log(p-value)). If <a href='https://gatk.broadinstitute.org/hc/en-us/articles/360035890471' target='_blank'>FS>60</a>, the variant maybe a sequencing artifact and highlighted in red.
					</br></br>
					To compute the p-value, Fisher's exact test is used for variants with a sequencing depth <= 300. If depth > 300 and each individual category > 150, chi-squared test is used. Following table displays read counts in each category.`
				)

			const table = tk.tktip.d.append('table').style('margin-top', '20px').style('border-spacing', '5px')
			{
				// row 1
				const tr = table.append('tr').style('font-weight', 'bold')
				tr.append('td')
				tr.append('td').text('Alternative')
				tr.append('td').text('Reference')
			}
			{
				// row 2
				const tr = table.append('tr')
				tr.append('td').text('Forward').style('font-weight', 'bold')
				tr.append('td').text(data.alternate_forward_count)
				tr.append('td').text(data.reference_forward_count)
			}
			{
				// row 3
				const tr = table.append('tr')
				tr.append('td').text('Reverse').style('font-weight', 'bold')
				tr.append('td').text(data.alternate_reverse_count)
				tr.append('td').text(data.reference_reverse_count)
			}
		})
	}

	if (Number.isFinite(data.max_diff_score) && !tk.dom.alleleSimilarityHeaderLabel) {
		/* running in variant mode and need to create the allele similarity column header
		only create if missing. do not create multiple ones on every update
		*/
		tk.dom.alleleSimilarityHeaderLabel = tk.dom.alleleSimilarityHeaderG
			.append('text')
			.attr('y', 2 * tk.dom.variantrowheight)
			.attr('font-size', tk.dom.variantrowheight)
			.attr('class', 'sja_clbtext2')
			.text('Allele similarity')

		//Show information about diff score in tooltip on click
		const html_text = [
			'Allele similarity: This chart shows the allele to which the read has maximum sequence similarity. In case of alternative and reference alleles, all reads in the same group have same color. In case of none category, color representing allele with maximum sequence color is displayed. In case of ambiguous category, for each read colors representing each alleles having equal similarity to each other are displayed.'
		]

		let var_idx = 0
		html_text.push('<br>Allele color codes:')
		let old_pos = tk.variants[0].pos
		let old_ref_length = tk.variants[0].ref.length
		tk.is_same_ref = true // Tests whether the ref allele is common between all the multi-allelic variants
		let ref_color
		for (const g of tk.groups) {
			if (g.data.type.includes('support_alt')) {
				let test_text =
					'<svg width="10" height="10" style = "display:inline-block;"><rect width="10" height="10" style="fill:' +
					g.data.group_color +
					';" /> </svg> ' +
					tk.variants[var_idx].alt
				html_text.push(test_text)
				if (tk.variants[var_idx].pos != old_pos || tk.variants[var_idx].ref.length != old_ref_length) {
					tk.is_same_ref = false
				}
				var_idx += 1
			} else if (g.data.type == 'support_ref') {
				ref_color = g.data.group_color
			}
		}

		// Depicting reference allele
		if (!ref_color) {
			// This can happen when the reference group is not present
			ref_color = '#47C8FF'
		}
		if (tk.is_same_ref == true) {
			html_text.push(
				'<svg width="10" height="10" style = "display:inline-block;"><rect width="10" height="10" style="fill:' +
					ref_color +
					';" /> </svg> ' +
					tk.variants[0].ref
			)
		} else {
			html_text.push(
				'<svg width="10" height="10" style = "display:inline-block;"><rect width="10" height="10" style="fill:' +
					ref_color +
					';" /> </svg> Combined reference allele'
			)
		}

		if (!tk.gdcFile) {
			// do not add this since gdc doesn't allow linking out
			html_text.push(
				"<br><a href='https://proteinpaint.stjude.org/bam' target='_blank'>Click here to view details of this method</a>."
			)
		}
		tk.dom.alleleSimilarityHeaderLabel.on('click', event => {
			const b = event.target.getBoundingClientRect()
			tk.tktip.clear().show(b.x - 250, b.y)
			tk.tktip.d.append('div').style('width', '300px').html(html_text.join('<br>'))
		})
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
	}
	if (tk.dom.alleleSimilarityHeaderG) {
		tk.dom.alleleSimilarityHeaderG.attr('transform', 'translate(0,' + (tk.pileupheight - tk.pileupbottompad * 2) + ')')
	}

	let var_idx = 0
	for (const g of tk.groups) {
		if (g.data.type.includes('support_alt')) {
			g.variantg.attr('transform', 'translate(0,' + h + ')')
			h += tk.dom.variantrowheight + tk.dom.variantrowbottompad
			var_idx += 1
		}
		g.dom.groupg.transition().attr('transform', 'translate(0,' + h + ')')
		g.dom.rightg.transition().attr('transform', 'translate(0,' + h + ')') // Both diff_score plot and vslider are inside this

		g.msgheight = messagerowheight * g.data.messages.length // sum of height from all messages
		g.dom.leftg.transition().attr('transform', 'translate(0,' + (h + g.msgheight) + ')') // read_names_g are inside this
		//g.dom.message_rowg.transition().attr('transform', 'translate(0,0)') //not needed
		g.dom.imgg.transition().attr('transform', 'translate(0,' + g.msgheight + ')')

		if (tk.variants) {
			g.dom.diff_score_barplot_fullstack.transition().attr('transform', 'translate(0,' + g.msgheight + ')')
		}
		if (g.partstack) {
			// slider visible
			if (tk.variants) {
				g.dom.diff_score_barplot_partstack.transition().attr('transform', 'translate(0,' + g.msgheight + ')')
				g.dom.rightg.vslider.g
					.transition()
					.attr('transform', 'translate(' + tk.dom.diff_score_plotwidth * 1.1 + ',' + g.msgheight + ') scale(1)')
			} else {
				g.dom.rightg.vslider.g.transition().attr('transform', 'translate(0,0) scale(1)')
			}
		}
		h += g.data.height + g.msgheight
		if (g.data.type.includes('support_alt') && var_idx < tk.variants.length) {
			// Add space between adjacent alt allele groups, but no need to add space after the last alt allele group
			h += tk.dom.variantrowheight
		}
	}
	tk.height_main = tk.height = h
	tk.height_main += tk.toppad + tk.bottompad
}

function updateExistingGroups(data, tk, block) {
	// to update all existing groups and reset each group to fullstack
	// Check if data.groups and tk.groups have the same length. Lengths can differ when toggled between different strictness values.

	// Check which group is missing in data.groups and deleting it
	for (let i = 0; i < tk.groups.length; i++) {
		const group = data.groups.find(g => g.type == tk.groups[i].data.type)
		if (!group) {
			deleteGroupDom(tk.groups[i])
			tk.groups.splice(i, 1) // Deleting the group
		}
	}

	for (const gd of data.groups) {
		const group = tk.groups.find(g => g.data.type == gd.type)
		if (!group) {
			// Addition of extra group often take place when toggled to higher strictness. For e.g going from strictness 0 to 1 where the none category gets created
			const g = makeGroup(gd, tk, block, data)
			tk.groups.push(g)
		} else {
			group.data = gd
			update_boxes(group, tk, block)

			// in full stack
			group.dom.img_fullstack
				.attr('xlink:href', group.data.src)
				.attr('width', group.data.width)
				.attr('height', group.data.height)
			if (tk.variants) {
				group.ReadNameMaxwidth = 0
				if (tk.show_readnames) {
					if (group.data.templatebox) {
						group.dom.read_names_g.selectAll('*').remove()
						let read_count = 1
						for (const read of group.data.templatebox) {
							const read_name_bbox = group.dom.read_names_g
								.append('text')
								.attr('x', 0)
								.attr('y', (group.data.height * read_count) / group.data.templatebox.length)
								.attr('text-anchor', 'end')
								.style('fill', 'black')
								.attr('font-size', group.data.height / group.data.templatebox.length)
								.text(read.qname)
							group.ReadNameMaxwidth = Math.max(group.ReadNameMaxwidth, read_name_bbox.node().getBBox().width)
							read_count += 1
						}
					}
				} else {
					group.dom.read_names_g.selectAll('*').remove()
					group.ReadNameMaxwidth = 0
				}
				if (group.my_partstack) {
					// Checks if the y-position of click is defined or not. Helpful when show_readnames button is clicked without having to click again to invoke partstack
					if (group.data.allowpartstack) {
						enter_partstack(group, tk, block, group.my_partstack, data)
					}
				} else {
					group.dom.diff_score_barplot_fullstack
						.attr('xlink:href', gd.diff_scores_img.src)
						.attr('width', gd.diff_scores_img.width)
						.attr('height', gd.diff_scores_img.height)
				}
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

function deleteGroupDom(g) {
	g.dom.message_rowg.remove()
	g.dom.img_fullstack.remove()
	g.dom.img_partstack.remove()
	g.dom.diff_score_barplot_fullstack?.remove()
	g.dom.diff_score_barplot_partstack?.remove()
	g.dom.read_names_g?.remove()
	g.dom.leftg.remove()
	g.dom.box_stay?.remove()
	g.dom.box_move?.remove()
	g.dom.rightg.remove()
}

function makeTk(tk, block) {
	if (tk.gdcFile) {
		block.gdcBamSliceDownloadBtn.style('display', 'inline-block')
	}

	may_add_urlparameter(tk, block)

	// if to hide PCR or optical duplicates
	if (tk.drop_pcrduplicates == undefined) {
		// attribute is not set, set to true by default
		tk.drop_pcrduplicates = true
	}
	tk.drop_supplementary_alignments = false // Commenting out this functionality for now. Will later test it with a suitable example
	//if (tk.drop_supplementary_alignments == undefined) {
	//	// attribute is not set, set to true by default
	//	tk.drop_supplementary_alignments = true
	//}

	if (tk.show_readnames == undefined) {
		tk.show_readnames = false
	}

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})

	tk.readMenu = new Menu() // show read details here upon clicking a read
	// css class will force scrollbar to always show when content is too wide. if narrow scrollbar won't show
	tk.readMenu.d.style('max-width', '90vw').style('max-height', '65vh').attr('class', 'sjpp_show_scrollbar')

	tk.multiAlignMenu = new Menu() // show multi-read alignment
	tk.multiAlignMenu.d.style('max-width', '90vw').style('max-height', '65vh').attr('class', 'sjpp_show_scrollbar')

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
		tk.dom.variantg = tk.glider.append('g') // create variant mark box aligned with coord ruler
		tk.dom.alleleSimilarityHeaderG = tk.gright.append('g')
		tk.dom.variantrowheight = 15
		tk.dom.variantrowbottompad = 5
		//tk.dom.diff_score_axis = tk.gright.append('g') // For storing axis of bar plot of diff_score
		tk.dom.diff_score_plotwidth = 20
		tk.fs_string = block.maketklefthandle(tk, tk.pileupheight + tk.dom.variantrowheight / 2) // Will contain Fisher strand value which will be added in may_render_variant function
	} else if (tk.sv) {
		// assuming that variant will only be added upon track initiation
		tk.dom.variantg = tk.glider.append('g')
		tk.dom.variantrowheight = 15
		tk.dom.variantrowbottompad = 5
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
	tk.leftlabel_count = block.maketklefthandle(tk, laby)
	laby += block.labelfontsize
	tk.leftlabel_skip = block.maketklefthandle(tk, laby).text('')
	if (tk.aboutThisFile) {
		laby += block.labelfontsize
		tk.leftlabel_about = block
			.maketklefthandle(tk, laby)
			.text('About the BAM file')
			.on('mouseover', event => {
				tk.tktip.showunder(event.target).clear()
				make_table_2col(tk.tktip.d, tk.aboutThisFile)
			})
			.on('mouseout', () => {
				tk.tktip.hide()
			})
	}

	/* 
	on makeTk(), existing settings and doms must be cleared
	at block tk menu, hide and reshow this tk will trigger makeTk() on this tk a second time
	if following things are not cleared, somehow some group img will become homeless
	*/
	delete tk.alleleAlreadyUpdated
	if (tk.groups) {
		for (const g of tk.groups) deleteGroupDom(g)
		delete tk.groups
	}
}

// may add additional parameters from url that specifically apply to the bam track
function may_add_urlparameter(tk, block) {
	const u2p = urlmap()
	if (u2p.has('variant')) {
		// Check if the variant is simple string "chr.pos.ref.alt" or a complex json object

		tk.variants = []
		if (typeof u2p.get('variant') == 'string') {
			const tmp = u2p.get('variant').split('.')
			if (tmp.length == 4) {
				// Simple variant i.e chr.pos.ref.alt
				const pos = Number(tmp[1])
				if (!Number.isInteger(pos)) throw 'urlparam variant pos is not integer'
				if (!tmp[2]) throw 'ref allele missing'
				if (!tmp[3]) throw 'alt allele missing'
				tk.variants.push({ chr: tmp[0], pos: pos - 1, ref: tmp[2], alt: tmp[3], strictness: 1 })
			}
		} else {
			// json object like variant={chr:"chr1", variants:[ { pos:123, ref:A, alt:T }, {pos, ref, alt} ... ] }
			const variant_json = u2p.get('variant')
			for (const item of variant_json.variants) {
				if (!Number.isInteger(item.pos)) throw 'urlparam variant pos is not integer'
				if (!item.ref) throw 'ref allele missing'
				if (!item.alt) throw 'alt allele missing'
				tk.variants.push({ chr: variant_json.chr, pos: Number(item.pos) - 1, ref: item.ref, alt: item.alt })
			}
		}
		if (u2p.has('strictness')) {
			const tmp = u2p.get('strictness')
			if (!Number.isInteger(Number(tmp))) throw 'strictness must be an integer'
			tk.strictness = Number(tmp)
			if (tk.strictness != 1 && tk.strictness != 0) {
				throw 'strictness must be 0 or 1'
			}
		} else {
			tk.strictness = 1
		}

		// SNVs and indels
		//for (let i = 0; i < tmp.length; i += 4) {
		//	const pos = Number(tmp[i + 1])
		//	if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
		//	if (!tmp[i + 2]) return console.log('ref allele missing')
		//	if (!tmp[i + 3]) return console.log('alt allele missing')
		//	tk.variants.push({ chr: tmp[i], pos: pos - 1, ref: tmp[i + 2], alt: tmp[i + 3] })
		//}

		// The 5th value is the strictness. If multiple variants are given, strictness may have to be compulsory to avoid confusion
		//for (let i = 0; i < tmp.length; i += 5) {
		//	const pos = Number(tmp[i + 1])
		//	let strictness
		//	if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
		//	//if (!tmp[i + 2]) return console.log('ref allele missing')
		//	//if (!tmp[i + 3]) return console.log('alt allele missing')
		//	if (!tmp[i + 4]) {
		//		strictness = 1 // Default strictness
		//	} else if (!Number.isFinite(Number(tmp[i + 4]))) { //
		//		return 'Strictness must be a positive number'
		//	} else if (Number(tmp[i + 4]) > 2) return 'Invalid strictness'
		//	// For now, there are only three levels of strictness. More will be added in the future
		//	else {
		//		strictness = Number(tmp[i + 4])
		//	}
		//	tk.variants.push({ chr: tmp[i], pos: pos - 1, ref: tmp[i + 2], alt: tmp[i + 3], strictness: strictness })
		//}

		//const pos = Number(tmp[1])
		//if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
		//if (!tmp[2]) return console.log('ref allele missing')
		//if (!tmp[3]) return console.log('alt allele missing')
		//let strictness = 1
		////if (tmp.length > 4) {
		//// Multiple alternate alleles
		//const alt = []
		//for (let i = 3; i < tmp.length; i++) {
		//	if (i == tmp.length - 1) {
		//		// Parsing out strictness
		//		if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
		//		//if (!tmp[i + 2]) return console.log('ref allele missing')
		//		//if (!tmp[i + 3]) return console.log('alt allele missing')
		//		//if (!tmp[tmp.length - 1]) {
		//		//	strictness = 1 // Default strictness
		//		//} else
		//		if (!Number.isFinite(Number(tmp[tmp.length - 1]))) {
		//			// Multiple alternate allele
		//			//return 'Strictness must be a positive number'
		//			alt.push(tmp[i])
		//		} else if (Number(tmp[tmp.length - 1]) > 2) return 'Invalid strictness'
		//		// For now, there are only three levels of strictness. More may be added in the future
		//		else {
		//			strictness = Number(tmp[tmp.length - 1])
		//		}
		//	} else {
		//		// Multiple alternate alleles
		//		alt.push(tmp[i])
		//	}
		//}
		////console.log('alt:', alt)
		//tk.variants.push({ chr: tmp[0], pos: pos - 1, ref: tmp[2], alt: alt, strictness: strictness })

		//}
		//else {
		//	let strictness
		//	if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
		//	//if (!tmp[i + 2]) return console.log('ref allele missing')
		//	//if (!tmp[i + 3]) return console.log('alt allele missing')
		//	if (!tmp[4]) {
		//		strictness = 1 // Default strictness
		//	} else if (!Number.isFinite(Number(tmp[4]))) {
		//		return 'Strictness must be a positive number'
		//	} else if (Number(tmp[4]) > 2) return 'Invalid strictness'
		//	// For now, there are only three levels of strictness. More may be added in the future
		//	else {
		//		strictness = Number(tmp[i + 4])
		//	}
		//
		//}
	} else if (u2p.has('sv')) {
		// tmp.length >= 6
		// SVs
		const tmp = u2p.get('sv').split('.')
		tk.sv = []
		if (tmp.length == 7) {
			tk.sv.push({
				chrA: tmp[0],
				startA: tmp[1],
				strandA: tmp[2],
				chrB: tmp[3],
				startB: tmp[4],
				strandB: tmp[5],
				contig: tmp[6]
			})
		} else if (tmp.length == 6) {
			tk.sv.push({
				chrA: tmp[0],
				startA: tmp[1],
				strandA: tmp[2],
				chrB: tmp[3],
				startB: tmp[4],
				strandB: tmp[5]
			})
		}
	}
}

function makeGroup(gd, tk, block, data) {
	// make a group object using returned data for this group, and show tk image
	const group = {
		data: gd,
		dom: {
			groupg: tk.glider.append('g'),
			rightg: tk.gright.append('g'),
			leftg: tk.gleft.append('g')
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
		group.dom.read_names_g = group.dom.leftg.append('g') // For storing read names
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

		//const axis = axisTop()
		//	.tickValues([tk.min_diff_score, tk.max_diff_score])
		//	.scale(scaleLinear().domain([tk.min_diff_score, tk.max_diff_score]).range([0, gd.diff_scores_img.width]))
		//axisstyle({
		//	axis: tk.dom.diff_score_axis
		//		.transition()
		//		.attr('transform', 'translate(' + 0 + ',' + diff_score_height + ')')
		//		.call(axis),
		//	color: 'black',
		//	showline: true,
		//})
	}

	group.dom.img_fullstack = group.dom.imgg
		.append('image')
		.attr('xlink:href', group.data.src)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
	group.dom.img_partstack = group.dom.imgg.append('image').attr('width', 0).attr('height', 0)

	// put flyers behind cover
	group.dom.box_move = group.dom.imgg.append('rect').attr('stroke', 'black').attr('fill', 'none')
	group.dom.box_stay = group.dom.imgg.append('rect').attr('stroke', 'magenta').attr('fill', 'none')

	let mousedownx // not to trigger clicking after press and drag on a read
	const left_margin = tk.regions[0].x
	const right_margin = tk.regions[tk.regions.length - 1].x + tk.regions[tk.regions.length - 1].width
	group.dom.img_cover = group.dom.imgg
		.append('rect')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
		.on('mousedown', event => {
			mousedownx = event.clientX
		})
		.on('mousemove', event => {
			if (group.data.allowpartstack) {
				// TODO expand dom.box_move with full width and height to cover minimum expandable reads
				return
			}
			if (!group.data.templatebox) return
			const [mx, my] = pointer(event, group.dom.img_cover.node())
			let read_number = 0
			for (const t of group.data.templatebox) {
				read_number += 1
				const bx1 = Math.max(t.x1, left_margin)
				const bx2 = Math.min(t.x2, right_margin)
				//const bx1 = Math.max(tk.regions[region_idx].x, t.x1)
				//const bx2 = Math.min(tk.regions[region_idx].x + tk.regions[region_idx].width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					group.dom.box_move
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
					if (tk.readAlignmentTable && tk.readAlignmentTableGroup == group.data.type) {
						// Checking to see if the group being hovered over is the same as that whose reads have been realigned
						updateExistingMultiReadAligInfo(tk, read_number)
					} else if (tk.readAlignmentTable && tk.readAlignmentTableGroup != group.data.type) {
						// Checking to see if the group being hovered over is the same as that whose reads have been realigned. In this case it is not, so removing the yellow highlighting and bolding of text from the read that was previously being highlighted.
						// NOTE: This logic does not work if adjoining group has lot of reads and requires partstack mode to view it. In that case the hover function does not work.
						updateExistingMultiReadAligInfo(tk, group.data.templatebox.length + 10) // Adding an arbitary number so that read_number never matches and all reads turn white
					}
					return
				}
			}
		})
		.on('click', event => {
			if (mousedownx != event.clientX) return
			const [mx, my] = pointer(event, group.dom.img_cover.node())
			group.my_partstack = my // Stores y-position of the mouse click in group
			if (group.data.allowpartstack) {
				enter_partstack(group, tk, block, my, data)
				return
			}
			if (!group.data.templatebox) return

			// prepare to show read detail. find the read at click position
			// read panel is always wide (reads are long). show at a fix pos on left
			tk.readMenu.clear().show(50, event.clientY)
			let readNotShown = true

			for (let region_idx = 0; region_idx < tk.regions.length; region_idx += 1) {
				for (const t of group.data.templatebox) {
					const cx1 = Math.max(t.x1, left_margin)
					const cx2 = Math.min(t.x2, right_margin)
					const bx1 = Math.max(tk.regions[region_idx].x, t.x1)
					const bx2 = Math.min(tk.regions[region_idx].x + tk.regions[region_idx].width, t.x2)
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
								break
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
							.attr('width', cx2 - cx1)
							.attr('height', t.y2 - t.y1)
							.attr('transform', 'translate(' + cx1 + ',' + t.y1 + ')')
						getReadInfo(tk, block, t, region_idx)
						readNotShown = false
					}
					// must not return here because ...
				}
			}
			if (readNotShown) tk.readMenu.hide() // possible if clicked on white space of img where there's no read
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
			if (group.my_partstack) {
				delete group.my_partstack // y-position of click that invoked partstack originally
			}
			group.ReadNameMaxwidth = 0
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
		.on('mousedown', event => {
			event.preventDefault()
			group.dom.rightg.vslider.box.attr('fill', slider_color_dark)
			const scrollableheight = group.data.height
			const y0 = event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', event => {
				const y1 = event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.rightg.vslider.boxy + d <= 0) return
				} else {
					if (group.dom.rightg.vslider.boxy + d >= scrollableheight - group.dom.rightg.vslider.boxh) return
				}
				deltay = d
				if (tk.variants) {
					group.dom.diff_score_barplot_partstack.attr(
						'transform',
						'translate(0,' +
							((-1 * deltay * group.data_fullstack.stackcount * group.data.stackheight) / scrollableheight +
								group.msgheight) +
							')'
					)

					group.dom.read_names_g.attr(
						'transform',
						'translate(0,' +
							(-1 * deltay * group.data_fullstack.stackcount * group.data.stackheight) / scrollableheight +
							')'
					)
				}
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
				const _d = await getData(tk, block, {
					stackstart: group.partstack.start,
					stackstop: group.partstack.stop,
					grouptype: group.data.type
				})
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
		.on('mousedown', event => {
			event.preventDefault()
			const scrollableheight = group.data.height
			const y0 = event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', event => {
				const y1 = event.clientY
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
				const _d = await getData(tk, block, {
					stackstart: group.partstack.start,
					stackstop: group.partstack.stop,
					grouptype: group.data.type
				})
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
		.on('mousedown', event => {
			event.preventDefault()
			const scrollableheight = group.data.height
			const y0 = event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', event => {
				const y1 = event.clientY
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
				const _d = await getData(tk, block, {
					stackstart: group.partstack.start,
					stackstop: group.partstack.stop,
					grouptype: group.data.type
				})
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
	const body = {
		alignOneGroup: group.data.type,
		genome: block.genome.name,
		regions: tk.regions,
		variant: tk.variants.map(m => m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt).join('.')
	}
	if (tk.file) body.file = tk.file
	if (tk.url) body.url = tk.url
	if (tk.indexURL) body.indexURL = tk.indexURL
	if (tk.gdcFile) {
		body.gdcFileUUID = tk.gdcFile.uuid
		body.gdcFilePosition = tk.gdcFile.position
	}
	if (tk.alleleAlreadyUpdated) {
		// This should always be true when this function is invoked, but adding this if condition for safety sake
		body.alleleAlreadyUpdated = 1
		body.refseqs = tk.variants.refseqs
		body.altseqs = tk.variants.altseqs
		body.refalleles = tk.variants.refalleles
		body.altalleles = tk.variants.altalleles
		body.leftflankseqs = tk.variants.leftflankseqs
		body.rightflankseqs = tk.variants.rightflankseqs
		body.ref_positions = tk.variants.ref_positions
		body.strictness = tk.strictness
	}
	if (tk.asPaired) body.asPaired = 1
	if ('nochr' in tk) body.nochr = tk.nochr
	if (tk.drop_pcrduplicates) body.drop_pcrduplicates = 1
	if (tk.drop_supplementary_alignments) body.drop_supplementary_alignments = 1
	if (group.partstack) {
		body.stackstart = group.partstack.start
		body.stackstop = group.partstack.stop
		body.grouptype = group.data.type
	}
	return await dofetch3('tkbam', { headers: getHeaders(tk), body })
}

function getHeaders(tk) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (tk.gdcToken) headers['X-Auth-Token'] = tk.gdcToken
	return headers
}

function configPanel(tk, block) {
	{
		// panel is very wide so shift it to left
		const b = tk.config_handle.node().getBoundingClientRect()
		tk.tkconfigtip.clear().show(b.x - 300, b.y)
	}
	const d = tk.tkconfigtip.d.append('div').style('max-width', '50vw')

	{
		const row = d.append('div')
		row.append('span').html('Show reads as:&nbsp;').style('opacity', 0.5).style('margin', '10px 5px')
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
			}
		})
	}
	{
		make_one_checkbox({
			holder: d.append('div'),
			labeltext: 'Drop PCR or optical duplicates',
			checked: tk.drop_pcrduplicates,
			divstyle: { display: 'block', margin: '10px 5px', height: '10px', 'margin-left': '6.5px' },
			callback: () => {
				tk.drop_pcrduplicates = !tk.drop_pcrduplicates
				loadTk(tk, block)
			}
		})
	}
	// Can uncomment this later after testing with a suitable example

	//{
	//	make_one_checkbox({
	//		holder: d.append('div'),
	//		labeltext: 'Drop supplementary alignments',
	//		checked: tk.drop_supplementary_alignments,
	//		divstyle: { display: 'block', margin: '10px 5px', height: '10px', 'margin-left': '6.5px' },
	//		callback: () => {
	//			tk.drop_supplementary_alignments = !tk.drop_supplementary_alignments
	//			loadTk(tk, block)
	//		}
	//	})
	//}
	if (tk.variants) {
		make_one_checkbox({
			holder: d.append('div'),
			labeltext: 'Show read names',
			checked: tk.show_readnames,
			divstyle: { display: 'block', margin: '10px 5px', height: '10px', 'margin-left': '6.5px' },
			callback: () => {
				tk.show_readnames = !tk.show_readnames
				loadTk(tk, block)
			}
		})

		if (tk.variants[0].strictness == 0) {
			// When stricness = 0, tk.variants[0].strictness is false. So need to handle this case separately
		} else if (!tk.variants[0].strictness) {
			// When using example.bam.indel.html the strictness value is not defined. In such cases using a default value of strictness = 1.
			tk.variants[0].strictness = 1
		}
		const row = d.append('div')
		row
			.append('span')
			.html('Strictness: ')
			.style('display', 'block')
			.style('height', '10px')
			.style('opacity', 0.5)
			.style('margin', '10px 5px')
			.style('margin-top', '20px')
		make_radios({
			holder: row,
			options: [
				{
					label: 'Lenient: "None group" is not generated.',
					value: 0,
					checked: tk.strictness == 0
				},
				{
					label:
						'Strict: "None group" is generated for reads with imperfect match to both reference and alternative alleles.',
					value: 1,
					checked: tk.strictness == 1
				}
			],
			styles: { display: 'block', margin: '10px 5px', height: '10px', 'margin-left': '30px' },
			callback: v => {
				tk.strictness = v
				loadTk(tk, block)
			}
		})
	}

	d
		.append('div')
		.style('display', 'inline-block')
		.style('height', '10px')
		.style('margin-top', '20px')
		.style('font-size', '.8em').html(`
	<ul style="padding-left:15px">
	  <li><b>Matches</b> are rendered as gray boxes aligned to the reference.</li>
	  <li><b>Mismatches</b> will be checked when 1 bp is wider than 1 pixel, and are rendered as red boxes aligned to the reference.</li>
	  <li><b>Softclips</b> are rendered as blue boxes not aligned to the reference.</li>
	  <li><b>Base qualities</b> are rendered when 1 bp is wider than 2 pixels. See color scale below. When base quality is not used or is unavailable, full colors are used.</li>
	  <li><b>Sequences</b> from mismatch and softclip will be printed when 1 bp is wider than 7 pixels.</li>
	  <li>An <b>insertion</b> with on-screen size wider than 1 pixel will be rendered as cyan text between aligned bases, in either a letter or the number of inserted bp. Text color scales by average base quality when that is in use.</li>
	  <li><b>Deletions</b> are gaps joined by black horizontal lines.</li>
	  <li><b>Split reads</b> and splice junctions are indicated by solid gray lines.</li>
	  <li><b>Read pairs</b> are joined by dashed gray lines.</li>
          <li><b>Discordant reads</b> Discordant reads are colored based on their respective features as described below:<ul style="list-style-type:none;"> <li> <svg width="10" height="10" style = "display:inline-block;"> <rect width="10" height="10" style="fill:#3B7A57;" /> </svg> Read pair has wrong insert size </li> <li> <svg width="10" height="10" style = "display:inline-block;"> <rect width="10" height="10" style="fill:#6B4423;" /> </svg> Mate is unmapped </li> <li> <svg width="10" height="10" style = "display:inline-block;"> <rect width="10" height="10" style="fill:#fc6df3;" /> </svg> Wrong orientation </li> <li> <svg width="10" height="10" style = "display:inline-block;"> <rect width="10" height="10" style="fill:#d48b37;" /> </svg> Mate mapped to different chromosome </li> </ul>
          </li>  
	</ul>`)
	d.append('div')
		.style('margin-top', '10px')
		.append('img')
		.attr('width', tk.colorscale.width)
		.attr('height', tk.colorscale.height)
		.attr('src', tk.colorscale.src)
	d.append('div').style('font-size', '.8em').html(`
`)
}

/*
get info for a read/template
if is single mode, will be single read and with first/last info
if is pair mode, is the template
box{}
  qname, start, stop
*/

function click_groupheader(tk, group, block) {
	if (tk.variants) {
		click_groupheader_showMultiReadAlign(tk, group, block)
	}
}

function updateExistingMultiReadAligInfo(tk, read_number) {
	const rows = tk.readAlignmentTable._groups[0][0].querySelectorAll('tr')
	rows.forEach(row => {
		if (row.rowIndex == read_number + 1 && !tk.is_align_gene) {
			// 1 is added because the top in the HTML table consists of the variant box. So read index in the actual bam track is equal to read_number + 1 in the realignment panel
			row.style.setProperty('font-weight', 'bold')
			const cols = row.querySelectorAll('td')
			cols.forEach(col => {
				if (col.style.backgroundColor.toString() == 'rgb(255, 255, 255)') {
					col.style.setProperty('background-color', 'yellow')
				}
			})
		} else if (row.rowIndex == read_number + 2 && tk.is_align_gene) {
			// 2 is added because the top in the HTML table consists of the variant box. In addition, when gene models are displayed after the reference/alternate sequence, the read index in the actual bam track is equal to read_number + 2 in the realignment panel
			row.style.setProperty('font-weight', 'bold')
			const cols = row.querySelectorAll('td')
			cols.forEach(col => {
				if (col.style.backgroundColor.toString() == 'rgb(255, 255, 255)') {
					col.style.setProperty('background-color', 'yellow')
				}
			})
		} else {
			// When read_number does not match rowIndex then the background color for each cells in the row is turned to white
			row.style.setProperty('font-weight', 'normal')
			const cols = row.querySelectorAll('td')
			cols.forEach(col => {
				if (col.style.backgroundColor.toString() == 'yellow') {
					col.style.setProperty('background-color', 'rgb(255, 255, 255)')
				}
			})
		}
	})
}

async function create_gene_models_refalt(tk, block, multi_read_alig_data, group, alt_var_idx) {
	// Function to display gene models in the multi read alignment info panel
	// This function parses through the alternate/reference sequence and looks for gaps. At each of these gaps it ends existing gene model, renders it puts a gap and then starts the next gene model. At the end of the sequence, it finishes current model and renders it

	const gene_model_images = [] // This array stores the gene model images, width and height of the gene model
	const break_points = [] // This array stores the length of break points in case of breaks outside variant region ("-") or the variant (if its an insertion)
	const gene_model_order = [] // This array stores the order of gene models and breaks as needed from the left
	// Determine breaks in reference/alternate sequence (if gene model button is clicked)
	let refalt_seq = multi_read_alig_data.alignmentData.final_read_align[0]
	let left_most_pos = tk.variants[0].pos - tk.variants.leftflankseqs[0].length
	let right_most_pos = tk.variants[0].pos + tk.variants.rightflankseqs[0].length

	if (group.data.type == 'support_alt' + alt_var_idx.toString()) {
		left_most_pos = tk.variants[alt_var_idx].pos - tk.variants.leftflankseqs[alt_var_idx].length
		right_most_pos = tk.variants[alt_var_idx].pos + tk.variants.rightflankseqs[alt_var_idx].length
	}

	let segstart = left_most_pos // This variable stores the left most position of a segment (spliced unit) of reference/alternate sequence, the first segment is initialized to the left most position of the reference/alternate sequence
	let segstop = left_most_pos // This variable stores the right most position of a segment (spliced unit) of reference/alternate sequence
	let local_alignment_width = 0 // This variable stores the width of each gene model that needs to be rendered using bedj track
	let first_row = tk.readAlignmentTable.node().children[0]
	let gm_nuc_count = 0
	let prev_nclt_not_blank = false // Flag to store if previous nucleotide is "-"
	let nclt_count = 0
	for (const nclt of refalt_seq) {
		if (nclt == '-') {
			// Checks for breaks in ref/alt sequence other than variant of interest
			if (prev_nclt_not_blank == true) {
				// Flag to check if previous nucleotide is "-", if yes no gene model is rendered
				break_points.push(1)
				gene_model_order.push('break')
				segstart += 1
				segstop += 1
			} else {
				// Break in reference/alternate sequence caused by a read(s), will invoke a bedj request here

				const gene_model_image = await get_gene_models_refalt(block, tk, segstart, segstop - 1, local_alignment_width) // Send bedj server side request to render gene model for this segment
				const gm = {
					src: gene_model_image.src,
					width: local_alignment_width,
					height: gene_model_image.height,
					colspan: gm_nuc_count
				}
				gene_model_images.push(gm)
				gene_model_order.push('gene_model')
				gm_nuc_count = 0
				segstart = left_most_pos + nclt_count + 1
				segstop = left_most_pos + nclt_count + 1
				local_alignment_width = 0
				prev_nclt_not_blank = true
				break_points.push(1)
				gene_model_order.push('break')
			}
			gm_nuc_count += 1
			local_alignment_width += first_row.children[nclt_count].getBoundingClientRect().width
		} else if (
			group.data.type == 'support_alt' + alt_var_idx.toString() &&
			tk.variants[alt_var_idx].alt.length > tk.variants[alt_var_idx].ref.length && // Insertion case
			tk.variants[alt_var_idx].pos < left_most_pos + nclt_count &&
			tk.variants[alt_var_idx].pos + tk.variants[alt_var_idx].alt.length - 1 >= left_most_pos + nclt_count // Subtracting 1 here because by convention the first nucleotide in alternate allele is the last nucleotide in reference sequence after which the indel starts
		) {
			// Ignores inserted nucleotides (if an insertion) as no gene model can be rendered for it
		} else if (
			tk.variants[0].pos == left_most_pos + nclt_count &&
			group.data.type == 'support_alt' + alt_var_idx.toString()
		) {
			// Variant causes break in gene model but only if the alternate allele is being displayed
			if (tk.variants[alt_var_idx].ref.length == 1 && tk.variants[alt_var_idx].alt.length == 1) {
				// In case of SNP no break in gene model is necessary
				continue
			}

			if (tk.variants[alt_var_idx].ref.length >= tk.variants[alt_var_idx].alt.length) {
				segstop += 1
				gm_nuc_count += 1
				local_alignment_width += first_row.children[nclt_count + 1].getBoundingClientRect().width
			}
			const gene_model_image = await get_gene_models_refalt(block, tk, segstart, segstop, local_alignment_width) // Send bedj client request to render gene model for this segment
			const gm = {
				src: gene_model_image.src,
				width: local_alignment_width,
				height: gene_model_image.height,
				colspan: gm_nuc_count
			}
			gene_model_images.push(gm)
			gene_model_order.push('gene_model')
			gm_nuc_count = 0
			segstart = left_most_pos + nclt_count + tk.variants[alt_var_idx].ref.length
			segstop = left_most_pos + nclt_count + tk.variants[alt_var_idx].ref.length
			if (tk.variants[alt_var_idx].ref.length < tk.variants[alt_var_idx].alt.length) {
				// Break point in variant region only in case of an insertion
				break_points.push(tk.variants[0].alt.length)
				gene_model_order.push('break')
			}
			local_alignment_width = 0
			prev_nclt_not_blank = false
		} else if (nclt_count == refalt_seq.length - 1) {
			// When last nucleotide of reference/alternate sequence is parsed, rendering of gene model is invoked
			segstop += 1
			gm_nuc_count += 1
			local_alignment_width += first_row.children[nclt_count].getBoundingClientRect().width
			//console.log('nclt_count3:', nclt_count)
			//console.log('segstart3:', segstart)
			//console.log('segstop3:', segstop)
			//console.log('gm_nuc_count3:', gm_nuc_count)
			//console.log('local_alignment_width3:', local_alignment_width)
			const gene_model_image = await get_gene_models_refalt(block, tk, segstart, segstop, local_alignment_width) // Send bedj client request to render gene model for this segment
			const gm = {
				src: gene_model_image.src,
				width: local_alignment_width,
				height: gene_model_image.height,
				colspan: gm_nuc_count
			}
			gene_model_images.push(gm)
			gene_model_order.push('gene_model')
		} else {
			// For all other positions the stop position, number of nucleotides and width of gene model will be incremented
			segstop += 1
			gm_nuc_count += 1
			local_alignment_width += first_row.children[nclt_count].getBoundingClientRect().width
			//console.log('nclt:', nclt)
			//console.log('segstop:', segstop)
			//console.log('gm_nuc_count:', gm_nuc_count)
			//console.log('local_alignment_width:', local_alignment_width)
			//console.log('nclt_count:', nclt_count)
			prev_nclt_not_blank = false
		}
		nclt_count += 1
	}

	// Drawing gene models after ref/alt sequence when gene_models button is clicked
	let j = 0
	let k = 0
	const gene_model_tr = tk.readAlignmentTable.node().insertRow()
	// Check if there are reads aligned to reference/alternate sequence
	if (tk.readAlignmentTable.node().children.length >= 3) {
		// Ensure that there is atleast one read in the alignment before trying to place the gene model before it (not tested, maybe should not happen at all)
		const first_read = tk.readAlignmentTable.node().children[2]
		tk.readAlignmentTable.node().insertBefore(gene_model_tr, first_read)
	} else {
		console.log('Possible problem in placing gene model in table. Please check')
	}
	for (let i = 0; i < gene_model_order.length; i++) {
		const gene_models_cell = gene_model_tr.insertCell()
		if (gene_model_order[i] == 'gene_model') {
			// If a gene model, display gene model
			// Render gene model
			const img = document.createElement('img')
			img.src = gene_model_images[k].src
			img.width = gene_model_images[k].width
			img.height = gene_model_images[k].height
			gene_models_cell.appendChild(img)
			gene_models_cell.colSpan = gene_model_images[k].colspan
			k += 1
		} else if (gene_model_order[i] == 'break') {
			// Keep it blank, if a break needs to be shown
			// Gap representing '-' or variant (insertion)
			gene_models_cell.colSpan = break_points[j]
			j += 1
		}
	}
}

// show multi-read alignment panel
async function click_groupheader_showMultiReadAlign(tk, group, block) {
	tk.multiAlignMenu.clear().show(50, 100) // assuming the panel size will be big, show at fixed location on viewport top
	const wait = tk.multiAlignMenu.d.append('div').text('Loading...')

	try {
		const data = await align_reads_to_allele(tk, group, block) // Sending server side bam request for aligning reads to ref/alt
		if (data.error) {
			wait.remove()
			sayerror(tk.multiAlignMenu.d, 'Realignment of reads in ambiguous group is not currently implemented.')
			setTimeout(() => tk.multiAlignMenu.d.remove(), 3000)
			return
		}

		wait.remove()
		let alt_var_idx = 0 // Contains the index of the alternate allele (if queried) of the selected alternate allele
		// If one of the alternate alles are clicked, determine which alternate allele
		let ref_start_stops = []
		let highlight_regions_in_refallele = [] // There should always be even number of items in this list as it contains start & stop positions for various regions that need to be highlighted in the reference sequence
		if (group.data.type.includes('support_alt')) {
			for (let var_idx = 0; var_idx < tk.variants.length; var_idx++) {
				if (group.data.type == 'support_alt' + var_idx.toString()) {
					alt_var_idx = var_idx
				}
			}
		} else if (group.data.type == 'support_ref') {
			for (let var_idx = 0; var_idx < tk.variants.length; var_idx++) {
				ref_start_stops.push({
					start: tk.variants[var_idx].pos,
					stop: tk.variants[var_idx].pos + tk.variants[var_idx].ref.length
				})
			}
			ref_start_stops.sort((i, j) => i.start - j.start)
			// See if any of the ref alleles overlap

			let old_variant = { start: ref_start_stops[0].start, stop: ref_start_stops[0].stop }
			highlight_regions_in_refallele.push(ref_start_stops[0].start)
			let break_point = false
			for (let var_idx = 1; var_idx < ref_start_stops.length; var_idx++) {
				if (ref_start_stops[var_idx].start <= old_variant.stop && old_variant.stop <= ref_start_stops[var_idx].stop) {
					old_variant = ref_start_stops[var_idx]
				} else if (old_variant.stop > ref_start_stops[var_idx].stop) {
					continue
				} else {
					highlight_regions_in_refallele.push(old_variant.stop)
					highlight_regions_in_refallele.push(ref_start_stops[var_idx].start)
				}
			}
			highlight_regions_in_refallele.push(Math.max(old_variant.stop, ref_start_stops[ref_start_stops.length - 1].stop))
		}

		if (
			data.alignmentData.final_read_align.length > 0 &&
			(group.data.type.includes('support_alt') || group.data.type == 'support_ref')
		) {
			// Gene models are displayed only if there is a reference/alternate sequence being displayed
			const gene_button = tk.multiAlignMenu.d
				.append('button')
				.style('margin-left', '10px')
				.text('Show gene model')
				.on('click', async () => {
					tk.is_align_gene = true // This flag is set to true so that when the read is hovered, the same read is highlighted in the realignment panel
					gene_button.property('disabled', true) // disable this button
					await create_gene_models_refalt(tk, block, data, group, alt_var_idx)
				})
		}
		create_multi_alignment_table(tk, data, group, alt_var_idx, highlight_regions_in_refallele)
	} catch (e) {
		wait.remove()
		sayerror(tk.multiAlignMenu.d, e)
	}
}

function create_multi_alignment_table(tk, multi_read_alig_data, group, alt_var_idx, highlight_regions_in_refallele) {
	let num_read_div
	if (!multi_read_alig_data.alignmentData.read_count) {
		// This condition is true when there are no reads mapped against reference/alternate sequence. This happens when user pans too far away from the variant region
		multi_read_alig_data.alignmentData.read_count = 0
	}

	if (group.data.type == 'support_ref') {
		num_read_div = tk.multiAlignMenu.d // Printing number of reads aligned in alignment panel
			.append('div')
			.text('Number of reads aligned to reference allele = ' + multi_read_alig_data.alignmentData.read_count)
			.style('text-align', 'center')
	} else if (group.data.type == 'support_no' || group.data.type == 'support_amb') {
		num_read_div = tk.multiAlignMenu.d // Printing number of reads aligned in alignment panel
			.append('div')
			.text('Number of reads aligned = ' + multi_read_alig_data.alignmentData.read_count)
			.style('text-align', 'center')
	} else if (group.data.type.includes('support_alt')) {
		// Some alternate allele
		let hit = 0
		for (let var_idx = 0; var_idx < tk.variants.length; var_idx++) {
			if (group.data.type == 'support_alt' + var_idx.toString()) {
				hit = 1
				alt_var_idx = var_idx
				num_read_div = tk.multiAlignMenu.d // Printing number of reads aligned in alignment panel
					.append('div')
					.text(
						'Number of reads aligned to alternative allele ' +
							tk.variants[var_idx].alt +
							' = ' +
							multi_read_alig_data.alignmentData.read_count
					)
					.style('text-align', 'center')
			}
		}
		if (hit == 0) {
			// Should not happen
			console.log('group.data.type:', group.data.type)
			console.log('Alternate allele not found')
		}
	}
	if (multi_read_alig_data.alignmentData.partstack_start) {
		// In partstack mode
		const partstack_div = tk.multiAlignMenu.d
			.append('div')
			.text(
				'Reads aligned from ' +
					multi_read_alig_data.alignmentData.partstack_start +
					' to ' +
					multi_read_alig_data.alignmentData.partstack_stop
			)
			.style('text-align', 'center')
	}

	const div = tk.multiAlignMenu.d.append('div').style('margin', '20px')
	tk.readAlignmentTable = div
		.append('table')
		.style('font-family', 'Courier')
		.style('font-size', '0.8em')
		.style('color', '#303030')
		.style('margin', '5px 5px 20px 5px')
		.style('border-spacing', 0)
		.style('border-collapse', 'separate')
		.style('text-align', 'center')
		.style('empty-cells', 'show')

	// Drawing ref/alt allele bar
	let refallele_tr = tk.readAlignmentTable.append('tr').style('color', 'white').style('background-color', 'white')
	refallele_tr.attr('id', 'RefAltBar')
	let variant_string // This will contain the variant bar along with Refeerence/ Alternate allele label
	let nclt_count = 0
	let allele_start = 0 // Flag to tell if the variant region has been reached or not. After that position alternate/reference allele will be rendered
	let variant_string_count = 0 // Iterator for variant string letters

	// Determine if alt/ref allele string needs to be placed inside variant box
	let inside_variant_box = 1 // Flag for determining if variant string needs to be placed inside variant box or to the right of it. 0 for inside and 1 for being placed on the right
	if (group.data.type == 'support_alt' + alt_var_idx.toString()) {
		if (tk.variants.length == 1) {
			// If only a single allele is specified then which alternate allele being referred is obvious
			variant_string = 'Alternative allele'
			if (variant_string.length < tk.variants[alt_var_idx].alt.length) {
				inside_variant_box = 0
			} else {
				variant_string = ' Alternative allele'
			}
		} else {
			if (group.data.type == 'support_alt' + alt_var_idx.toString()) {
				variant_string = 'Alternative allele = ' + tk.variants[alt_var_idx].alt
				if (variant_string.length < tk.variants[alt_var_idx].alt.length) {
					inside_variant_box = 0
				} else {
					variant_string = ' Alternative allele = ' + tk.variants[alt_var_idx].alt
				}
			}
		}
	} else if (group.data.type == 'support_ref') {
		// For reference allele the reference allele from first allele will be shown (May need to work later on this based on input from user)
		if (tk.is_same_ref == false) {
			variant_string = 'Combined reference allele'
		} else {
			variant_string = 'Reference allele'
		}
		if (variant_string.length < highlight_regions_in_refallele[1] - highlight_regions_in_refallele[0]) {
			// For now checking if string fits within the first box (in case of a multi-allele variant)
			inside_variant_box = 0
		} else {
			if (tk.is_same_ref == false) {
				variant_string = ' Combined reference allele'
			} else {
				variant_string = ' Reference allele'
			}
		}
	}

	tk.readAlignmentTableGroup = group.data.type
	if (multi_read_alig_data.alignmentData.final_read_align.length > 0) {
		for (const nclt of multi_read_alig_data.alignmentData.final_read_align[0]) {
			nclt_count += 1
			const refallele_td = refallele_tr.append('td')

			// Drawing ref/alt allele bar
			if (
				group.data.type == 'support_alt' + alt_var_idx.toString() &&
				nclt_count >
					tk.variants.leftflankseqs[alt_var_idx].length + multi_read_alig_data.alignmentData.gaps_before_variant &&
				nclt_count <=
					tk.variants.leftflankseqs[alt_var_idx].length +
						tk.variants[alt_var_idx].alt.length +
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
				nclt_count > tk.variants.leftflankseqs[0].length + multi_read_alig_data.alignmentData.gaps_before_variant &&
				nclt_count <=
					tk.variants.leftflankseqs[0].length +
						highlight_regions_in_refallele[1] - // For now assuming there are no breaks within ref alleles on the reference sequence.
						highlight_regions_in_refallele[0] +
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
			let nclt_count = 0
			const read_tr = tk.readAlignmentTable.append('tr').style('color', 'white').style('background-color', 'white')
			// Setting attribute of row
			if (read_count == 0 && (group.data.type == 'support_ref' || group.data.type == 'support_alt')) {
				read_tr.attr('id', 'RefAltSeq')
			} else {
				read_tr.attr('id', read_count.toString())
			}
			const r_colors = multi_read_alig_data.alignmentData.qual_r[read_count].split(',')
			const g_colors = multi_read_alig_data.alignmentData.qual_g[read_count].split(',')
			const b_colors = multi_read_alig_data.alignmentData.qual_b[read_count].split(',')
			for (const nclt of read) {
				nclt_count += 1
				let nclt_td
				if (read_count == 0 && (group.data.type == 'support_ref' || group.data.type.includes('support_alt'))) {
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
					group.data.type == 'support_alt' + alt_var_idx.toString() &&
					nclt_count >
						tk.variants.leftflankseqs[alt_var_idx].length + multi_read_alig_data.alignmentData.gaps_before_variant &&
					nclt_count <=
						tk.variants.leftflankseqs[alt_var_idx].length +
							tk.variants[alt_var_idx].alt.length +
							multi_read_alig_data.alignmentData.gaps_before_variant
				) {
					nclt_td.style('color', 'black')
				} else if (
					group.data.type == 'support_ref' &&
					nclt_count > tk.variants.leftflankseqs[0].length + multi_read_alig_data.alignmentData.gaps_before_variant &&
					nclt_count <=
						tk.variants.leftflankseqs[0].length +
							highlight_regions_in_refallele[1] - // For now assuming there are no breaks within ref alleles on the reference sequence.
							highlight_regions_in_refallele[0] +
							multi_read_alig_data.alignmentData.gaps_before_variant
				) {
					nclt_td.style('color', 'black')
				}
			}
			read_count += 1
		}
	}
}

async function getReadInfo(tk, block, box, ridx) {
	const wait = tk.readMenu.d.append('div').text('Loading...')
	const param = getparam(
		tk.variants
			? {
					refseqs: tk.variants.refseqs,
					altseqs: tk.variants.altseqs,
					chrom: tk.variants[0].chr,
					ref_positions: tk.variants.ref_positions,
					refalleles: tk.variants.refalleles,
					altalleles: tk.variants.altalleles,
					start: box.start,
					stop: box.stop,
					paired: tk.asPaired
			  }
			: { start: box.start, stop: box.stop, paired: tk.asPaired }
	)
	const data = await dofetch3('tkbam', param)
	if (data.error) {
		sayerror(wait, data.error)
		return
	}
	wait.remove()

	for (const r of data.lst) {
		// {seq, alignment (html), info (html) }
		const div = tk.readMenu.d.append('div').style('margin', '10px')
		const read_reference_div = div.append('div').html(r.alignment) // This stores the HTML table displaying the read against the reference

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
			.on('click', function () {
				navigator.clipboard.writeText(r.seq).then(() => {}, console.warn)
				d3select(this).html('Copy read sequence&nbsp;&check;')
			})

		if (data.lst[0].alignments) {
			// Invoked only if variant is specified
			d3select(this).append('span').html('&nbsp;')
			const alignment_button = row.append('button').style('margin-left', '10px').text('Align read to variant alleles')

			let first = true // use this flag to only make the table once when clicking the button for the first time
			alignment_button.on('click', () => {
				if (first) {
					first = false
					for (let var_idx = 0; var_idx < tk.variants.length; var_idx++) {
						makeReadAlignmentTable(variantAlignmentTable, 'Ref', tk, data.lst[0].start_readpos - 1, var_idx)
						makeReadAlignmentTable(variantAlignmentTable, 'Alt', tk, data.lst[0].start_readpos - 1, var_idx)
					}
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
					const wait = tk.readMenu.d.append('div').text('Loading...')
					const data2 = await dofetch3('tkbam', getparam({ show_unmapped: 1 }))
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
						.on('click', function () {
							navigator.clipboard.writeText(r2.seq).then(() => {}, console.warn)
							d3select(this).html('Copy read sequence&nbsp;&check;')
						})
					mayshow_blatbutton(r2, row, tk, block)
					div.append('div').html(r2.info)
				})
		}

		const gene_button = row
			.append('button')
			.style('margin-left', '10px')
			.text('Show gene model')
			.property('disabled', !r.seq || r.seq == '*')
			.on('click', async () => {
				gene_button.property('disabled', true) // disable this button
				// Determine how many calls to bedj track need to be made. This depends on whether the read has insertions/deletions or spliced. In these cases, each part of the read will need a separate bedj track
				// Parsing cigar sequence
				let i = 0
				let nuc_count = 0 // Nucleotide iterator
				let gm_nuc_count = 0 // Nucleotide iterator containing the number of nucleotides spanned by the gene model
				let segstart = data.lst[0].boxes[0].start
				let segstop
				let local_alignment_width = 0 // This variable stores the width of each gene model that needs to be rendered using bedj track
				const tbodyRef = read_reference_div.node().children[0].getElementsByTagName('tbody')[0]
				const gene_model_tr = tbodyRef.insertRow()
				const heading_gene_cell = gene_model_tr.insertCell()
				const heading_gene_text = document.createTextNode('')
				heading_gene_cell.appendChild(heading_gene_text)

				const gene_models = []
				const break_points = []
				let num_break_points = 0 // Number of break points in reference sequence w.r.t read
				let gene_model_td
				const refseq_row = read_reference_div.node().children[0].children[0].children[0]
				for (const item of data.lst[0].boxes) {
					if (item.opr == 'H') {
						// Hard clip should be towards an end of a segment and there should be no corresponding sequence, so no gene models need to be shown (Needs to be tested with an example)
						continue
					} else if (
						item.opr == 'M' ||
						item.opr == 'S' ||
						(item.opr == 'N' && item.len < data.lst[0].readpanel_DN_maxlength) ||
						(item.opr == 'D' && item.len < data.lst[0].readpanel_DN_maxlength) // if length of deletion is less than readpanel_DN_maxlength the reference sequence is retained and no break is observed, so this part will be covered by the gene model
					) {
						for (let j = 0; j < item.len; j++) {
							local_alignment_width += refseq_row.children[nuc_count + 1].getBoundingClientRect().width // Adding the number of pixels from this column to local_alignment_width
							nuc_count += 1
						}
						gm_nuc_count += item.len
					} else if (
						item.opr == 'I' ||
						(item.opr == 'N' && item.len >= data.lst[0].readpanel_DN_maxlength) ||
						(item.opr == 'D' && item.len >= data.lst[0].readpanel_DN_maxlength) // if length of deletion is greater or equal to readpanel_DN_maxlength the reference sequence is not retained and break is observed, therefore current gene model will end here and a new gene model will start at the end of the deletion
					) {
						segstop = item.start
						const gene_model = await get_gene_models_reads(block, ridx, segstart, segstop, local_alignment_width) // Send bedj client request to render gene model for this segment
						const gm = {
							src: gene_model.src,
							width: local_alignment_width,
							height: gene_model.height,
							colspan: gm_nuc_count
						}
						gene_models.push(gm)

						if (item.opr == 'I') {
							break_points.push(item.len) // Passing the length of insertion
						} else if (item.opr == 'N' || item.opr == 'D') {
							break_points.push(1) // In case of big deletions and splicing it only occupies a single cell
						}

						if (item.opr == 'D' || item.opr == 'N') {
							segstart = item.start + item.len
						} else if (item.opr == 'I') {
							segstart = item.start
						}

						local_alignment_width = 0
						gm_nuc_count = 0
						num_break_points += 1
					}

					if (i == data.lst[0].boxes.length - 1) {
						// Render bedj gene model if it has reached the last entry in CIGAR sequence
						segstop = item.start + item.len
						const gene_model = await get_gene_models_reads(block, ridx, segstart, segstop, local_alignment_width) // Send bedj client request to render gene model for this segment
						const gm = {
							src: gene_model.src,
							width: local_alignment_width,
							height: gene_model.height,
							colspan: gm_nuc_count
						}
						gene_models.push(gm)
					}
					i += 1
				}

				// Filling gene model row
				const num_gene_cells = num_break_points + gene_models.length // Number of gene cells required in gene row
				let j = 0
				let k = 0
				for (let i = 0; i < num_gene_cells; i++) {
					const gene_model_cell = gene_model_tr.insertCell()
					if (i % 2 == 0) {
						// Render gene model
						const img = document.createElement('img')
						img.src = gene_models[k].src
						img.width = gene_models[k].width
						img.height = gene_models[k].height
						gene_model_cell.appendChild(img)
						gene_model_cell.colSpan = gene_models[k].colspan
						k += 1
					} else {
						// Gap representing insertion / (big) deletion / (big) splicing showing break in reference sequence
						gene_model_cell.colSpan = break_points[j]
						j += 1
					}
				}
				//console.log('gene_model_tr:', gene_model_tr)
			})

		mayshow_blatbutton(r, row, tk, block)
		div.append('div').html(r.info)
		//empty div for read alignment tables
		const variantAlignmentTable = div.append('div').style('display', 'none')
	}

	function getparam(extra = {}) {
		// reusable helper
		const r = tk.regions[ridx]
		const body = {
			getread: 1,
			qname: encodeURIComponent(box.qname), // convert + to %2B, so it can be kept the same but not a space instead
			genome: block.genome.name,
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			...extra
		}
		if (tk.gdcFile) {
			body.gdcFileUUID = tk.gdcFile.uuid
			body.gdcFilePosition = tk.gdcFile.position
		}
		if (tk.nochr) body.nochr = 1
		if (tk.file) body.file = tk.file
		if (tk.url) body.url = tk.url
		if (tk.indexURL) body.indexURL = tk.indexURL
		if (tk.asPaired) {
			body.getpair = 1
		} else {
			if (box.isfirst) {
				body.getfirst = 1
			} else if (box.islast) {
				body.getlast = 1
			} else {
				// unknown order for this read
				// supply read position to identify it on server
				body.unknownorder = 1
				body.readstart = box.start
				body.readstop = box.stop
			}
		}
		return { headers: getHeaders(tk), body }
	}

	/*
	Creates read alignment table when 'Read alignment' button is clicked. 
	type
		'Ref' - reference
		'Alt' - alternate
	*/
	function makeReadAlignmentTable(div, type, tk, read_start_pos, var_idx) {
		let q_align, align_wrt, r_align
		if (type == 'Ref') {
			q_align = data.lst[0].alignments[var_idx].q_seq_ref
			align_wrt = data.lst[0].alignments[var_idx].align_ref
			r_align = data.lst[0].alignments[var_idx].r_seq_ref
		}
		if (type == 'Alt') {
			q_align = data.lst[0].alignments[var_idx].q_seq_alt
			align_wrt = data.lst[0].alignments[var_idx].align_alt
			r_align = data.lst[0].alignments[var_idx].r_seq_alt
		}
		if (data.lst[0].alignments.length == 1) {
			div
				.append('span')
				.text(type + ' alignment')
				.style('font-family', 'Courier')
				.style('font-size', '15px')
				.style('color', '#303030')
				.style('margin', '5px 5px 10px 5px')
		} else {
			if (type == 'Alt') {
				div
					.append('span')
					.text('Alignment with Alt allele: ' + tk.variants[var_idx].alt)
					.style('font-family', 'Courier')
					.style('font-size', '15px')
					.style('color', '#303030')
					.style('margin', '5px 5px 10px 5px')
			} else if (type == 'Ref') {
				div
					.append('span')
					.text('Alignment with Ref allele: ' + tk.variants[var_idx].ref)
					.style('font-family', 'Courier')
					.style('font-size', '15px')
					.style('color', '#303030')
					.style('margin', '5px 5px 10px 5px')
			} else {
				// Should not happen
				console.log('Unknown allele, please check')
			}
		}
		const table = div
			.append('table')
			.style('font-family', 'Courier')
			.style('font-size', '0.8em')
			.style('color', '#303030')
			.style('margin', '5px 5px 20px 5px')
		let nclt_count = 0
		const refAlt_tr = table.append('tr')
		refAlt_tr
			.append('td')
			.text(type + ' allele')
			.style('text-align', 'right')
			.style('font-weight', '550')
			.style('white-space', 'nowrap')
		for (const nclt of r_align) {
			nclt_count += 1
			if (
				type == 'Ref' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_ref &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_ref
			) {
				refAlt_tr.append('td').text(nclt).style('color', 'red')
			} else if (
				type == 'Alt' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_alt &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_alt
			) {
				refAlt_tr.append('td').text(nclt).style('color', 'red')
			} else {
				refAlt_tr.append('td').text(nclt)
			}
		}
		const alignment_tr = table.append('tr')
		alignment_tr.append('td')
		nclt_count = 0
		for (const align_str of align_wrt) {
			nclt_count += 1
			if (
				type == 'Ref' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_ref &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_ref
			) {
				alignment_tr.append('td').text(align_str).style('color', 'red')
			} else if (
				type == 'Alt' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_alt &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_alt
			) {
				alignment_tr.append('td').text(align_str).style('color', 'red')
			} else {
				alignment_tr.append('td').text(align_str)
			}
		}

		const query_tr = table.append('tr')
		query_tr.append('td').text('Read').style('text-align', 'right').style('font-weight', '550')
		nclt_count = 0
		for (const nclt of q_align) {
			nclt_count += 1
			if (
				type == 'Ref' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_ref &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_ref
			) {
				query_tr.append('td').text(nclt).style('color', 'red')
			} else if (
				type == 'Alt' &&
				nclt_count > data.lst[0].alignments[var_idx].red_region_start_alt &&
				nclt_count <= data.lst[0].alignments[var_idx].red_region_stop_alt
			) {
				query_tr.append('td').text(nclt).style('color', 'red')
			} else {
				query_tr.append('td').text(nclt)
			}
		}
	}
}

async function get_gene_models_refalt(block, tk, segstart, segstop, local_alignment_width) {
	const genetk = block.genome.tracks.find(i => i.__isgene)
	const args = {
		name: genetk.name,
		genome: block.genome.name,
		rglst: [
			{
				chr: tk.variants[0].chr,
				start: segstart,
				stop: segstop,
				width: local_alignment_width
			}
		],
		width: local_alignment_width,
		stackheight: 16,
		stackspace: 1,
		regionspace: 0,
		file: genetk.file,
		devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1,
		color: genetk.color,
		translatecoding: 1,
		__isgene: true,
		noNameHover: true
	}

	{
		// if the same gene tk is currently showing, apply its gene model filtering
		const tk = block.tklst.find(i => i.name == args.name && i.type == 'bedj')
		if (tk && tk.filterByName) {
			args.filterByName = tk.filterByName
		}
	}

	return await dofetch3('tkbedj', { method: 'POST', body: JSON.stringify(args) })
}

// FIXME may combine with get_gene_models_refalt?
async function get_gene_models_reads(block, ridx, segstart, segstop, local_alignment_width) {
	const genetk = block.genome.tracks.find(i => i.__isgene)
	const args = {
		name: genetk.name,
		genome: block.genome.name,
		rglst: [
			{
				chr: block.rglst[ridx].chr,
				start: segstart,
				stop: segstop,
				width: local_alignment_width
			}
		],
		width: local_alignment_width,
		stackheight: 16,
		stackspace: 1,
		regionspace: 0,
		file: genetk.file,
		devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1,
		color: genetk.color,
		translatecoding: 1,
		__isgene: true,
		noNameHover: true
	}
	{
		// if the same gene tk is currently showing, apply its gene model filtering
		const tk = block.tklst.find(i => i.name == args.name && i.type == 'bedj')
		if (tk && tk.filterByName) {
			args.filterByName = tk.filterByName
		}
	}
	return await dofetch3('tkbedj', { method: 'POST', body: JSON.stringify(args) })
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
				const data = await dofetch3('blat', {
					body: {
						genome: block.genome.name,
						seq: read.seq,
						soft_starts: read.soft_starts,
						soft_stops: read.soft_stops
					}
				})
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

function show_blatresult2(hits, div, tk, block) {
	const table = div.append('table')
	const tr = table.append('tr').style('opacity', 0.5).style('font-size', '.8em')
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
					td.append('span').text(' Query').style('font-family', 'courier').style('color', 'black')
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
					td.append('span').text(' Query').style('font-family', 'courier').style('color', 'black')
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
	const _d = await getData(tk, block, {
		stackstart: group.partstack.start,
		stackstop: group.partstack.stop,
		grouptype: group.data.type
	})
	group.data = _d.groups[0]
	renderGroup(group, tk, block)
	setTkHeight(tk)
	block.tkcloakoff(tk, {})
	block.block_setheight()
}

function show_blatresult(hits, div, tk, block) {
	const table = div.append('table')
	const tr = table.append('tr').style('opacity', 0.5).style('font-size', '.8em')
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
			group.ReadNameMaxwidth = 0
			if (tk.show_readnames) {
				group.dom.read_names_g.attr('transform', 'translate(0,0)')
				group.dom.read_names_g.selectAll('*').remove()
				if (group.data.templatebox && group.data.stackheight >= stackheight_min) {
					let read_count = 1
					for (const read of group.data.templatebox) {
						const read_name_bbox = group.dom.read_names_g
							.append('text')
							.attr('x', 0)
							.attr('y', (group.data.height * read_count) / group.data.templatebox.length)
							.attr('text-anchor', 'end')
							.style('fill', 'black')
							.attr('font-size', group.data.height / group.data.templatebox.length)
							.text(read.qname)
						group.ReadNameMaxwidth = Math.max(group.ReadNameMaxwidth, read_name_bbox.node().getBBox().width)
						read_count += 1
					}
				}
			} else {
				group.dom.read_names_g.selectAll('*').remove()
				group.ReadNameMaxwidth = 0
			}
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
			if (tk.show_readnames) {
				group.dom.read_names_g.selectAll('*').remove()
			}
		}
		group.dom.rightg.vslider.g.transition().attr('transform', 'scale(0)')
	}
	group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
}

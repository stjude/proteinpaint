import { select as d3select, event as d3event, mouse as d3mouse } from 'd3-selection'
import { axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { make_radios } from './dom'
import url2map from './url2map'

/*
important: tk.uninitialized will be deleted by getData at the first launch
to tell backend to provide color scale

tk can predefine if bam file has chr or not

tk.downloadgdc // Downloads bam file from gdc
tk.gdc // Renders gdc bam file
tk.variants[ {} ]
	.chr/pos/ref/alt
tk.pileupheight
tk.pileupbottompad

tk.dom{}
.pileup_axis // left side
.pileup_g // contains image
.pileup_img
.pileup_shown // if pileup is shown or not; to tell setTkHeight() whether height will be included
.vsliderg

tk.groups[]
.data{}
	.templatebox[{}] // optional, about the templates in view range
	         // server decides if to return template boxes (at poststack_adjustq)
	.count {r,t} // r for reads, t for templates
.data_fullstack{}
	.messagerowheights
	.stackcount
	.stackheight
	.allowpartstack
.dom{}
	.imgg
	.img_fullstack
	.img_partstack
	.box_move
	.box_stay
	.vslider{}
		.g
		.boxy
	.variantg <g>
	.variantrowheight
	.variantrowbottompad
        .gdc
        .gdcrowheight
        .gdcrowbottompad
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
*/

const labyspace = 5
const stackpagesize = 60

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

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
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
	}

	tk.regions = regions

	try {
		// loadTk is called by pan/zoom, and will always cancel partstack
		if (tk.groups) {
			for (const g of tk.groups) {
				delete g.partstack
				delete g.dom.vslider.boxy
			}
		}

		const data = await getData(tk, block)
		console.log('data:', data)
		if (data.error) throw data.error
		if (data.colorscale) {
			// available from 1st query, cache
			tk.colorscale = data.colorscale
		}

		renderTk(data, tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
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
		lst.push('variant=' + tk.variants.map(m => m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt).join('.'))
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
	let gdc_bam_files
	let orig_regions = []
	if (tk.downloadgdc) {
		lst.push('downloadgdc=' + tk.downloadgdc)
		gdc_bam_files = await client.dofetch2('tkbam?' + lst.join('&'), { headers })
		tk.file = gdc_bam_files[0] // This will need to be changed to a loop when viewing multiple regions in the same sample
		if (gdc_bam_files.error) throw gdc_bam_files.error
		delete tk.downloadgdc
		lst = lst.filter(a => a != 'downloadgdc=1') //remove this key after file download
		for (const r of tk.regions) {
			orig_regions.push(r)
		}
		tk.orig_regions = orig_regions
		tk.dom.gdc = tk.glider.append('g')
	}

	//delete orig_regions

	if (tk.file) lst.push('file=' + tk.file)

	if (tk.url) lst.push('url=' + tk.url)
	if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)

	if (window.devicePixelRatio > 1) lst.push('devicePixelRatio=' + window.devicePixelRatio)
	const data = await client.dofetch2('tkbam?' + lst.join('&'), { headers })
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
	tk.nochr = data.nochr

	if (data.pileup_data) {
		// update the pileup image
		tk.dom.pileup_shown = true
		tk.dom.pileup_img
			.attr('xlink:href', data.pileup_data.src)
			.attr('width', data.pileup_data.width)
			.attr('height', tk.pileupheight)
		// update axis
		tk.dom.pileup_axis.selectAll('*').remove()
		const scale = scaleLinear()
			.domain([0, data.pileup_data.maxValue])
			.range([tk.pileupheight, 0])
		client.axisstyle({
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
		tk.dom.pileup_shown = false
		tk.dom.pileup_axis.selectAll('*').remove()
		tk.dom.pileup_img.attr('width', 0)
	}

	if (tk.gdc) {
		may_render_gdc(data, tk, block)
	}
	may_render_variant(data, tk, block)

	if (!tk.groups) {
		tk.groups = []
		for (const g of data.groups) {
			tk.groups.push(makeGroup(g, tk, block, data))
		}
	} else {
		updateExistingGroups(data, tk, block)
	}

	setTkHeight(tk, data)

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
	block.setllabel()
	tk.kmer_diff_scores_asc = data.kmer_diff_scores_asc
}

function may_render_gdc(data, tk, block) {
	// call everytime track is updated, so that variant box can be positioned based on view range; even when there's no variant
	// in tk.dom.gdc, indicate location and status of the variant
	// TODO show variant info alongside box, when box is wide enough, show
	tk.dom.gdc.selectAll('*').remove()
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

	const yoff = data.pileup_data ? tk.pileupheight + tk.pileupbottompad : 0 // get height of existing graph above variant row

	// will render gdc region box in a row
	tk.dom.gdc
		.append('rect')
		.attr('x', x1)
		.attr('y', yoff)
		.attr('width', x2 - x1)
		.attr('height', tk.dom.gdcrowheight - 2)

	const gdc_string = 'Query region'
	// Determining where to place the text. Before, inside or after the box
	let gdc_start_text_pos = 0
	const space_param = 10
	const pad_param = 15
	if (gdc_string.length * space_param < x1) {
		gdc_start_text_pos = 0
	} else {
		gdc_start_text_pos = x2 + pad_param
	}

	tk.dom.gdc
		.append('text')
		.attr('x', gdc_start_text_pos)
		.attr('y', yoff + tk.dom.gdcrowheight)
		//.attr('dy', '.10em')
		.attr('font-size', tk.dom.gdcrowheight)
		.text(gdc_string)
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

	let yoff
	if (tk.gdc) {
		yoff = data.pileup_data ? tk.pileupheight + tk.pileupbottompad + tk.dom.gdcrowheight + tk.dom.gdcrowbottompad : 0 // get height of existing graph above variant row
	} else {
		yoff = data.pileup_data ? tk.pileupheight + tk.pileupbottompad : 0 // get height of existing graph above variant row
	}

	// will render variant in a row
	tk.dom.variantg
		.append('rect')
		.attr('x', x1)
		.attr('y', yoff)
		.attr('width', x2 - x1)
		.attr('height', tk.dom.variantrowheight - 2)

	const variant_string =
		tk.variants[0].chr + '.' + (tk.variants[0].pos + 1).toString() + '.' + tk.variants[0].ref + '.' + tk.variants[0].alt
	// Determining where to place the text. Before, inside or after the box
	let variant_start_text_pos = 0
	const space_param = 10
	const pad_param = 15
	if (variant_string.length * space_param < x1) {
		variant_start_text_pos = 0
	} else {
		variant_start_text_pos = x2 + pad_param
	}

	tk.dom.variantg
		.append('text')
		.attr('x', variant_start_text_pos)
		.attr('y', yoff + tk.dom.variantrowheight)
		//.attr('dy', '.10em')
		.attr('font-size', tk.dom.variantrowheight)
		.text(variant_string)

	if (data.refalleleerror == true) {
		const text_string = 'Incorrect reference allele'
		// Determining position to place the string and avoid overwriting variant string
		let text_start_pos = 0
		if (
			variant_start_text_pos == 0 &&
			text_string.length * space_param + pad_param < x1 - variant_string.length * space_param
		) {
			text_start_pos = variant_string.length * space_param + pad_param
		} else if (variant_start_text_pos != 0 && text_string.length * space_param < x1) {
			text_start_pos = 0
		} else if (variant_start_text_pos == x2 + pad_param) {
			text_start_pos = x2 + variant_string.length * space_param + pad_param
		} else {
			text_start_pos = x2 + pad_param
		}

		tk.dom.variantg
			.append('text')
			.attr('x', text_start_pos)
			.attr('y', yoff + tk.dom.variantrowheight + tk.dom.variantrowbottompad)
			.style('fill', 'red')
			//.attr('dy', '.10em')
			.attr('font-size', tk.dom.variantrowheight)
			.text(text_string)
	}

	if (data.max_diff_score) {
		// Should always be true if variant field was given by user, but may change in the future
		tk.dom.variantg
			.append('text')
			.attr('x', data.pileup_data.width)
			.attr('y', yoff - tk.dom.variantrowheight)
			//.attr('dy', '.10em')
			.attr('font-size', tk.dom.variantrowheight)
			.text('Diff Score')

		tk.dom.variantg
			.append('text')
			.attr('x', data.pileup_data.width)
			.attr('y', yoff + tk.dom.variantrowheight)
			//.attr('dy', '.10em')
			.attr('font-size', tk.dom.variantrowheight)
			.text('Max: ' + data.max_diff_score.toFixed(2).toString())

		tk.dom.variantg
			.append('text')
			.attr('x', data.pileup_data.width)
			.attr('y', yoff + 2 * tk.dom.variantrowheight)
			//.attr('dy', '.10em')
			.attr('font-size', tk.dom.variantrowheight)
			.text('Min: ' + data.min_diff_score.toFixed(2).toString())
	}
}

function setTkHeight(tk, data) {
	// call after any group is updated
	let h = 0
	if (tk.dom.pileup_shown) h += tk.pileupheight + tk.pileupbottompad
	if (tk.gdc) {
		h += tk.dom.gdcrowheight + tk.dom.gdcrowbottompad
	}
	if (tk.dom.variantg) {
		h += tk.dom.variantrowheight + tk.dom.variantrowbottompad
	}
	for (const g of tk.groups) {
		g.dom.imgg.transition().attr('transform', 'translate(0,' + h + ')')
		if (tk.variants) {
			g.dom.diff_score_barplot_fullstack.transition().attr('transform', 'translate(0,' + h + ')')
		}
		if (g.partstack) {
			// slider visible
			if (tk.variants) {
				g.dom.diff_score_barplot_partstack.transition().attr('transform', 'translate(0,' + h + ')')
				g.dom.vslider.g
					.transition()
					.attr('transform', 'translate(' + g.data.diff_scores_img.width + ',' + h + ') scale(1)')
			} else {
				g.dom.vslider.g.transition().attr('transform', 'translate(0,' + (h + g.data.messagerowheights) + ') scale(1)')
			}
		}
		h += g.data.height
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

		group.dom.diff_score_barplot_fullstack
			.attr('xlink:href', gd.diff_scores_img.src)
			.attr('width', gd.diff_scores_img.width)
			.attr('height', gd.diff_scores_img.height)

		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		group.dom.diff_score_barplot_partstack.attr('width', 0).attr('height', 0)

		//tk.config_handle.transition().attr('x', 0)
		group.dom.vslider.g.transition().attr('transform', 'scale(0)')
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
	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})

	tk.readpane = client.newpane({ x: 100, y: 100, closekeep: 1 })
	tk.readpane.pane.style('display', 'none')
	// <g> of each group is added dynamically to glider
	tk.pileupheight = 100
	tk.pileupbottompad = 6

	tk.dom = {
		pileup_g: tk.glider.append('g'),
		pileup_axis: tk.glider.append('g'),
		vsliderg: tk.gright.append('g')
	}

	tk.dom.pileup_img = tk.dom.pileup_g.append('image') // pileup track height is defined

	if (tk.variants) {
		// assuming that variant will only be added upon track initiation
		tk.dom.variantg = tk.glider.append('g')
		tk.dom.variantrowheight = 15
		tk.dom.variantrowbottompad = 5
		tk.dom.diff_score_g = tk.gright.append('g') // For storing bar plot of diff_score
	}
	if (tk.gdc) {
		tk.dom.gdc_bar = tk.glider.append('g')
		tk.dom.gdcrowheight = 15
		tk.dom.gdcrowbottompad = 5
	}
	tk.asPaired = false

	let laby = block.labelfontsize + 5
	tk.label_count = block.maketklefthandle(tk, laby)
}

// may add additional parameters from url that specifically apply to the bam track
function may_add_urlparameter(tk) {
	const u2p = url2map()

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
			for (let i = 0; i < tmp.length; i += 4) {
				const pos = Number(tmp[i + 1])
				if (!Number.isInteger(pos)) return console.log('urlparam variant pos is not integer')
				if (!tmp[i + 2]) return console.log('ref allele missing')
				if (!tmp[i + 3]) return console.log('alt allele missing')
				tk.variants.push({ chr: tmp[i], pos: pos - 1, ref: tmp[i + 2], alt: tmp[i + 3] })
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
			imgg: tk.glider.append('g'),
			vslider: {
				g: tk.dom.vsliderg.append('g').attr('transform', 'scale(0)')
			}
		}
	}
	if (tk.variants) {
		group.dom.diff_score_barplot_fullstack = tk.dom.diff_score_g
			.append('image')
			.attr('xlink:href', gd.diff_scores_img.src)
			.attr('width', gd.diff_scores_img.width)
			.attr('height', gd.diff_scores_img.height)
		group.dom.diff_score_barplot_partstack = tk.dom.diff_score_g
			.append('image')
			.attr('xlink:href', gd.diff_scores_img.src)
			.attr('width', 0)
			.attr('height', 0)
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
				enter_partstack(group, tk, block, my - group.data.messagerowheights, data)
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

	group.dom.vslider.bar = group.dom.vslider.g
		.append('rect')
		.attr('fill', '#eee')
		.attr('x', 10)
		.attr('width', 20)
		.on('mouseover', () => group.dom.vslider.bar.attr('fill', '#fae8e8'))
		.on('mouseout', () => group.dom.vslider.bar.attr('fill', '#eee'))
		.on('click', () => {
			delete group.dom.vslider.boxy
			delete group.partstack
			group.data = group.data_fullstack
			renderGroup(group, tk, block)
			setTkHeight(tk, data)
			block.block_setheight()
		})
	group.dom.vslider.boxg = group.dom.vslider.g.append('g')
	group.dom.vslider.box = group.dom.vslider.boxg
		.append('rect')
		.attr('fill', '#c7edc5')
		.attr('width', 40)
		.on('mousedown', () => {
			d3event.preventDefault()
			group.dom.vslider.box.attr('fill', '#9ed19b')
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxy + deltay <= 0) return
				} else {
					if (group.dom.vslider.boxy + deltay >= group.data.height - group.dom.vslider.boxh) return
				}
				deltay = d
				group.dom.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.vslider.boxy + deltay) + ')')
				group.dom.img_partstack.attr(
					'y',
					-((deltay * group.data_fullstack.stackcount * group.data.stackheight) / group.data.height)
				)
				group.dom.box_move.attr('width', 0)
				group.dom.box_stay.attr('width', 0)
			})
			b.on('mouseup', async () => {
				group.dom.vslider.box.attr('fill', '#c7edc5')
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxy += deltay
				const delta = Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
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
				setTkHeight(tk, data)
				block.tkcloakoff(tk, {})
				block.block_setheight()
			})
		})

	group.dom.vslider.boxtopline = group.dom.vslider.boxg
		.append('line')
		.attr('stroke', '#9ed19b')
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.vslider.boxtopline.attr('stroke', '#36a32f'))
		.on('mouseout', () => group.dom.vslider.boxtopline.attr('stroke', '#9ed19b'))
		.on('mousedown', () => {
			d3event.preventDefault()
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxy + deltay <= 0) return
				} else {
					if (group.dom.vslider.boxh - deltay <= (stackpagesize * group.data.height) / group.data_fullstack.stackcount)
						return
				}
				deltay = d
				group.dom.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.vslider.boxy + deltay) + ')')
				group.dom.vslider.box.attr('height', group.dom.vslider.boxh - deltay)
				group.dom.vslider.boxbotline
					.attr('y1', group.dom.vslider.boxh - deltay)
					.attr('y2', group.dom.vslider.boxh - deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxy += deltay
				group.partstack.start += Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
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
	group.dom.vslider.boxbotline = group.dom.vslider.boxg
		.append('line')
		.attr('stroke', '#9ed19b')
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.vslider.boxbotline.attr('stroke', '#36a32f'))
		.on('mouseout', () => group.dom.vslider.boxbotline.attr('stroke', '#9ed19b'))
		.on('mousedown', () => {
			d3event.preventDefault()
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxh + d <= (stackpagesize * group.data.height) / group.data_fullstack.stackcount)
						return
				} else {
					if (group.dom.vslider.boxy + deltay >= group.data.height - group.dom.vslider.boxh) return
				}
				deltay = d
				group.dom.vslider.box.attr('height', group.dom.vslider.boxh + deltay)
				group.dom.vslider.boxbotline
					.attr('y1', group.dom.vslider.boxh + deltay)
					.attr('y2', group.dom.vslider.boxh + deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxh += deltay
				group.partstack.stop += Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
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

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const d = tk.tkconfigtip.d.append('div')

	if (tk.kmer_diff_scores_asc) {
		tk.kmerScorePlotBtn = d.append('div')
		tk.kmerScorePlotBtn
			.append('button')
			.html('Plot KMER scores')
			.on('click', async () => {
				const scatterpane = client.newpane({ x: 100, y: 100, closekeep: 1 })
				const _ = await import('./scatter')
				_.renderScatter({ holder: scatterpane.body, data: tk.kmer_diff_scores_asc })
			})
	}

	{
		const row = d.append('div')
		row
			.append('span')
			.html('Show reads as:&nbsp;')
			.style('opacity', 0.5)
		make_radios({
			holder: row,
			options: [
				{ label: 'single', value: 'single', checked: !tk.asPaired },
				{ label: 'paired', value: 'paired', checked: tk.asPaired }
			],
			styles: { display: 'inline-block' },
			callback: () => {
				tk.asPaired = !tk.asPaired
				loadTk(tk, block)
			}
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
async function getReadInfo(tk, block, box, ridx) {
	client.appear(tk.readpane.pane)
	tk.readpane.header.text('Read info')
	tk.readpane.body.selectAll('*').remove()
	const wait = tk.readpane.body.append('div').text('Loading...')
	const req_data = getparam()
	const data = await client.dofetch2('tkbam?' + req_data.lst.join('&'), { headers: req_data.headers })

	if (data.error) {
		client.sayerror(wait, data.error)
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
					const data2 = await client.dofetch2('tkbam?' + req_data.lst.join('&'), { headers: req_data.headers })
					if (data2.error) {
						wait.text('')
						client.sayerror(wait, data2.error)
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
				const data = await client.dofetch2(
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

	setTkHeight(tk, data)
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
		group.dom.diff_score_barplot_fullstack.attr('width', 0).attr('height', 0)
		// group vslider.g y position is set and turned visible in setTkHeight(), but not here
		const scrollableheight = group.data.height - group.data.messagerowheights
		group.dom.vslider.bar.transition().attr('height', scrollableheight)
		group.dom.vslider.boxy = (scrollableheight * group.partstack.start) / group.data_fullstack.stackcount
		group.dom.vslider.boxh =
			(scrollableheight * (group.partstack.stop - group.partstack.start)) / group.data_fullstack.stackcount
		group.dom.vslider.box.transition().attr('height', group.dom.vslider.boxh)
		group.dom.vslider.boxbotline
			.transition()
			.attr('y1', group.dom.vslider.boxh)
			.attr('y2', group.dom.vslider.boxh)
		group.dom.vslider.boxg.transition().attr('transform', 'translate(0,' + group.dom.vslider.boxy + ')')
	} else {
		group.dom.img_fullstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		if (group.dom.diff_score_barplot_partstack) {
			group.dom.diff_score_barplot_partstack.attr('width', 0).attr('height', 0)
		}
		group.dom.diff_score_barplot_fullstack
			.attr('width', group.data.diff_scores_img.width)
			.attr('height', group.data.diff_scores_img.height)
		group.dom.vslider.g.transition().attr('transform', 'scale(0)')
	}
	group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
}

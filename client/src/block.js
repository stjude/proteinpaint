import { scaleLinear } from 'd3-scale'
import { select as d3select, selectAll as d3selectAll, pointer } from 'd3-selection'
import { format as d3format } from 'd3-format'
import { axisTop, axisLeft } from 'd3-axis'
import { debounce } from 'debounce'
import * as client from './client'
import { axisstyle, Menu, newSandboxDiv, sayerror, appear, disappear } from '#dom'
import { dofetch3 } from '../common/dofetch'
import * as common from '#shared/common.js'
import * as coord from './coord'
import vcf2dstk from './vcf.tkconvert'
import blockinit from './block.init'
import * as Legend from './block.legend'
import { string2snp } from '#common/snp'

// track types
import { bamfromtemplate, bammaketk, bamload } from './block.tk.bam.adaptor'
import { pgvfromtemplate, pgvmaketk, pgvload } from './block.tk.pgv.adaptor'
import { ldfromtemplate, ldmaketk, ldload } from './block.tk.ld.adaptor'
import { junctionfromtemplate, junctionmaketk, junctionload } from './block.tk.junction.adaptor'
import { bampilefromtemplate, bampilemaketk, bampileload } from './block.tk.bampile'
import { bigwigfromtemplate, bigwigmaketk, bigwigload, bigwigloadsubpanel } from './block.tk.bigwig'
import { aicheckfromtemplate, aicheckmaketk, aicheckload, aicheckloadsubpanel } from './block.tk.aicheck.adaptor'
import {
	bigwigstrandedfromtemplate,
	bigwigstrandedmaketk,
	bigwigstrandedload,
	bigwigstrandedloadsubpanel
} from './block.tk.bigwigstranded'
import { bedjfromtemplate, bedjmaketk, bedjload, bedjloadsubpanel } from './block.tk.bedj'
import { gmtkfromtemplate, gmtkmaketk, gmtkrender } from './block.tk.usegm'
import { hicstrawfromtemplate, hicstrawmaketk, hicstrawload } from './block.tk.hicstraw.adaptor'
import { asefromtemplate, asemaketk, aseload } from './block.tk.ase.adaptor'

import { mdsjunctionfromtemplate, mdsjunctionmaketk, mdsjunctionload } from './block.mds.junction.adaptor'
import { mdssvcnvfromtemplate, mdssvcnvmaketk, mdssvcnvload } from './block.mds.svcnv.adaptor'
import {
	mdsexpressionrankfromtemplate,
	mdsexpressionrankmaketk,
	mdsexpressionrankload
} from './block.mds.expressionrank.adaptor'
import { mds3_fromtemplate, mds3_maketk, mds3_load } from '../mds3/adaptor'
import { bedgraphdot_fromtemplate, bedgraphdot_maketk, bedgraphdot_load } from './block.tk.bedgraphdot.adaptor'

/* non-standard handler for legacy dataset
can delete when migrated to mds3
*/
import * as blockds from './block.ds'
import dsmaketk from './block.ds.maketk'

// dummy

/* 
callbacks from constructor options
- onloadalltk
- onloadalltk_always
- onCoordinateChange
- onpanning
- onsetheight
- onAddRemoveTk

**************** METHODS
updateruler()
moremenu()
**************** helper
makecoordinput()

*/

const basecolorunknown = '#858585'
const baseheight = 16
const ntpxwidth = 20 // max allowed pixel width for a nt
const hlregioncolor = '#ccffff' // default color
const rulergrabzindex = 1000
const headerTip = new Menu()

let blockId = 1

export class Block {
	constructor(arg) {
		/*** NOTE: This block instance is returned when calling runproteinpaint({block: true, ....}) ***/

		// assign a blockId to help in targeted DOM selection, in testing and maybe live usage.
		this.blockId = blockId++

		this.mclassOverride = arg.mclassOverride // allow tracks to access it to render legend

		// temp fix, to use in dofetch( {serverData} )
		this.cache = {}

		if (arg.debugmode) {
			window.bb = this
			this.debugmode = true
		}

		this.hostURL = sessionStorage.getItem('hostURL') // NO NEED for these after replacing fetch() with dofetch
		this.jwt = sessionStorage.getItem('jwt')

		if (!arg.style) {
			arg.style = {}
		}
		if (arg.style.margin == undefined) {
			arg.style.margin = '20px'
		}
		if (arg.cohort) {
			this.cohort = arg.cohort
		}
		this.busy = true

		//////////////////////////////////////////
		//////// attach particular configurations
		if (arg.hidedatasetexpression) this.hidedatasetexpression = arg.hidedatasetexpression
		if (arg.variantPageCall_snv) this.variantPageCall_snv = arg.variantPageCall_snv
		if (arg.samplecart) this.samplecart = arg.samplecart

		this.pannedpx = undefined
		this.zoomedin = false
		this.resized = false

		if (!arg.hidegenelegend) {
			this.legend = {
				mclasses: new Map(), // two special legend that cover all dstk on display
				morigins: new Map(),
				legendcolor: '#7D6836',
				headtextcolor: '#555',
				vpad: '5px'
			}
		}

		this.ctrl = {}
		this.ds2handle = {}
		this.ownds = {} // compared to genome.datasets
		this.rglst = []
		this.tklst = []

		// special effects
		this.rotated = arg.rotated
		this.showreverse = arg.showreverse // effect on pan

		////////////////////////////////
		// callbacks
		this.onloadalltk = []
		this.onloadalltk_always = arg.onloadalltk_always
		this.onpanning = arg.onpanning
		this.onsetheight = arg.onsetheight
		if (arg.onAddRemoveTk) {
			if (typeof arg.onAddRemoveTk != 'function') throw 'onAddRemoveTk() not function'
			this.onAddRemoveTk = arg.onAddRemoveTk
		}
		this.onCoordinateChange = arg.onCoordinateChange // argument is the rglst[]

		this.exonsf = 1 // # pixel per basepair

		this.labelfontsize = 14
		this.tkleftlabel_xshift = -10
		this.genome = arg.genome
		this.holder0 = arg.holder
		this.errdiv = arg.holder.append('div')

		this.blocktip = new Menu({ padding: '0px' })
		/* used at:
		old official ds handle, mouse over for "About" menu
		mds handle, click to show list of contents
		zoom buttons, mouse over for list of subpanels
	*/
		this.tip = new Menu({ padding: '0px' })

		if (!this.genome) {
			this.error('no genome')
			return
		}

		// the main block width, not including subpanels
		if (arg.width) {
			this.width = arg.width
		} else {
			const minwidth = 800
			const w = arg.holder.node().getBoundingClientRect().width
			this.width = ntpxwidth * Math.ceil(Math.max(w * 0.63, minwidth) / ntpxwidth)

			// !!! TEMP !!!
			// hardcoded method to detect legacy ds with floating exp panel, to make room for the panels; delete after pediatric legacy ds is retired
			if (arg.datasetlst?.includes('pediatric')) this.width -= 100
		}

		if (arg.usegm) {
			this.usegm = arg.usegm
			if (!this.usegm.pdomains) {
				// when it didn't go through block.init
				this.usegm.pdomains = []
			}
			this.allgm = arg.allgm
			if (!this.allgm) {
				this.allgm = [arg.usegm]
			}
			if (!arg.tklst) {
				arg.tklst = []
			}

			const gmtk = arg.tklst.find(i => i.type == client.tkt.usegm)
			if (gmtk) {
				/*
				a track obj by type="usegm" already exists
				override gene name of this tk, and do not add a new "gmtk" obj to arg.tklst[]
				*/
				gmtk.name = arg.usegm.name
			} else {
				// no "usegm" track exists in arg.tklst[], create new object
				arg.tklst.push({
					type: client.tkt.usegm,
					name: arg.usegm.name,
					//model:arg.usegm,
					stackheight: arg.gmstackheight
				})
			}
		} else if (arg.rglst) {
			for (const r of arg.rglst) {
				this.rglst.push({
					chr: r.chr,
					bstart: r.start,
					bstop: r.stop,
					start: r.start,
					stop: r.stop,
					reverse: r.reverse
				})
			}
			this.regionspace = 10
		} else {
			// single region
			const e = coord.invalidcoord(this.genome, arg.chr, arg.start, arg.stop)
			if (e) {
				this.error(e)
				return
			}
			const _chr = this.genome.chrlookup[arg.chr.toUpperCase()]
			const minspan = Math.ceil(this.width / ntpxwidth) //200
			if (arg.stop - arg.start < minspan) {
				const h = Math.ceil(minspan / 2)
				const m = Math.floor((arg.start + arg.stop) / 2)
				arg.start = m - h
				arg.stop = m + h
			}
			this.rglst = [
				{
					chr: _chr.name,
					bstart: 0,
					bstop: _chr.len,
					start: arg.start,
					stop: arg.stop,
					reverse: this.showreverse
				}
			]
			this.regionspace = 0
		}
		this.startidx = 0
		this.stopidx = this.rglst.length - 1

		// TODO allow svgholder for embedding into an existing svg

		this.holder = arg.holder
			.append('div')
			.style('margin', arg.style.margin)
			.style('display', 'inline-block')
			.attr('class', 'sja_Block_div')
		if (!arg.nobox) {
			this.holder.style('border', 'solid 1px #ccc')
		}
		if (arg.bgcolor) {
			this.holder.style('background-color', arg.bgcolor)
		}

		if (this.genome.hasIdeogram) {
			this.initIdeogram(arg)
			// creates this.ideogram{}
		}

		let butrow
		if (!arg.butrowbottom) {
			butrow = this.holder.append('div')
		}
		{
			const inlinediv = this.holder
				.append('div') // contains svg and resize button
				.style('position', 'relative')
				.style('display', 'inline-block')
			this.svg = inlinediv
				.append('svg')
				.attr('data-testid', 'sjpp_block_svg')
				.on('mousedown', event => {
					event.preventDefault()
				})
			if (!arg.noresize) {
				this.resizewidthbutton = inlinediv
					.append('div')
					.text('drag to resize')
					.attr('class', 'sja_clbtext')
					.style('position', 'absolute')
					.style('bottom', '-5px') // push down enough not to touch protein bar
					.style('font-size', '.7em')
					.on('mousedown', event => {
						event.preventDefault()
						const x = event.clientX
						const body = d3select(document.body)
						body.on('mousemove', event => {
							this.resizewidthbutton.style('right', this.rpad + this.rightheadw + x - event.clientX + 'px')
						})
						body.on('mouseup', event => {
							this.resizewidthbutton.style('right', this.rpad + this.rightheadw + 'px')
							body.on('mousemove', null).on('mouseup', null)
							if (this.busy) {
								return
							}

							this.zoomedin = false
							this.pannedpx = undefined
							// the only place to set it to true
							this.resized = true

							this.width += event.clientX - x

							this.block_coord_updated()
						})
					})
			}
		}
		if (arg.butrowbottom) {
			butrow = this.holder.append('div').style('margin-top', '5px')
		}
		if (arg.hidegenecontrol) {
			this.hidegenecontrol = true
			butrow.style('display', 'none')
		}

		if (this.legend) {
			const div = this.holder.append('div').style('margin-top', '5px')

			let shown = !arg.foldlegend

			div
				.append('div')
				.text('LEGEND')
				.attr('class', 'sja_clb')
				.style('display', 'inline-block')
				.style('font-size', '.7em')
				.style('color', this.legend.legendcolor)
				.on('click', () => {
					if (shown) {
						shown = false
						disappear(div2)
					} else {
						shown = true
						appear(div2)
					}
				})

			const div2 = this.holder.append('div').style('border-top', 'solid 1px ' + this.legend.legendcolor)
			//.style('background-color', '#FCFBF7')
			if (arg.foldlegend) {
				div2.style('display', 'none')
			}

			this.legend.holder = div2.append('table').style('border-spacing', '15px').style('border-collapse', 'separate')

			const [tr1, td1] = Legend.legend_newrow(
				this,
				//Allows user to set left-side group designation for classes
				arg.mclassOverride ? arg.mclassOverride.className : 'CLASS'
			)
			this.legend.tr_mclass = tr1.style('display', 'none')
			this.legend.td_mclass = td1
			const [tr2, td2] = Legend.legend_newrow(this, 'ORIGIN')
			this.legend.tr_morigin = tr2.style('display', 'none')
			this.legend.td_morigin = td2

			if (arg.legendimg) {
				const [tr, td] = Legend.legend_newrow(this, arg.legendimg.name || '')
				this.make_legend_img(arg.legendimg, td)
			}
		}

		if (arg.usegm) {
			// do this after legend is set
			// fills this.rglst[], this.startidx, this.stopidx
			this.setgmmode(arg.gmmode || client.gmmode.genomic)
		}

		// rglst is set, can process ideogram
		if (this.ideogram) {
			if (this.ideogram.visible) this.updateIdeogram()
			else this.ideogram.div.style('display', 'none')
		}

		if (arg.nobox) {
			// no dogtag
		} else {
			// use dogtag
			butrow
				.append('div')
				.html(arg.dogtag ? arg.dogtag : arg.chr)
				.style('display', 'inline-block')
				.style('padding', '5px')
				.style('background-color', '#bbb')
				.style('color', 'white')
		}
		if (this.usegm) {
			this.usegmtip = new Menu({ padding: 'none' })
			// name button
			this.ctrl.namebutt = butrow
				.append('span')
				.attr('class', 'sja_clbtext')
				.html(
					'<span data-testid="sja_block_usegm_name" style="font-size:1.5em;font-weight:bold">' +
						this.usegm.name +
						'</span> ' +
						this.usegm.isoform
				)
				.on('click', event => {
					event.stopPropagation()
					this.genemenu()
				})
			butrow.append('span').html('&nbsp;&nbsp;&nbsp;')

			butrow
				.append('div') // duplicated
				.text(this.genome.name)
				.attr('class', 'sjpp-active-tiny-button')

			// official dataset (legacy ds), only use in gm mode, won't show in plain browser
			this.ctrl.dshandleholder = butrow.append('span')
			if (!arg.hide_dsHandles) {
				// can show ds handles
				if (this.genome.datasets) {
					for (const n in this.genome.datasets) {
						if (this.genome.datasets[n].isMds) {
							// old ds, do not show mds here
							continue
						}
						if (this.genome.datasets[n].noHandleOnClient) continue
						this.old_dshandle_new(n)
					}
				}
				// custom data, legacy ds
				butrow
					.append('div')
					.attr('class', 'sja_opaque8 sjpp-plus-button')
					.text('+')
					.on('click', event => {
						const p = event.target.getBoundingClientRect()
						this.tip.clear().show(p.left - 150, p.top + p.height - 15)
						import('../mds3/customdata.inputui').then(q => q.default(this))
					})
			}
			butrow.append('span').html('&nbsp;&nbsp;&nbsp;')
		}

		this.coord = {
			height: 0
		}
		if (this.usegm) {
			// no input box
		} else {
			makecoordinput(this, butrow)

			this.coordwidthsays = butrow.append('span').style('padding', '0px 10px 0px 5px').style('font-size', '80%')

			butrow
				.append('div') // duplicated
				.style('display', 'inline-block')
				.text(this.genome.name)
				.style('background', '#465f75')
				.style('font-size', '.8em')
				.style('color', 'white')
				.style('padding', '1px 5px')
				.style('margin-right', '5px')
				.style('border-radius', '4px')
		}

		/*
	mds handle always shown
	after coord input
	may configure not to show
	*/
		if (!arg.hide_dsHandles && this.genome.datasets) {
			const lst = []
			for (const n in this.genome.datasets) {
				if (this.genome.datasets[n].isMds && !this.genome.datasets[n].noHandleOnClient) {
					lst.push(n)
				}
			}
			if (lst.length) {
				this.ctrl.mdsHandleHolder = butrow.append('span').style('margin-right', '10px')
				for (const i of lst) this.mds_handle_make(i)
			}
		}

		this.ctrl.zinbutt = butrow
			.append('button')
			.html('In')
			.on('click', () => this.zoomblock(2))
			.on('mouseover', () => this.zoombutton_mouseover(2, false, this.ctrl.zinbutt.node()))
		//.on('mouseout',()=>this.blocktip.hide())
		this.ctrl.zobutt1 = butrow
			.append('button')
			.html('Out &times;2')
			.on('click', () => this.zoomblock(2, true))
			.on('mouseover', () => this.zoombutton_mouseover(2, true, this.ctrl.zobutt1.node()))
		this.ctrl.zobutt2 = butrow
			.append('button')
			.html('&times;10')
			.on('click', () => this.zoomblock(10, true))
			.on('mouseover', () => this.zoombutton_mouseover(10, true, this.ctrl.zobutt2.node()))
		this.ctrl.zobutt3 = butrow
			.append('button')
			.html('&times;50')
			.on('click', () => this.zoomblock(50, true))
			.on('mouseover', () => this.zoombutton_mouseover(50, true, this.ctrl.zobutt3.node()))

		/*
	this.ctrl.revbutt=butrow.append('button')
		.html(this.coord.reverse ? 'Reverse &laquo;' : 'Forward &raquo;')
		.on('click',()=>this.reverseorient())
		*/

		{
			const button = butrow.append('button').text('Tracks').style('margin-left', '10px')
			const tip = new Menu({ padding: 'none' })
			button.on('click', event => {
				// remove past state for refreshing tk data
				this.pannedpx = undefined
				this.zoomedin = false
				this.resized = false
				const p = event.target.getBoundingClientRect()
				import('./block.tk.menu').then(q => {
					q.default(this, tip, p.left - 100, p.top + p.height - 15)
				})
			})
		}

		{
			butrow
				.append('button')
				.style('margin-left', '10px')
				.text('More')
				.on('click', event => {
					headerTip.clear()
					const p = event.target.getBoundingClientRect()
					this.moremenu(headerTip)
					// must create menu contents first then show, so the height-placement will work
					headerTip.show(p.left - 50, p.top + p.height - 15)
				})
		}

		this.gdcBamSliceDownloadBtn = butrow
			.append('button')
			.style('margin-left', '10px')
			.style('display', 'none')
			.text('Download GDC BAM slice')
			.on('click', async () => {
				const tks = this.tklst.filter(i => i.type == 'bam' && i.gdcFile)
				if (tks.length == 0) return
				if (tks.length == 1) {
					downloadOneFile(tks[0], this.gdcBamSliceDownloadBtn)
					return
				}
				headerTip.clear().showunder(this.gdcBamSliceDownloadBtn.node())
				for (const t of tks) {
					const button = headerTip.d
						.append('button')
						.text(t.name)
						.style('display', 'block')
						.style('margin', '4px')
						.on('click', () => downloadOneFile(t, button))
				}

				async function downloadOneFile(tk, button) {
					button.property('disabled', true)

					// old method of window.open() won't allow passing token via request header
					//const requestUrl = `tkbam?genome=${this.genome.name}&clientdownloadgdcslice=`
					//window.open(requestUrl, '_self', 'download')

					// FIXME the entire bam slice is cached in browser memory before downloading, which can be slow
					// will be nice to directly "stream" to a download file without caching

					const headers = {
						'Content-Type': 'application/json',
						Accept: 'application/json'
					}
					if (tk.gdcToken) {
						headers['X-Auth-Token'] = tk.gdcToken
					}
					const lst = []
					const data = await dofetch3('tkbam', {
						headers,
						body: {
							clientdownloadgdcslice: 1,
							gdcFileUUID: tk.gdcFile.uuid,
							gdcFilePosition: tk.gdcFile.position
						}
					})

					button.property('disabled', false)

					const a = document.createElement('a')
					a.href = URL.createObjectURL(data)
					a.download = tk.aboutThisFile ? tk.aboutThisFile[0].v + '.bam' : 'gdc.bam'
					a.style.display = 'none'
					document.body.appendChild(a)
					a.click()
					document.body.removeChild(a)
				}
			})

		this.gbase = this.svg.append('g').attr('transform', 'translate(0,0)')

		// cloak that covers gbase with a rect to indicate loading and prevent user interaction
		this.gCloak = this.svg.append('g').attr('transform', 'scale(0)')
		this.gCloakRect = this.gCloak.append('rect').attr('fill', 'white')
		this.gCloakWord = this.gCloak
			.append('text')
			.attr('id', 'loadinggCloak')
			.text('Loading ...')
			.attr('fill', common.defaultcolor)
			.attr('fill-opacity', 0)
			.attr('font-weight', 'bold')
			.attr('font-size', '18px')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')

		this.pica = { g: this.svg.append('g') }

		this.hlregion = {
			g: this.gbase.append('g'),
			lst: []
		}

		init_cursorhlbar(this)

		this.leftheadw = arg.leftheadw || 100
		this.rightheadw = arg.rightheadw || 100

		// row - coordinate ruler
		this.rulerheight = 20
		this.rulerfontsize = 13
		this.rulerticksize = 6
		this.lpad = 3
		this.rpad = 10
		this.coordyp1 = 3 // top pad
		this.coordyp2 = 3 // bottom pad

		// grand holder, to contain main coord ruler of both main tk and sub panels, so they pan independently
		this.coord.g0 = this.gbase
			.append('g')
			.attr('transform', 'translate(' + (this.leftheadw + this.lpad) + ',' + (this.coordyp1 + this.rulerheight) + ')')

		// ruler for main track, pans along with them
		this.coord.g = this.coord.g0.append('g')

		// main holder for subpanel rulers, each pans independently
		this.coord.gcoordsubpanels = this.coord.g0.append('g')

		this.coord.name = this.coord.g
			.append('text')
			.attr('text-anchor', 'end')
			.attr('x', -this.lpad + this.tkleftlabel_xshift)
			.attr('y', -this.rulerheight / 2)
			.attr('dominant-baseline', 'central')
			.attr('font-size', 13)
		if (this.hidegenecontrol) {
			this.coord.name
				.text('Zoom out')
				.classed('sja_clbtext', true)
				.on('click', () => {
					if (this.busy) return
					if (this.nozoomout()) {
						return
					}
					this.zoomblock(2, true)
				})
		}
		this.coord.axesg = this.coord.g.append('g')
		this.coord.grab = this.coord.g
			.append('rect')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('x', 0)
			.attr('y', -this.coordyp1 - this.rulerheight)
			.attr('width', this.width)
			.on('mousedown', event => {
				this.rulermousedown(event, this)
					.then(tmp => {
						const [toofine, startpx, spanpx] = tmp

						if (this.toselecthlregion) {
							this.busy = false
							delete this.toselecthlregion
							const [startidx, startpos] = this.pxoff2region(startpx)
							const [stopidx, stoppos] = this.pxoff2region(startpx + spanpx)
							const chr = this.rglst[startidx].chr
							if (chr == this.rglst[stopidx].chr) {
								this.addhlregion(chr, Math.min(startpos, stoppos), Math.max(startpos, stoppos))
							}
							return
						}
						// zoom in
						if (toofine) {
							// too fine won't zoom in
							this.busy = false
							return
						}
						this.zoomedin = true
						this.zoom2px(startpx, startpx + spanpx)
					})
					.catch(e => {
						if (e == 'busy') return
						this.error(e.message)
						console.log(e.stack)
					})
			})

		// sub panels
		// contain master instruction of each subpanel (chr/start/stop/width), to be propagated to .subpanels[] of each track
		this.subpanels = []
		if (arg.subpanels) {
			this.subpanels = arg.subpanels
			for (const [idx, p] of this.subpanels.entries()) {
				p.exonsf = p.width / (p.stop - p.start)
				this.init_coord_subpanel(p)
			}
		}

		this.updateruler()

		if (arg.hlregions) {
			for (const r of arg.hlregions) {
				this.addhlregion(r.chr, r.start, r.stop, r.color)
			}
		}

		if (arg.tklst) {
			for (const _tk of arg.tklst) {
				// validate input track!!!

				if (!_tk.type) {
					this.error('missing type in a track')
					continue
				}

				let pre_tk = _tk // for vcf track, the 'pre_tk' object will be replaced by dstk

				const hidden = pre_tk.hidden
				delete pre_tk.hidden

				if (pre_tk.type == 'vcf') {
					// convert vcf to dstk, this is duplicated in tk.menu
					const [err, dstk] = vcf2dstk(pre_tk)
					if (err) {
						this.error('VCF track error: ' + err)
						continue
					}
					pre_tk = dstk
					pre_tk.iscustom = _tk.iscustom
				}

				if (pre_tk.iscustom) {
					// should register
					if (!client.tkexists(pre_tk, this.genome.tracks)) {
						// this is a new custom track
						pre_tk.tkid = Math.random().toString() // important
						this.genome.tracks.push(pre_tk)
					}
				}

				if (!hidden) {
					this.block_addtk_template(pre_tk)
				}
			}
		}

		if (arg.nativetracks) {
			// add selected native tracks

			const tklookup = new Map()
			if (this.genome.tracks) {
				for (const t of this.genome.tracks) {
					if (t.iscustom) continue
					tklookup.set(t.name.toLowerCase(), t)
				}
			}

			let lst = []
			if (Array.isArray(arg.nativetracks)) {
				for (const nt of arg.nativetracks) {
					if (typeof nt == 'string') {
						// string for track name
						const t2 = tklookup.get(nt.toLowerCase())
						if (t2) {
							lst.push(t2)
						}
					} else {
						// object with custom settings
						if (!nt.name) continue
						if (typeof nt.name != 'string') continue
						const t2 = tklookup.get(nt.name.toLowerCase())
						if (t2) {
							// remember custom setting in registry object
							for (const k in nt) {
								if (k == 'name') continue
								t2[k] = nt[k]
							}
							lst.push(t2)
						}
					}
				}
			} else if (typeof arg.nativetracks == 'string') {
				for (const n of arg.nativetracks.split(',')) {
					const t = tklookup.get(n.toLowerCase())
					if (t) {
						lst.push(t)
					}
				}
			} else {
				this.error('invalid value for nativetracks')
			}

			for (const t of lst) {
				// since arg.tklst[] may contain native track (gene), must check
				if (!client.tkexists(t, this.tklst)) {
					this.block_addtk_template(t)
				}
			}
		}

		/* quick fix: 
		when there are bam tracks, these tracks usually are taller than a screen
		making it hard to compare to gene tracks lying on the bottom
		move the native gene track to the top
		usually that is the only bedj track in the list
		*/
		if (this.tklst.find(i => i.type == client.tkt.bam)) {
			const bedtkidx = this.tklst.findIndex(i => i.type == client.tkt.bedj)
			if (bedtkidx != -1) {
				const t = this.tklst[bedtkidx]
				this.tklst.splice(bedtkidx, 1)
				this.tklst.unshift(t)
			}
		}

		this.tk_load_all()

		if (arg.mset) {
			// not in use
			// precompiled sets of mutations
			for (const set of arg.mset) {
				const ds = {
					iscustom: true,
					mlst: set.mlst,
					label: set.name
				}
				this.ownds[set.name] = ds
				const tk = this.block_addtk_template({
					type: client.tkt.ds,
					ds: ds
				})
				blockds.dstkload(tk, this)
			}
		}

		/*** old official datasets ***/
		if (arg.datasetlst) {
			for (const n of arg.datasetlst) {
				let ds = null
				for (const a in this.genome.datasets) {
					if (a.toUpperCase() == n.toUpperCase()) {
						ds = this.genome.datasets[a]
						break
					}
				}
				if (!ds) {
					this.error('Invalid dataset to load: ' + n)
					continue
				}
				if (ds.isMds3) {
					// extends the old "dataset" parameter to support mds3
					const tk = this.block_addtk_template({ type: client.tkt.mds3, dslabel: n })
					this.tk_load(tk)
					continue
				}
				const tk = this.block_addtk_template({ type: client.tkt.ds, ds })
				if (arg.hlaachange) {
					tk.hlaachange = arg.hlaachange
				}
				if (arg.hlvariants) {
					tk.hlvariants = arg.hlvariants
				}
				tk.legacyDsFilter = arg.legacyDsFilter // quick fix
				blockds.dstkload(tk, this)
			}
		}

		/*** new mds datasets ***/

		let hasMdsDatasets = false

		if (arg.datasetqueries) {
			if (!Array.isArray(arg.datasetqueries)) {
				this.error('datasetqueries should be array')
			} else {
				arg.datasetqueries.forEach(q => {
					if (!q.dataset) return this.error('datasetqueries error: .dataset missing from a query')
					if (!q.querykey) return this.error('datasetqueries error: .querykey missing from a query')
					const ds = this.genome.datasets[q.dataset]
					if (!ds) return this.error('invalid dataset name: ' + q.dataset)
					if (!ds.isMds) return this.error('query not supported in dataset: ' + q.dataset)
					this.mds_load_query_bykey(ds, q)

					hasMdsDatasets = true
				})
			}
		}

		// help set block.busy off when there is no track to load
		this.ifbusy()

		if (this.tklst.length == 0 && !hasMdsDatasets) {
			/* show this error when there's no tracks to be loaded
			since the client-side dataset are async loaded, things from datasetqueries
			is not awaited (cannot do in Construtor)
			thus the mds track obj will not be added to this.tklst
			causing the empty tklst array
			*/
			this.error(
				'No tracks specified. If you don\'t expect to see this, delete the "block:true" from runproteinpaint() argument.'
			)
		}
	}
	/****** end of constructor ***/

	async make_legend_img(arg, div) {
		/*
		add a legend showing a server-side image, either for a track or for this block
		arg: {}
		.file: tp path to an image file
		.height: optional icon height
		*/
		const data = await dofetch3('img?file=' + arg.file)
		if (data.error) {
			div.text(data.error)
			return
		}
		let fold = true
		const img = div.append('img').attr('class', 'sja_clbb').attr('src', data.src).style('height', '80px')
		img.on('click', () => {
			if (fold) {
				fold = false
				img.transition().style('height', arg.height ? arg.height + 'px' : 'auto')
			} else {
				fold = true
				img.transition().style('height', '80px')
			}
		})
	}

	regioncumlen(ridx, notincludethisregion) {
		// region bp length up to the view start of a given region
		let c = 0
		if (!notincludethisregion) {
			const r = this.rglst[ridx]
			c = r.reverse ? r.bstop - r.stop : r.start - r.bstart
		}
		for (let i = 0; i < ridx; i++) {
			const r = this.rglst[i]
			// FIXME include/exclude regulatory region?
			/*
		if(this.usegm && r.chr!=this.usegm.chr) {
			continue
		}
		*/
			c += r.bstop - r.bstart
		}
		return c
	}

	blocksetw() {
		// call when any of the width has been udpated

		const width =
			this.leftheadw +
			this.lpad +
			this.width +
			this.subpanels.reduce((i, j) => i + j.width + j.leftpad, 0) +
			this.rpad +
			this.rightheadw

		this.svg.attr('width', width)

		this.coord.gcoordsubpanels.transition().attr('transform', 'translate(' + this.width + ',0)')
		let x = 0
		for (const p of this.subpanels) {
			// coord ruler of each sub panel
			p.coord.g0.transition().attr('transform', 'translate(' + (x + p.leftpad) + ',0)') // shift the immobile ruler holder to correct position
			x += p.leftpad + p.width
			p.coord.grab.attr('width', p.width)
			p.subpanelbgrect.attr('width', p.width)
		}

		for (const t of this.tklst) {
			if (t.hidden) continue
			// re position subpanel group holder for each track
			t.gtksubpanels.transition().attr('transform', 'translate(' + (this.leftheadw + this.lpad + this.width) + ',0)')

			// reposition each subpanel
			let x = 0
			for (const p of t.subpanels) {
				p.gtksubpanel.transition().attr('transform', 'translate(' + (x + p.leftpad) + ',0)')
				x += p.leftpad + p.width
			}

			// re position g right
			t.gright.transition().attr('transform', 'translate(' + (width - this.rightheadw) + ',0)')
		}

		if (this.resizewidthbutton) {
			// re position of drag-resize button
			this.resizewidthbutton.style('right', this.rpad + this.rightheadw + 'px')
		}
	}

	/******* __ruler ****/

	updateruler() {
		/*
	call this when main block view range changes
	works for genomic mode and gm modes

	on the block it's called coord not ruler
	*/

		this.coord.g.attr('transform', 'translate(0,0)')
		this.coord.grab.attr('width', this.width)
		this.blocksetw()

		if (this.coord.input && this.startidx == this.stopidx) {
			// view range is inside single region
			const r = this.rglst[this.startidx]
			// must show 1-based coord in <input>. this will allow to show exactly what user types in e.g. chr1:10000-20000 rather than 9999-19999
			this.coord.input.property('value', `${r.chr}:${r.start + 1}-${r.stop + 1}`)
			this.coordwidthsays.text(common.bplen(r.stop - r.start))
		}

		// reset view start/stop
		for (let i = this.startidx; i <= this.stopidx; i++) {
			const r = this.rglst[i]
			if (i != this.startidx) {
				if (r.reverse) {
					r.stop = r.bstop
				} else {
					r.start = r.bstart
				}
			}
			if (i != this.stopidx) {
				if (r.reverse) {
					r.start = r.bstart
				} else {
					r.stop = r.bstop
				}
			}
		}

		/*
	reset .exonsf, pixel per bp
	exonlen will be used later
	*/
		let exonlen = 0
		for (let i = this.startidx; i <= this.stopidx; i++) {
			exonlen += this.rglst[i].stop - this.rglst[i].start
		}
		this.exonsf = (this.width - this.regionspace * (this.stopidx - this.startidx)) / exonlen

		// reset px width for regions in view range
		for (let i = this.startidx; i <= this.stopidx; i++) {
			const r = this.rglst[i]
			r.width = (r.stop - r.start) * this.exonsf
		}

		this.update_ruler_height()

		this.coord.grab.attr('height', this.coord.height)
		this.coord.axesg.selectAll('*').remove()

		if (!this.gmmode || this.gmmode == client.gmmode.genomic) {
			/*
		in genomic mode
		*/
			{
				const __g = this.coord.axesg.append('g').attr('transform', 'translate(0,0)')
				this.region_makeruler(__g)
			}
			for (let i = this.startidx; i <= this.stopidx; i++) {
				let x = 0
				for (let j = this.startidx; j < i; j++) {
					x += this.rglst[j].width + this.regionspace
				}
				const r = this.rglst[i]

				if (r.stop - r.start <= r.width) {
					if (this.usegm && this.gmmode != client.gmmode.genomic) {
						// wont show sequence
						continue
					}
					const __g = this.coord.axesg.append('g').attr('transform', 'translate(' + x + ',' + this.coordyp2 + ')')
					this.getntsequence4ruler(r, __g)
				}
			}
		} else {
			/*
		not in genomic mode
		still a single ruler but for diferent coordinate (rna/protein)
		*/
			if (this.gmmode == client.gmmode.exononly || this.gmmode == client.gmmode.protein) {
				/*
			continuous scale
			*/
				const rna = this.gmmode == client.gmmode.exononly
				if (!this.hidegenecontrol) {
					this.coord.name.text(rna ? 'RNA bp len' : 'Protein length')
				}
				let r = this.rglst[this.startidx]
				const exoncumbp = this.regioncumlen(this.startidx)
				const scale = scaleLinear()
					.domain(
						rna
							? [exoncumbp, exoncumbp + exonlen]
							: [Math.floor(exoncumbp / 3) + 1, Math.floor((exoncumbp + exonlen) / 3) + 1]
					)
					.range([0, this.width])
				const axis = axisTop().scale(scale).tickFormat(d3format('d'))
				const __g = this.coord.axesg.append('g').attr('transform', 'translate(0,0)')
				axisstyle({
					axis: __g.call(axis),
					color: 'black',
					showline: true
				})
			} else {
				/*
			joined segments
			*/
				const domain = [],
					range = []
				let tickformat
				if (this.gmmode == client.gmmode.splicingrna) {
					if (!this.hidegenecontrol) {
						this.coord.name.text('RNA bp len')
					}
					let exonbp = this.regioncumlen(this.startidx)
					let x = 0
					for (let i = this.startidx; i <= this.stopidx; i++) {
						const r = this.rglst[i]
						domain.push(exonbp)
						range.push(x)
						exonbp += r.stop - r.start
						domain.push(exonbp)
						range.push(x + r.width)
						x += r.width + this.regionspace
					}
					tickformat = d3format(',d')
				} else if (this.gmmode == client.gmmode.gmsum) {
					if (!this.hidegenecontrol) {
						this.coord.name.text('Genomic')
					}
					let x = 0
					for (let i = this.startidx; i <= this.stopidx; i++) {
						const r = this.rglst[i]
						domain.push(r.reverse ? r.stop : r.start)
						range.push(x)
						domain.push(r.reverse ? r.start : r.stop)
						range.push(x + r.width)
						x += r.width + this.regionspace
					}
					tickformat = d3format(',d')
				} else {
					this.error('unknown gmmode for making single ruler: ' + this.gmmode)
					return
				}
				const scale = scaleLinear().domain(domain).range(range)
				const axis = axisTop().scale(scale).tickFormat(tickformat)
				const __g = this.coord.axesg.append('g').attr('transform', 'translate(0,0)')
				axisstyle({
					axis: __g.call(axis),
					color: 'black',
					showline: true
				})
			}
		}
		const noout = this.nozoomout()
		this.ctrl.zobutt1.attr('disabled', noout ? 'true' : null)
		this.ctrl.zobutt2.attr('disabled', noout ? 'true' : null)
		this.ctrl.zobutt3.attr('disabled', noout ? 'true' : null)
		this.ctrl.zinbutt.attr('disabled', this.exonsf >= ntpxwidth ? 1 : null)
	}

	update_ruler_height() {
		// set coord.height
		let atbplevel = false // if main block or any sub panel is at bp level
		if (this.gmmode && this.gmmode != client.gmmode.genomic) {
			// showing protein, do not apply bplevel
		} else {
			for (let i = this.startidx; i <= this.stopidx; i++) {
				const r = this.rglst[i]
				if (r.stop - r.start <= r.width) atbplevel = true
			}
		}
		for (const p of this.subpanels) {
			if (p.stop - p.start <= p.width) atbplevel = true
		}

		this.coord.height = this.coordyp1 + this.rulerheight + this.coordyp2 + (atbplevel ? baseheight + 2 : 0)
	}

	async getntsequence4ruler(r, g) {
		r.busy = true // assessed by ifbusy()

		try {
			const data = await dofetch3('ntseq', {
				method: 'POST',
				body: JSON.stringify({
					genome: this.genome.name,
					coord: r.chr + ':' + (r.start + 1) + '-' + r.stop
				})
			})
			g.selectAll('*').remove()
			if (data.error) throw data.error

			const basewidth = r.width / data.seq.length
			// tentative nt font size
			let _fs = Math.min(this.rulerheight, basewidth / client.textlensf)

			if (_fs > 6) {
				// show nt
				for (let i = 0; i < data.seq.length; i++) {
					let nt = data.seq[r.reverse ? data.seq.length - 1 - i : i]
					if (r.reverse) {
						nt = common.basecompliment(nt)
					}
					g.append('text')
						.text(nt)
						.attr('font-family', 'Courier')
						.attr('font-size', _fs)
						.attr('dominant-baseline', 'hanging')
						.attr('x', basewidth * i + basewidth / 2) //+this.exonsf/2
						.attr('text-anchor', 'middle')
				}
			} else {
				// no show nt
				_fs = 0
			}
			for (let i = 0; i < data.seq.length; i++) {
				let nt = data.seq[r.reverse ? data.seq.length - 1 - i : i]
				if (r.reverse) {
					nt = common.basecompliment(nt)
				}
				g.append('rect')
					.attr('x', i * basewidth)
					.attr('y', Math.min(baseheight - 2, _fs))
					.attr('width', basewidth)
					.attr('height', Math.max(2, baseheight - _fs))
					.attr('fill', common.basecolor[nt.toUpperCase()] || basecolorunknown)
			}
		} catch (e) {
			g.append('text').text(e.message || e)
			if (e.stack) console.log(e.stack)
		}
		r.busy = false
		this.ifbusy()
	}

	nozoomout() {
		let noout = false
		const r1 = this.rglst[this.startidx],
			r2 = this.rglst[this.stopidx]
		if (this.startidx == 0 && this.stopidx == this.rglst.length - 1) {
			let r1over = false,
				r2over = false
			const r1 = this.rglst[this.startidx]
			if (r1.reverse ? r1.stop >= r1.bstop : r1.start <= r1.bstart) {
				const r2 = this.rglst[this.stopidx]
				if (r2.reverse ? r2.start <= r2.bstart : r2.stop >= r2.bstop) {
					noout = true
				}
			}
		}
		return noout
	}

	region_makeruler(g) {
		/*
	genomic only!
	assumed that the view range is in one continuous region
	*/

		if (this.usegm && this.gmmode != client.gmmode.genomic) return
		const rulerg = g.append('g')
		if (!this.hidegenecontrol) {
			this.coord.name.text('Genomic')
		}
		// genomic
		// but still can be multi-region so need to render ruler for each region
		// 0-based to 1-based
		const domain = [],
			range = []
		let x = 0
		for (let i = this.startidx; i <= this.stopidx; i++) {
			const r = this.rglst[i]

			if (r.reverse) {
				domain.push(r.stop)
				domain.push(r.start + 1) // this adjustment is needed for showing rulers for reversed and non-reversed regions
			} else {
				domain.push(r.start + 1)
				domain.push(r.stop)
			}

			range.push(x + this.exonsf / 2) // ADJUST shift half nt px width to right

			range.push(x + r.width - this.exonsf / 2) // ADJUST shift half nt px width to left: critical for ruler to appear good when in bp resolution

			x += r.width + this.exonsf / 2
		}

		// measure coordinate text width to decide how many ticks to use
		let maxticknumber
		{
			const pos = Math.max(this.rglst[this.startidx].stop, this.rglst[this.stopidx].stop)
			const t = rulerg
				.append('text')
				.text(pos > 1000000 ? d3format('s')(pos) : d3format(',d')(pos))
				.attr('font-size', this.rulerfontsize)
			maxticknumber = Math.floor(this.width / (t.node().getBBox().width + 60))
			t.remove()
		}

		const r = this.rglst[this.startidx]

		const scale = scaleLinear().domain(domain).range(range)
		const axis = axisTop().scale(scale).tickSize(this.rulerticksize).ticks(maxticknumber)

		if (r.stop - r.start > 1000000) {
			axis.tickFormat(d3format('s'))
		} else {
			axis.tickFormat(d3format(',d'))
		}
		axisstyle({
			axis: rulerg.call(axis),
			color: 'black',
			showline: true,
			fontsize: this.rulerfontsize
		})
	}

	rulermousedown(event, panel) {
		/*
	pane is either block, or a sub panel, will operate zoom-in on it
	*/

		return new Promise((resolve, reject) => {
			if (panel.busy) reject('busy')

			panel.busy = true
			panel.pannedpx = undefined
			panel.resized = false

			const size = 1

			const istoofine = w => {
				return w / panel.exonsf < panel.width / ntpxwidth
			}
			const color = istoofine(size) ? '#ccc' : '#ff6633'
			const body = d3select(document.body)

			const svg = body
				.append('svg')
				.style('display', 'block')
				.style('position', 'absolute')
				.style('z-index', rulergrabzindex)
			const rect = svg.append('rect').attr('fill', color).attr('fill-opacity', 0.2).attr('stroke', color)
			const text0 = svg
				.append('text')
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'central')
				.attr('font-size', '18px')
				.attr('fill', 'none')
				.attr('stroke', 'white')
				.attr('stroke-width', 3)
			const text = svg
				.append('text')
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'central')
				.attr('font-size', 18)
				.attr('fill', 'black')

			const printwidth = w => {
				if (w <= 0) {
					text.text('')
					text0.text('')
					return
				}
				const bpc = Math.ceil(w / panel.exonsf)
				const t = d3format('.2s')(panel.gmmode == client.gmmode.protein ? Math.ceil(bpc / 3) : bpc)
				text0.text(t)
				text.text(t)
			}

			// not rotated
			let xleft, ytop, blockheight, x0
			// rotated
			let r_xleft, r_ytop, y0

			if (panel.rotated) {
				const tmp = panel.coord.g0.node().getBoundingClientRect()
				r_xleft = tmp.left
				r_ytop = event.target.getBoundingClientRect().top
				blockheight = this.totalheight()
				y0 = event.clientY
			} else {
				xleft = event.target.getBoundingClientRect().left
				const tmp = panel.coord.g0.node().getBoundingClientRect()
				ytop = tmp.top
				blockheight = this.totalheight()
				x0 = event.clientX
			}

			if (panel.rotated) {
				svg
					.attr('width', blockheight)
					.attr('height', size)
					.style('left', window.pageXOffset + r_xleft + 'px')
					.style('top', window.pageYOffset + y0 + 'px')
				rect.attr('width', blockheight).attr('height', size)
				text0.attr('y', 0).attr('x', blockheight / 2)
				text.attr('y', 0).attr('x', blockheight / 2)
			} else {
				svg
					.attr('width', size)
					.attr('height', blockheight)
					.style('left', window.pageXOffset + x0 + 'px')
					.style('top', window.pageYOffset + ytop + 'px')
				rect.attr('width', size).attr('height', blockheight)
				text0.attr('x', 0).attr('y', blockheight / 2)
				text.attr('x', 0).attr('y', blockheight / 2)
			}

			body
				.on('mousemove', event => {
					event.preventDefault()
					if (panel.rotated) {
						const my = event.clientY
						let h = 0
						if (my > y0) {
							h = size + Math.min(r_ytop + panel.width, my) - y0
						} else if (my < y0) {
							h = size + y0 - Math.max(r_ytop, my)
							svg.style('top', window.pageYOffset + y0 + Math.max(r_ytop, my) - y0 + 'px')
						}
						svg.attr('height', h)
						rect.attr('height', h)
						const color = istoofine(h) ? '#ccc' : '#ff6633'
						text0.attr('y', h / 2)
						text.attr('y', h / 2)
						rect.attr('fill', color).attr('stroke', color)
						printwidth(h)
					} else {
						const mx = event.clientX
						let w = 0
						if (mx > x0) {
							w = size + Math.min(xleft + panel.width, mx) - x0
						} else if (mx < x0) {
							w = size + x0 - Math.max(xleft, mx)
							svg.style('left', window.pageXOffset + x0 + Math.max(xleft, mx) - x0 + 'px')
						}
						svg.attr('width', w)
						rect.attr('width', w)
						const color = istoofine(w) ? '#ccc' : '#ff6633'
						text0.attr('x', w / 2)
						text.attr('x', w / 2)
						rect.attr('fill', color).attr('stroke', color)
						printwidth(w)
					}
				})
				.on('mouseup', () => {
					let startpx, // start and span in pixel, over the region to zoom into
						spanpx

					if (panel.rotated) {
						const h = Number.parseInt(svg.attr('height'))
						/*
				two ways of rotation
				nose point up or down
				for the moment it's pointing down only
				FIXME to support pointing up
				*/
						startpx = panel.width - (h + Number.parseInt(svg.style('top')) - r_ytop - window.pageYOffset)
						spanpx = h
					} else {
						spanpx = Number.parseInt(svg.attr('width'))
						startpx = Number.parseInt(svg.style('left')) - xleft - window.pageXOffset
					}
					svg.remove()
					body.on('mousemove', null).on('mouseup', null)

					resolve([istoofine(spanpx), startpx, spanpx])
				})
		})
	}

	/******* __ruler ends ****/

	highlight_1basedcoordinate(s) {
		const l = s.split(/[:-]/)
		if (l.length != 3) return
		const start = Number.parseInt(l[1])
		const stop = Number.parseInt(l[2])
		if (Number.isNaN(start) || Number.isNaN(stop)) {
			return
		}
		this.addhlregion(l[0], start - 1, stop - 1)
	}

	addhlregion(chr, start, stop, color) {
		const t1 = this.seekcoord(chr, start)[0]
		if (!t1) {
			return
		}
		const t2 = this.seekcoord(chr, stop)[0]
		if (!t2) {
			return
		}

		let x1, x2

		if (t1.x > t2.x) {
			// region is reverse!!
			x1 = t2.x - this.exonsf / 2
			x2 = t1.x + this.exonsf / 2
		} else {
			// region is not reverse
			x1 = t1.x - this.exonsf / 2
			x2 = t2.x + this.exonsf / 2
		}

		const hl = {
			chr: chr,
			start: start,
			stop: stop,
			x: x1,
			color: color || hlregioncolor,
			rect: this.hlregion.g
				.append('rect')
				.attr('x', x1)
				.attr('y', 0)
				.attr('width', x2 - x1)
				.attr('fill', color || hlregioncolor)
		}
		this.hlregion.lst.push(hl)
		this.block_setheight()
	}

	/*
reverseorient() {
	this.coord.reverse=!this.coord.reverse
	this.ctrl.revbutt.html(this.coord.reverse ? 'Reverse &laquo;' : 'Forward &raquo;')
	this.block_coord_updated(false)
}
*/

	pxoff2region(px) {
		// genomic
		let ridx = this.startidx
		let r = this.rglst[ridx]
		if (px == 0) return [ridx, r.reverse ? r.stop : r.start]
		// starts from .startidx/begin
		const px0 = px
		if (px > 0) {
			// to right
			while (1) {
				if (ridx >= this.rglst.length) {
					//this.error('right seek error: '+px0)
					const r = this.rglst[this.rglst.length - 1]
					return [this.rglst.length - 1, r.reverse ? r.bstart : r.bstop]
				}
				const r = this.rglst[ridx]
				let availablepx
				if (r.reverse) {
					const lookstart = ridx >= this.startidx && ridx <= this.stopidx ? r.stop : r.bstop
					availablepx = (lookstart - r.bstart) * this.exonsf
					if (availablepx + this.regionspace >= px) {
						return [ridx, lookstart - Math.floor(px / this.exonsf)]
					}
				} else {
					const lookstart = ridx >= this.startidx && ridx <= this.stopidx ? r.start : r.bstart
					availablepx = (r.bstop - lookstart) * this.exonsf
					if (availablepx + this.regionspace >= px) {
						return [ridx, lookstart + Math.floor(px / this.exonsf)]
					}
				}
				px -= availablepx + this.regionspace
				ridx++
			}
		}
		// to left
		px = -px
		// first, chew .startidx
		r = this.rglst[this.startidx]
		if (r.reverse) {
			const availablepx = (r.bstop - r.stop) * this.exonsf
			if (availablepx + this.regionspace >= px) {
				return [ridx, r.stop + Math.floor(px / this.exonsf)]
			}
		} else {
			const availablepx = (r.start - r.bstart) * this.exonsf
			if (availablepx + this.regionspace >= px) {
				return [ridx, r.start - Math.floor(px / this.exonsf)]
			}
		}
		// keep chewing
		ridx--
		while (1) {
			if (ridx < 0) {
				//this.error('left seek error: '+px0)
				const r = this.rglst[0]
				return [0, r.reverse ? r.bstop : r.bstart]
			}
			const r = this.rglst[ridx]
			const availablepx = (r.bstop - r.bstart) * this.exonsf
			if (availablepx + this.regionspace >= px) {
				if (r.reverse) return [ridx, r.bstart + Math.floor(px / this.exonsf)]
				return [ridx, r.bstop - Math.floor(px / this.exonsf)]
			}
			px -= availablepx + this.regionspace
			ridx--
		}
	}

	zoomblock(fold, zoomout) {
		if (this.busy) return
		this.pannedpx = undefined
		this.resized = false
		let px1, px2
		if (zoomout) {
			this.zoomedin = false
			const span = Math.floor((this.width * (fold - 1)) / 2)
			px1 = -span
			px2 = this.width + span
		} else {
			this.zoomedin = true
			const span = Math.max((this.width / ntpxwidth) * this.exonsf, this.width / fold)
			px1 = Math.floor(this.width / 2 - span / 2)
			px2 = Math.floor(this.width / 2 + span / 2)
		}
		this.zoom2px(px1, px2)
	}

	zoom2px(px1, px2) {
		const [startidx, startpos] = this.pxoff2region(px1)
		const [stopidx, stoppos] = this.pxoff2region(px2)
		this.startidx = startidx
		this.stopidx = stopidx
		const r1 = this.rglst[startidx]
		if (r1.reverse) {
			r1.stop = startpos
		} else {
			r1.start = startpos
		}
		const r2 = this.rglst[stopidx]
		if (r2.reverse) {
			r2.start = stoppos
		} else {
			r2.stop = stoppos
		}
		this.block_coord_updated()
	}

	block_coord_updated(panned) {
		this.busy = true
		this.updateruler()
		this.tk_load_all()
		if (this.tklst.length == 0) {
			this.busy = false
		}

		// reposition hl regions
		let blockh = this.coord.height
		for (const t of this.tklst) {
			if (t.hidden) continue
			blockh += t.height
		}

		for (const hl of this.hlregion.lst) {
			const hit1 = this.seekcoord(hl.chr, hl.start)[0]
			const hit2 = this.seekcoord(hl.chr, hl.stop)[0]
			if (!hit1 || !hit2) {
				hl.rect.attr('width', 0)
				continue
			}
			const startx = Math.min(hit1.x, hit2.x) - this.exonsf / 2
			const stopx = Math.max(hit1.x, hit2.x) + this.exonsf / 2
			if (startx >= this.width || stopx <= 0) {
				hl.rect.attr('width', 0)
				continue
			}
			hl.x = startx
			hl.rect
				.attr('x', Math.max(0, startx))
				.attr('width', Math.max(2, Math.min(this.width, stopx) - Math.max(0, startx)))
				.attr('height', blockh)
		}
		if (this.onCoordinateChange) {
			this.onCoordinateChange(this.rglst)
		}
	}

	async jump_1basedcoordinate(s) {
		/*
	if input is coord string, should be 1-based!!
	also supports gene name and rsname
	*/
		if (this.busy) return
		this.zoomedin = false
		this.pannedpx = undefined
		this.resized = false

		if (typeof s == 'string') {
			const pos = coord.string2pos(s, this.genome)
			if (pos) {
				this.rglst = [
					{
						chr: pos.chr,
						bstart: 0,
						bstop: pos.chrlen,
						start: Math.max(0, pos.start - 1),
						stop: pos.stop - 1,
						reverse: this.showreverse
					}
				]

				if (pos.actualposition && pos.actualposition.len <= 40) {
					this.addhlregion(
						pos.chr,
						pos.actualposition.position - 1,
						pos.actualposition.position - 1 + pos.actualposition.len - 1
					)
				}

				this.startidx = this.stopidx = 0
				this.block_coord_updated()
				return
			}
		} else if (typeof s == 'object' && s.chr && Number.isInteger(s.start)) {
			// quick fix to avoid calling string2pos and zoom out to 400bp
			const _chr = this.genome.chrlookup[s.chr.toUpperCase()]
			if (_chr) {
				let start = s.start,
					stop = Number.isInteger(s.stop) ? s.stop : s.start
				const actualstart = start,
					actualstop = stop
				const minspan = Math.ceil(this.width / ntpxwidth) //200
				if (stop - start < minspan) {
					const h = Math.ceil(minspan / 2)
					const m = Math.floor((start + stop) / 2)
					start = m - h
					stop = m + h
				}
				this.rglst = [
					{
						chr: _chr.name,
						bstart: 0,
						bstop: _chr.len,
						start: start - 1,
						stop: stop - 1,
						reverse: this.showreverse
					}
				]
				this.startidx = this.stopidx = 0
				if (actualstop - actualstart < 40) {
					this.addhlregion(s.chr, actualstart - 1, actualstop - 1)
				}
				this.block_coord_updated()
				return
			} else {
				this.error('Invalid chr: ' + s.chr)
				return
			}
		}
		// try
		await this.block_jump_gene(s)
	}

	async block_jump_gene(s) {
		try {
			const data = await dofetch3('genelookup', {
				body: { genome: this.genome.name, input: s, deep: 1 }
			})
			if (data.error) throw data.error
			if (!data.gmlst || data.gmlst.length == 0) {
				// no gene match
				if (this.genome.hasSNP) {
					if (s.toLowerCase().startsWith('rs')) {
						// looks like a snp
						this.block_jump_snp(s)
					} else {
						this.inputerr('Not a gene or SNP: ' + s)
					}
				} else {
					this.inputerr('Unknown gene name: ' + s)
				}
				return
			}
			// "s" matches with a gene name

			// quick fix: update valid gene name to pgv
			for (const t of this.tklst) {
				if (t.type == client.tkt.pgv) {
					t.genename = s
				}
			}

			// aggregate loci for all isoforms from data.gmlst[]
			const locs = client.gmlst2loci(data.gmlst)

			if (locs.length == 1) {
				// all isoforms are on the same locus
				const r = locs[0]
				const e = coord.invalidcoord(this.genome, r.chr, r.start, r.stop)
				if (e) {
					this.inputerr('this should not happen: gene error: ' + e)
					return
				}
				this.rglst = [
					{
						chr: r.chr,
						bstart: 0,
						bstop: this.genome.chrlookup[r.chr.toUpperCase()].len,
						start: r.start,
						stop: r.stop,
						reverse: this.showreverse
					}
				]
				this.startidx = this.stopidx = 0
				this.block_coord_updated()
				return
			}

			// isoforms are spread out on multiple locations
			this.coord.inputtipshow()
			for (const r of locs) {
				this.coord.inputtip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(r.name + ' ' + r.chr + ':' + r.start + '-' + r.stop)
					.on('click', () => {
						this.coord.inputtip.hide()
						this.rglst = [
							{
								chr: r.chr,
								bstart: 0,
								bstop: this.genome.chrlookup[r.chr.toUpperCase()].len,
								start: r.start,
								stop: r.stop,
								reverse: this.showreverse
							}
						]
						this.startidx = this.stopidx = 0
						this.block_coord_updated()
					})
			}
		} catch (e) {
			this.inputerr(e.message || e)
		}
	}

	block_jump_snp(s) {
		string2snp(this.genome, s)
			.then(r => {
				const span = Math.ceil(this.width / ntpxwidth)
				this.rglst = [
					{
						chr: r.chr,
						bstart: 0,
						bstop: this.genome.chrlookup[r.chr.toUpperCase()].len,
						start: Math.max(0, r.start - Math.ceil(span / 2)),
						stop: r.start + span,
						reverse: this.showreverse
					}
				]
				this.startidx = this.stopidx = 0
				this.addhlregion(r.chr, r.start, r.stop - 1)
				this.block_coord_updated()
			})
			.catch(err => {
				this.inputerr(s + ': not a gene or SNP')
				if (err.stack) console.log(err.stack)
			})
	}

	inputerr(msg) {
		this.coord.inputtipshow()
		this.coord.inputtip.d
			.append('div')
			// must not do .html(), msg is user-provided
			.text(msg)
			.style('border', 'solid 1px red')
			.style('padding', '10px 20px')
	}

	genemenu() {
		for (const tk of this.tklst) {
			if (tk.type == client.tkt.usegm) {
				if (tk.controller) {
					// hide gmtk controller
					tk.controller.paneoff()
				}
				break
			}
		}
		const gm = this.usegm
		if (!gm) {
			console.log('usegm missing!!')
			return
		}
		this.usegmtip.clear()
		const menu = this.usegmtip.d
		// header
		const sec1 = menu
			.append('div')
			.style('padding', '20px')
			.style('background-color', '#E6EEF5')
			.style('margin-bottom', '20px')

		const description_div = sec1.append('div').style('width', '580px')
		if (!gm.description) {
			description_div.html(`${gm.name}: No description`)
		} else if (gm.description.length >= 120) {
			// Detect when the description is very long
			const truncDescrip = gm.description.substring(0, 100)
			let activeDesc = false
			description_div.html(`${gm.name}: <strong>${truncDescrip}</strong> ...`)
			const a = sec1.append('a')
			a.text('Show More')
				// Add simple a tag. Should show and hide text on click
				.style('display', 'inline-block')
				.on('click', () => {
					activeDesc = !activeDesc
					description_div.html(
						activeDesc == true
							? `${gm.name}: <strong>${gm.description}</strong>`
							: `${gm.name}: <strong>${truncDescrip}</strong> ...`
					)
					a.text(activeDesc == true ? 'Hide' : 'Show More')
				})
		} else {
			description_div.html(`${gm.name}: <strong>${gm.description}</strong>`)
		}

		const p2 = sec1.append('div').style('margin-top', '10px')

		p2.append('span').text(gm.isoform).style('padding-right', '10px')

		p2.append('a')
			.attr('target', '_blank')
			.attr('href', 'https://www.ncbi.nlm.nih.gov/gene/?term=' + gm.isoform)
			.style('padding-right', '10px')
			.text('NCBI')

		p2.append('a')
			.attr('target', '_blank')
			.attr('href', 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=' + this.genome.name + '&position=' + gm.isoform)
			.text('UCSC')

		p2.append('span')
			.style('padding-left', '30px')
			.html(
				gm.chr +
					':' +
					(gm.start + 1) +
					'-' +
					gm.stop +
					'&nbsp;&nbsp;<span style="font-size:.7em">' +
					(gm.strand == '+' ? 'FORWARD' : 'REVERSE') +
					'</span>' +
					'&nbsp;&nbsp;<span style="color:#555">' +
					common.bplen(gm.stop - gm.start) +
					'</span>'
			)
		const sec2 = menu.append('div').style('margin', '20px 30px 40px 30px')
		sec2
			.append('div')
			.text('Switch display')
			.style('font-size', '1.5em')
			.style('color', '#555')
			.style('margin-bottom', '20px')
		this.showgmmode4switch(sec2, true)
		// sec 3
		if (this.allgm.length > 1) {
			const sec3 = menu
				.append('div')
				//.style('background-color','#F5F5F0')
				.style('padding', '20px 30px 40px 30px')
			sec3
				.append('div')
				.style('color', '#555')
				.style('font-size', '1.5em')
				.style('margin-bottom', '20px')
				.text('Switch isoform')
			this.showisoform4switch(sec3, true)
		}
		this.usegmtip.showunder(this.ctrl.namebutt.node())
	}

	old_dshandle_new(dsname) {
		// for old official dataset, and mds3
		// won't add handle for either children or custom datasets
		let ds = this.genome.datasets[dsname]
		if (!ds) {
			ds = this.ownds[dsname]
		}
		if (!ds) {
			this.error('unknown dsname ' + dsname)
			return
		}
		const box = this.ctrl.dshandleholder.append('div').attr('class', 'sjpp-dshandleholder')
		const says = box
			.append('div')
			.attr('class', 'sja_opaque8 sjpp-dslabel')
			.text(ds.label)
			.on('click', async () => {
				this.pannedpx = undefined // important!
				this.resized = false
				let tk = this.tklst.find(t => {
					if (ds.isMds3) {
						if (t.type == client.tkt.mds3 && t.mds && t.mds.label == ds.label) return t
					} else if (t.type == client.tkt.ds && t.ds && t.ds.label == ds.label) {
						return t
					}
				})
				if (tk) {
					if (tk.hidden) {
						tk.hidden = false
						this.tk_load(tk)
						//says.style('background-color','#ddd').style('color','black')
						this.setllabel() // must do it here, not called in tk_load
					} else {
						this.tk_hide(tk)
						//says.style('background-color','#999').style('color','white')
					}
					this.tkchangeaffectlegend(tk)
					return
				}
				if (ds.busy) return
				if (ds.isMds3) {
					tk = this.block_addtk_template({ type: client.tkt.mds3, dslabel: ds.label })
					this.tk_load(tk)
					return
				}

				// is legacy ds
				if (ds.legacyDsIsUninitiated) {
					/* only for legacy ds
					can delete this step when migrated to mds3
					*/
					const d = await dofetch3(`getDataset?genome=${this.genome.name}&dsname=${ds.label}`)
					if (d.error) throw 'invalid name'
					if (!d.ds) throw '.ds missing'

					Object.assign(ds, d.ds)
					const _ = await import('./legacyDataset')
					_.validate_oldds(ds)

					delete ds.legacyDsIsUninitiated
				}

				tk = this.block_addtk_template({ ds, type: client.tkt.ds })
				blockds.dstkload(tk, this)
			})
			.on('mouseover', event => {
				if (ds.iscustom) {
					return
				}
				if (!ds.dsinfo) {
					return
				}
				this.blocktip
					.showunder(event.target)
					.clear()
					.d.append('div')
					.style('font-size', '80%')
					.style('padding', '10px')
					.style('color', '#858585')
					.attr('class', 'sja_clb')
					.text('ABOUT')
					.on('click', () => {
						this.blocktip.clear()
						client.make_table_2col(this.blocktip.d, ds.dsinfo).style('padding', '10px')
					})
			})
		this.ds2handle[dsname] = {
			handle: box,
			handlesays: says
		}
	}

	viewrangeabovelimit(span) {
		if (span == undefined) {
			// no upper limit was set
			return false
		}
		let len = 0
		for (let i = this.startidx; i <= this.stopidx; i++) {
			const r = this.rglst[i]
			len += r.stop - r.start
		}
		return len >= span
	}

	seekcoord(chr, pos) {
		/*
	return px offset relative to view range start!!!
	also look at subpanels

	find all hits
	*/

		pos += 0.5 // +.5 important!!!

		const hits = []
		const overgene = this.usegm && chr == this.usegm.chr && this.gmmode != client.gmmode.genomic

		for (let i = 0; i < this.rglst.length; i++) {
			const r = this.rglst[i]
			if (r.chr != chr) continue
			if (pos >= r.bstart && pos < r.bstop) {
				// inside region
				hits.push({
					ridx: i,
					x:
						(this.regioncumlen(i, true) + (r.reverse ? r.bstop - pos : pos - r.bstart)) * this.exonsf +
						i * this.regionspace
				})
				break
			} else if (i > 0 && overgene) {
				// assuming that intron is always between regions
				const r0 = this.rglst[i - 1]
				if (r0.chr != chr) continue
				// TODO need a way to exclude regulatory regions
				// assuming the same orientation of all exons
				if (r.reverse) {
					if (pos < r0.bstart && pos >= r.bstop) {
						hits.push({
							ridx: i,
							x: this.regioncumlen(i, true) * this.exonsf + i * this.regionspace - this.regionspace / 2
						})
						break
					}
				} else {
					if (pos < r.bstart && pos >= r0.bstop) {
						hits.push({
							ridx: i,
							x: this.regioncumlen(i, true) * this.exonsf + i * this.regionspace - this.regionspace / 2
						})
						break
					}
				}
			}
		}

		if (hits.length == 0 && overgene) {
			// should be out of gene body range
			// cannot use just .usegm, maybe in gmsum
			// find out where gene body start/end in rglst
			let startidx = null,
				stopidx = 0
			for (let i = 0; i < this.rglst.length; i++) {
				// TODO exclude regulatory regions, appended regions
				if (startidx == null) {
					startidx = i
				}
				stopidx = i
			}
			if (startidx == null) {
				console.error('seekcoord: null startidx')
			} else {
				const r1 = this.rglst[startidx]
				const r2 = this.rglst[stopidx]
				if (this.usegm.strand == '+') {
					if (pos < r1.bstart) {
						hits.push({
							ridx: startidx,
							x: this.regioncumlen(startidx, true) * this.exonsf + startidx * this.regionspace
						})
					} else if (pos >= r2.bstop) {
						hits.push({
							ridx: stopidx,
							x: this.exonsf * (this.regioncumlen(stopidx, true) + r2.bstop - r2.bstart) + stopidx * this.regionspace
						})
					} else {
						console.error(chr + ':' + pos + ' not mapped to gene')
					}
				} else {
					if (pos < r2.bstart) {
						hits.push({
							ridx: stopidx,
							x: this.exonsf * (this.regioncumlen(stopidx, true) + r2.bstop - r2.bstart) + stopidx * this.regionspace
						})
					} else if (pos >= r1.bstop) {
						hits.push({
							ridx: startidx,
							x: this.regioncumlen(startidx, true) * this.exonsf + startidx * this.regionspace
						})
					} else {
						console.error(chr + ':' + pos + ' not mapped to gene')
					}
				}
			}
		}
		const reduct = this.regioncumlen(this.startidx) * this.exonsf + this.startidx * this.regionspace
		for (const h of hits) {
			h.x -= reduct
		}

		if (this.subpanels.length) {
			// also search sub panels
			let x = this.width
			for (const [idx, r] of this.subpanels.entries()) {
				x += r.leftpad
				if (chr == r.chr && pos >= r.start && pos <= r.stop) {
					hits.push({
						subpanelidx: idx,
						x: x + r.exonsf * (pos - r.start)
					})
				}
				x += r.width
			}
		}

		return hits
	}

	/*
seekrange(chr,start,stop) {
	// not in use
	let startpx=-1,
		stoppx=-1
	for(let i=this.startidx; i<=this.stopidx; i++) {
		const r=this.rglst[i]
		if(r.chr!=chr) continue
		const start0=Math.max(start,r.start)
		const stop0 =Math.min(stop,r.stop)
		if(start0 < stop0) {
			const bp=this.regioncumlen(i)
			if(startpx==-1) {
				startpx=(bp+(r.reverse ? r.stop-stop0 : start0-r.start))*this.exonsf+i*this.regionspace
			}
			stoppx=(bp+(r.reverse ? r.stop-start0 : stop0-r.start))*this.exonsf+i*this.regionspace
		}
	}
	return [startpx,stoppx]
}
*/

	/** __tk__ **/

	setllabel() {
		// from left labels of all tracks, derive .leftheadw
		// then set width of leftlabshade1/2 of all left labels
		let w = 10
		for (const tk of this.tklst) {
			if (tk.hidden) {
				continue
			}
			w = Math.max(w, 100, tk.leftLabelMaxwidth + 20)
		}
		this.leftheadw = w
		this.hlregion.g.transition().attr('transform', 'translate(' + (this.leftheadw + this.lpad) + ',0)')
		this.coord.g0
			.transition()
			.attr('transform', 'translate(' + (this.leftheadw + this.lpad) + ',' + (this.coordyp1 + this.rulerheight) + ')')

		const entirewidth =
			this.leftheadw + this.lpad + this.width + this.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0) + this.rpad

		for (const tk of this.tklst) {
			tk.gleft.transition().attr('transform', 'translate(' + this.leftheadw + ',0)')
			tk.gmiddle.transition().attr('transform', 'translate(' + (this.leftheadw + this.lpad) + ',0)')
			tk.gright.transition().attr('transform', 'translate(' + entirewidth + ',0)')
		}
		this.blocksetw()
	}

	tk_remove(i) {
		const oldt = this.tklst[i]
		if (oldt.type == client.tkt.ds && oldt.ds && oldt.ds.iscustom) {
			// is a custom dstk, as the child from a official dstk
			delete this.genome.datasets[oldt.ds.label]
			const ds = this.ownds[oldt.ds.label]
			if (ds) {
				// registered in this.ownds{}
				delete this.ownds[ds.label]
				if (ds.parentname) {
					// decrement children count in parent ds handle
					const parenthandle = this.ds2handle[ds.parentname]
					if (parenthandle && parenthandle.childicon) {
						const count = Number.parseInt(parenthandle.childicon.text())
						if (count == 1) {
							parenthandle.childicon.remove()
							delete parenthandle.childicon
						} else {
							parenthandle.childicon.text(count - 1)
						}
					}
				}
			}
		}
		this.tklst[i].g.remove()
		this.tklst.splice(i, 1)
		this.setllabel()
		this.block_setheight()
		if (oldt.type == client.tkt.ds) {
			const dshandle = this.ds2handle[oldt.name]
			if (dshandle) {
				dshandle.handlesays.style('background-color', 'white').style('color', 'black')
			}
			if (oldt.eplst) {
				for (const ep of oldt.eplst) {
					if (ep.handle) {
						ep.handle.remove()
					}
					if (ep.pane) {
						ep.pane.pane.remove()
					}
				}
			}
		}
		if (oldt.tr_legend) {
			disappear(oldt.tr_legend, true)
		}
		if (this.onAddRemoveTk) this.onAddRemoveTk(oldt) // lack of 2nd arg for removing
	}

	deletecustomdsbyname(dsname) {
		// this should not be in genome.datasets
		for (let i = 0; i < this.tklst.length; i++) {
			const t = this.tklst[i]
			if (t.type == client.tkt.ds && t.ds.label == dsname) {
				this.tk_remove(i)
				break
			}
		}
	}

	addchilddsnoload(childds) {
		const paname = childds.parentname
		const parenthandle = this.ds2handle[paname]
		if (parenthandle) {
			const d = parenthandle.childicon
			if (d) {
				d.text(Number.parseInt(d.text()) + 1)
			} else {
				// create new icon
				parenthandle.childicon = parenthandle.handle
					.append('div')
					.style('display', 'inline-block')
					.style('margin-left', '1px')
					.style('padding', '2px 5px')
					.style('background-color', '#ccc')
					.classed('sja_opaque8', true)
					.text(1)
					.on('click', event => {
						const div = this.tip.clear().showunder(event.target).d.append('div').style('padding', '20px')
						div
							.append('div')
							.text('Click to remove')
							.style('font-size', '.9em')
							.style('color', '#858585')
							.style('margin-bottom', '10px')
						for (const tk of this.tklst) {
							if (!tk.ds || tk.ds.parentname != paname) continue
							const row = div.append('div').classed('sja_menuoption', true).text(tk.ds.label)
							row.on('click', () => {
								row.remove()
								this.deletecustomdsbyname(tk.ds.label)
							})
						}
					})
			}
		}
		this.ownds[childds.label] = childds
	}

	block_addtk_template(template) {
		/*
	this: init attributes
	calls: block_maketk() to make dom/svg
	do not load tk yet
	*/
		const tk = {
			height_main: 25,
			height: 30,
			// template.tkid will override
			tkid: Math.random().toString(),
			toppad: 5,
			bottompad: 5,
			yoff: 0,
			axisfontsize: 12,
			busy: false,
			leftLabelMaxwidth: 0,
			rightheadw_tk: this.rightheadw,
			subpanels: [] // to keep in sync with block.subpanels
		}
		for (const k in template) {
			tk[k] = template[k]
		}

		switch (template.type) {
			case client.tkt.bampile:
				bampilefromtemplate(tk, template)
				break
			case client.tkt.ds:
				if (!tk.ds) {
					this.error('dstk template missing .ds')
					return
				}
				if (!tk.ds.label) {
					this.error('dstk template missing .ds.label')
					return
				}
				tk.name = tk.ds.label
				/*
		tell blockds.load2tk to insert it into .tklst and then remove this trigger
		so subsequent data request won't do the .tklst insert
		*/
				tk.dsuninitiated = true
				break
			case client.tkt.pgv:
				const e1 = pgvfromtemplate(tk, template)
				if (e1) {
					this.error(e1)
					return
				}
				break
			case client.tkt.ld:
				const e14 = ldfromtemplate(tk, template)
				if (e14) {
					this.error(e14)
					return
				}
				break
			case client.tkt.bam:
				const e12 = bamfromtemplate(tk, template)
				if (e12) {
					this.error(e12)
					return
				}
				break
			case client.tkt.usegm:
				gmtkfromtemplate(tk)
				break
			case client.tkt.bedj:
				const e2 = bedjfromtemplate(tk, template)
				if (e2) {
					this.error(e2)
				}
				break
			case client.tkt.junction:
				const e3 = junctionfromtemplate(tk, template)
				if (e3) {
					this.error(e3)
					return
				}
				break
			/*
	case client.tkt.ai:
		tk.covermax=tk.readdepthcutoff
		delete tk.readdepthcutoff
		const h=Math.max(60,(document.body.clientHeight-200)/12)
		tk.rowheight=Math.ceil(h)
		tk.barheight=Math.ceil(h/2)
		tk.rowspace=5
		tk.uninit=true
		break
	*/
			case client.tkt.aicheck:
				aicheckfromtemplate(tk, template)
				break
			case client.tkt.bigwig:
				bigwigfromtemplate(tk, template)
				break
			case client.tkt.bigwigstranded:
				bigwigstrandedfromtemplate(tk, template)
				break
			case client.tkt.bam:
				tk.stackheight = tk.stackheight || 10
				tk.barheight = tk.barheight || 80
				tk.fcolor = tk.fcolor || '#005EBD'
				tk.rcolor = tk.rcolor || '#D66B00'
				tk.mmcolor = tk.mmcolor || '#FF3D3D'
				break
			case client.tkt.mdsjunction:
				const e6 = mdsjunctionfromtemplate(tk, template)
				if (e6) {
					this.error(e6)
					return
				}
				break
			case client.tkt.mdssvcnv:
				const e7 = mdssvcnvfromtemplate(tk, template)
				if (e7) {
					this.error(e7)
					return
				}
				break
			case client.tkt.mds3:
				const e13 = mds3_fromtemplate(tk, template)
				if (e13) {
					this.error(e13)
					return
				}
				break
			case client.tkt.bedgraphdot:
				const e11 = bedgraphdot_fromtemplate(tk, template)
				if (e11) {
					this.error(e11)
					return
				}
				break
			case client.tkt.mdsexpressionrank:
				const e8 = mdsexpressionrankfromtemplate(tk, template, this)
				if (e8) {
					this.error(e8)
					return
				}
				break
			case client.tkt.hicstraw:
				const e4 = hicstrawfromtemplate(tk, template)
				if (e4) {
					this.error(e4)
					return
				}
				break
			case client.tkt.ase:
				const e9 = asefromtemplate(tk, template)
				if (e9) {
					this.error(e9)
					return
				}
				break
			default:
				this.error('addtk: unknown template tk type ' + template.type)
		}

		// upon breaking error, quit and do not add this track
		this.tklst.push(tk)

		this.block_maketk(tk)
		this.blocksetw()
		return tk
	}

	block_maketk(tk) {
		// keep separate from addtk()
		// call each time to show a tk in .tklst
		tk.tktip = new Menu({ padding: '15px' })
		tk.tkconfigtip = new Menu({ padding: '15px' })

		tk.g = this.gbase.append('g').attr('data-testid', 'sja_sample_menu_opener').attr('transform', 'translate(0,0)')
		/*
	order of precedence:
	gtksubpanels < gmiddle < gleft and gright
	so that right-open axis in gleft can not be blocked by gmiddle
	*/

		/*
	holder for all subpanels
	must not append to gmiddle, since gmiddle catches mousedown for panning the main panel, and subpanel must pan independently
	*/
		tk.gtksubpanels = tk.g.append('g')

		tk.gmiddle = tk.g.append('g').attr('transform', 'translate(' + (this.leftheadw + this.lpad) + ',0)')

		tk.tkbodybgrect = tk.gmiddle.append('rect').attr('fill', 'white').attr('fill-opacity', 0)

		tk.glider = tk.gmiddle.append('g').attr('transform', 'translate(0,0)').style('cursor', 'default')

		tk.gleft = tk.g.append('g').attr('transform', 'translate(' + this.leftheadw + ',0)')
		tk.gright = tk.g
			.append('g')
			.attr('transform', 'translate(' + (this.leftheadw + this.lpad + this.width + this.rpad) + ',0)')

		tk.tklabel = this.maketklefthandle(tk).attr('class', null).attr('font-weight', 'bold')

		// tk name may be available now or will be defined later
		if (tk.name) {
			// two conditions to show tooltip on hovering the label
			// 1. label truncated, hover to show full label
			// 2. list_description[{k,v}] provided:
			// a.hover to show table of details
			// b. click label to show and leave table of details
			const labeltruncated = tk.name.length >= 25
			if (labeltruncated) {
				// to truncate name and also apply tooltip
				tk.tklabel.text(tk.name.substring(0, 20) + ' ...')
			} else {
				// no need to truncate label
				tk.tklabel.text(tk.name)
			}
			if (labeltruncated || tk.list_description) {
				// will show tooltip to display both info if available

				// detects if tooltip is in use or not
				let tktip_active = false
				tk.tktip.onHide = () => {
					tktip_active = false
				}
				tk.tklabel.on('mouseover', event => {
					// Only fires if menu not active from click event
					if (tktip_active == true) return
					showTkLabelTooltip(event, tk, labeltruncated)
					tktip_active = false
				})
				tk.tklabel.on('mouseout', () => {
					if (tktip_active == true) return
					tk.tktip.hide()
				})
				tk.tklabel.on('click', event => {
					tktip_active = !tktip_active
					if (tktip_active == true) {
						showTkLabelTooltip(event, tk, labeltruncated)
					}
				})
			}
			// tklabel content is set. initiate leftLabelMaxwidth with <text> width
			// this width may be overwritten (only by larger width) in individual tk maker scripts (adding sublabels or change tk.name ...)
			// when it's overwritten, must call block.setllabel() to update ui
			tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width
		} else {
			// tk.name is not provided, e.g. mds2
			// its maketk will be responsible for filling the tklabel and setting tk.leftLabelMaxwidth
			// fault is that the tooltip cannot be provided in this case
		}
		function showTkLabelTooltip(event, tk, labeltruncated) {
			tk.tktip.clear().show(event.clientX, event.clientY - 30)
			if (labeltruncated) {
				const d = tk.tktip.d.append('div').text(tk.name)
				if (tk.list_description) d.style('margin-bottom', '5px')
			}
			if (tk.list_description) {
				client.make_table_2col(tk.tktip.d.append('div'), tk.list_description).style('margin', '0px')
			}
		}

		tk.pica = {
			g: tk.gmiddle.append('g')
		}
		tk.cloak = tk.gmiddle.append('g').attr('transform', 'scale(0)')
		tk.cloakbox = tk.cloak.append('rect').attr('fill', 'white').attr('fill-opacity', 0)
		tk.cloaktext = tk.cloak
			.append('text')
			.attr('data-testid', 'loading_message')
			.text('Loading ...')
			.attr('fill', common.defaultcolor)
			.attr('fill-opacity', 0)
			.attr('font-weight', 'bold')
			.attr('font-size', '18px')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
		tk.cloakline = tk.cloak.append('line').attr('stroke', common.defaultcolor).attr('stroke-width', '2px')
		// set default if missing from template
		switch (tk.type) {
			case client.tkt.bampile:
				bampilemaketk(tk, this)
				break
			case client.tkt.ds:
				dsmaketk(tk, this)
				break
			case client.tkt.pgv:
				pgvmaketk(tk, this)
				break
			case client.tkt.ld:
				ldmaketk(tk, this)
				break
			case client.tkt.bam:
				bammaketk(tk, this)
				break
			case client.tkt.usegm:
				gmtkmaketk(tk, this)
				break
			case client.tkt.bedj:
				bedjmaketk(tk, this)
				break
			case client.tkt.junction:
				junctionmaketk(tk, this)
				break
			case client.tkt.aicheck:
				aicheckmaketk(tk, this)
				break
			case client.tkt.bigwig:
				bigwigmaketk(tk, this)
				break
			case client.tkt.bigwigstranded:
				bigwigstrandedmaketk(tk, this)
				break
			case client.tkt.mdsjunction:
				mdsjunctionmaketk(tk, this)
				break
			case client.tkt.mdssvcnv:
				mdssvcnvmaketk(tk, this)
				break
			case client.tkt.mds3:
				mds3_maketk(tk, this)
				break
			case client.tkt.bedgraphdot:
				bedgraphdot_maketk(tk, this)
				break
			case client.tkt.mdsexpressionrank:
				mdsexpressionrankmaketk(tk, this)
				break
			case client.tkt.hicstraw:
				hicstrawmaketk(tk, this)
				break
			case client.tkt.ase:
				asemaketk(tk, this)
				break
			default:
				this.error('maketk: unknown template tk type ' + tk.type)
		}
		this.setllabel()

		/*******    pan    *******/

		tk.gmiddle.on('mousedown', event => {
			if (this.busy) return
			if (event.which == 3) {
				// right click
				return
			}

			this.busy = true
			this.resized = false

			event.preventDefault()
			const body = d3select(document.body)

			const x0 = this.rotated ? event.clientY : event.clientX

			body.on('mousemove', event => {
				const xoff = (this.rotated ? event.clientY : event.clientX) - x0
				this.panning(xoff)
			})
			body.on('mouseup', event => {
				body.on('mousemove', null).on('mouseup', null)
				const xoff = (this.rotated ? event.clientY : event.clientX) - x0
				this.pannedby(xoff)
			})
		})

		/******* drag up down *******/

		tk.gleft.on('mousedown', event => {
			event.preventDefault()
			const body = d3select(document.body)
			let y0 = event.clientY
			body.on('mousemove', event => {
				const dy = event.clientY - y0

				tk.g.attr('transform', 'translate(0,' + (tk.yoff + dy) + ')')

				let tkidx = 0
				for (let i = 0; i < this.tklst.length; i++) {
					if (this.tklst[i].tkid == tk.tkid) {
						tkidx = i
						break
					}
				}
				if (dy < 0 && tkidx > 0) {
					let t2idx = tkidx - 1,
						t2 = this.tklst[t2idx]
					while (t2.hidden) {
						t2idx--
						if (t2idx < 0) {
							return
						}
						t2 = this.tklst[t2idx]
					}
					if (!t2) {
						return
					}
					if (-dy >= t2.height) {
						// swap
						this.tklst[t2idx] = tk
						this.tklst[tkidx] = t2
						tk.yoff = t2.yoff - t2.toppad + tk.toppad // important since tk/t2 may have different toppad, and yoff does not include toppad
						t2.yoff += tk.height

						t2.g.transition().attr('transform', 'translate(0,' + t2.yoff + ')')

						y0 = event.clientY
						if (tk.type == client.tkt.usegm && t2.type == client.tkt.ds && t2.aboveprotein) {
							// t2 go down
							blockds.skewer_flip(t2)
						} else if (t2.type == client.tkt.usegm && tk.type == client.tkt.ds && !tk.aboveprotein) {
							// tk go up
							blockds.skewer_flip(tk)
						}
					}
				} else if (dy > 0 && tkidx < this.tklst.length - 1) {
					let t2idx = tkidx + 1,
						t2 = this.tklst[t2idx]
					while (t2.hidden) {
						t2idx++
						if (t2idx >= this.tklst.length) {
							return
						}
						t2 = this.tklst[t2idx]
					}
					if (!t2) {
						return
					}
					if (dy >= t2.height) {
						// swap
						this.tklst[t2idx] = tk
						this.tklst[tkidx] = t2
						t2.yoff = tk.yoff - tk.toppad + t2.toppad
						tk.yoff += t2.height

						t2.g.transition().attr('transform', 'translate(0,' + t2.yoff + ')')

						y0 = event.clientY
						if (tk.type == client.tkt.usegm && t2.type == client.tkt.ds && !t2.aboveprotein) {
							// t2 go up
							blockds.skewer_flip(t2)
						} else if (t2.type == client.tkt.usegm && tk.type == client.tkt.ds && tk.aboveprotein) {
							// tk go down
							blockds.skewer_flip(tk)
						}
					}
				}
			})
			body.on('mouseup', () => {
				tk.g.transition().attr('transform', 'translate(0,' + tk.yoff + ')')

				body.on('mousemove', null).on('mouseup', null)
			})
		})
	}

	panning(xoff) {
		if (this.showreverse) {
			xoff *= -1
		}

		this.coord.g.attr('transform', 'translate(' + xoff + ',0)')

		for (const tk of this.tklst) {
			tk.glider.attr('transform', 'translate(' + xoff + ',0)')

			if (tk.type == client.tkt.pgv) {
				// need to shift some part of its member tracks
				for (const t of tk.tracks) {
					t.immobileg.attr('transform', 'translate(' + -xoff + ',0)')
				}
			}
		}

		for (const r of this.hlregion.lst) {
			r.rect.attr('x', r.x + xoff)
		}
		if (this.onpanning) {
			this.onpanning(xoff)
		}
	}

	pannedby(xoff) {
		if (xoff == 0) {
			this.busy = false
			this.pannedpx = undefined
			return
		}

		if (this.showreverse) {
			xoff *= -1
		}

		let back = false
		if (xoff < 0) {
			if (this.stopidx == this.rglst.length - 1) {
				const r = this.rglst[this.stopidx]
				if (r.reverse) {
					if (r.start <= r.bstart) back = true
				} else {
					if (r.stop >= r.bstop) back = true
				}
			}
		} else {
			if (this.startidx == 0) {
				const r = this.rglst[0]
				if (r.reverse) {
					if (r.stop >= r.bstop) back = true
				} else {
					if (r.start <= r.bstart) back = true
				}
			}
		}
		if (back) {
			this.coord.g.transition().attr('transform', 'translate(0,0)')
			for (const t of this.tklst) {
				t.glider.transition().attr('transform', 'translate(0,0)')
			}
			this.busy = false
			this.pannedpx = undefined
			for (const r of this.hlregion.lst) {
				r.rect.transition().attr('x', r.x)
			}
			if (this.onpanning) {
				this.onpanning(0)
			}
			return
		}
		this.pannedpx = xoff
		this.zoomedin = false
		this.zoom2px(-xoff, this.width - xoff)
	}

	tk_hide(tk) {
		tk.hidden = true
		tk.g.remove()
		if (tk.eplst) {
			// ds tk that has epaint
			for (const ep of tk.eplst) {
				if (ep.pane && ep.pane.pane && ep.pane.pane.style('display') != 'none') {
					ep.epaintfold(this)
				}
			}
		}
		this.setllabel()
		this.block_setheight()
		if (tk.type == client.tkt.ds) {
			const hd = this.ds2handle[tk.name]
			if (hd) {
				hd.handlesays.style('background-color', '#999').style('color', 'white')
			}
		}
		if (tk.tr_legend) {
			disappear(tk.tr_legend)
		}
	}

	tkchangeaffectlegend(tk) {
		if (!this.legend) return
		// tk has been turned shown/hidden
		if (tk.type == client.tkt.ds) {
			// mclass / morigin legend
			let dsshown = false
			for (const t of this.tklst) {
				if (!t.hidden && t.type == client.tkt.ds) {
					dsshown = true
					break
				}
			}
			if (dsshown) {
				this.legend.tr_mclass.style('display', 'table-row')
				Legend.legend_mclass(this)
				this.legend.tr_morigin.style('display', 'table-row')
				Legend.legend_morigin(this)
			} else {
				this.legend.tr_mclass.style('display', 'none')
				this.legend.tr_morigin.style('display', 'none')
			}
		}
	}

	tk_load_all() {
		/*
	tk_load of individual tk is sync and blocking in nature
	e.g.
	when zooming in, a junction track will be rendered all in sync, and will attempt to run splice event analysis via onloadalltk()
	but the gene tk following the junction tk still hasn't been set busy flag
	so results in the onloadalltk to be run on stale gene tk data
	so must set busy flag to all tk first, then call tk_load
	*/
		for (const t of this.tklst) {
			t.busy = true
		}
		for (const t of this.tklst) {
			this.tk_load(t)
		}
	}

	tk_load(tk) {
		/*
	called when track first created
	and when view range updated
	detection of viewrangeupperlimit is handled in the loader of each track type, so that each track can respond to beyond-limit in their own way
	*/

		if (tk.hidden) {
			if (tk.g) {
				tk.g.remove()
			}
			return
		}
		// in case this tk is brought back from hidden
		if (!tk.g.node().parentNode) {
			this.gbase.node().appendChild(tk.g.node())
		}
		if (tk.tr_legend && tk.tr_legend.style('display') == 'none') {
			appear(tk.tr_legend, 'table-row')
		}
		tk.busy = true
		switch (tk.type) {
			case client.tkt.bampile:
				bampileload(tk, this)
				break
			case client.tkt.pgv:
				pgvload(tk, this)
				break
			case client.tkt.ld:
				ldload(tk, this)
				break
			case client.tkt.bam:
				bamload(tk, this)
				break
			case client.tkt.ds:
				const hd = this.ds2handle[tk.name]
				if (hd) {
					hd.handlesays.style('background-color', '#ddd').style('color', 'black')
				}
				if (
					tk.dsuninitiated ||
					!this.usegm ||
					this.gmmode == client.gmmode.genomic ||
					this.gmmodepast == client.gmmode.genomic
				) {
					// re-request data, only for range-queries, not for gene expression
					blockds.dstkload(tk, this)
					return
				}
				blockds.dstkrender(tk, this)
				break
			case client.tkt.usegm:
				gmtkrender(tk, this)
				break
			case client.tkt.bigwig:
				bigwigload(tk, this)
				break
			case client.tkt.aicheck:
				aicheckload(tk, this)
				break
			case client.tkt.bigwigstranded:
				bigwigstrandedload(tk, this)
				break
			case client.tkt.junction:
				junctionload(tk, this)
				break
			case client.tkt.bam:
				this.loadtk_bam(tk)
				break
			case client.tkt.bedj:
				bedjload(tk, this)
				break
			case client.tkt.mdsjunction:
				mdsjunctionload(tk, this)
				break
			case client.tkt.mdssvcnv:
				mdssvcnvload(tk, this)
				break
			case client.tkt.mds3:
				mds3_load(tk, this)
				break
			case client.tkt.bedgraphdot:
				bedgraphdot_load(tk, this)
				break
			case client.tkt.mdsexpressionrank:
				mdsexpressionrankload(tk, this)
				break
			case client.tkt.hicstraw:
				hicstrawload(tk, this)
				break
			case client.tkt.ase:
				aseload(tk, this)
				break
			default:
				this.error('tk_load: unknown tk type')
		}
		if (this.onAddRemoveTk) this.onAddRemoveTk(tk, true)
	}

	cloakOn() {
		// will cloak the entire svg
		// right now not called in block, but is called by external code on a block instance
		const w = Number(this.svg.attr('width')),
			h = Number(this.svg.attr('height'))
		this.gCloak.attr('transform', 'scale(1)')
		this.gCloakRect.attr('width', w).attr('height', h).transition().duration(600).attr('fill-opacity', 0.5)
		this.gCloakWord
			.attr('x', w / 2)
			.attr('y', h / 2)
			.transition()
			.duration(600)
			.attr('fill-opacity', 1)
	}
	cloakOff() {
		this.gCloak.attr('transform', 'scale(0)')
	}

	tkcloakon(tk) {
		tk.busy = true
		this.busy = true
		tk.cloak.attr('transform', 'scale(1)')
		tk.cloakbox.attr('width', this.width).attr('height', tk.height).transition().duration(600).attr('fill-opacity', 0.5)
		tk.cloaktext
			.attr('x', this.width / 2)
			.attr('y', tk.height / 2)
			.transition()
			.duration(600)
			.attr('fill-opacity', 1)
		tk.cloakline.attr('y1', tk.height).attr('y2', tk.height).attr('x2', 0)
		if (tk.gerror) {
			tk.gerror.remove()
		}
	}

	tkcloakoff(tk, data) {
		tk.busy = false
		this.ifbusy()
		tk.cloak.attr('transform', 'scale(0)')
		tk.cloakbox.attr('fill-opacity', 0).attr('height', 0) //This is a fix for issue #259. Set to 0. Otherwise Safari will not detect event.listeners for the first few track rows.
		tk.cloaktext.attr('fill-opacity', 0)
		tk.cloakline.attr('x2', 0)
		tk.glider.attr('transform', 'translate(0,0)')

		if (tk.gerror) {
			// must do this before tkerror
			tk.gerror.remove()
		}

		if (!data) {
			this.tkerror(tk, 'Server error ...')
		} else if (data.error) {
			this.tkerror(tk, data.error)
		}
	}

	ifbusy() {
		let quiet = true
		for (const t of this.tklst) {
			if (!t.hidden && t.busy) quiet = false
		}
		for (const r of this.rglst) {
			if (r.busy) quiet = false
		}
		if (quiet) {
			this.busy = false

			// insert subpanels
			this.add_subpanel()

			/*
		special actions only when it finishes loading all tracks
		*/
			while (this.onloadalltk.length > 0) {
				const task = this.onloadalltk.pop()
				task()
			}

			if (this.onloadalltk_always) {
				this.onloadalltk_always(this)
			}
		}
	}

	tkprogress(tk, percent) {
		tk.cloakline.attr('x2', this.width * percent)
	}

	tkerror(tk, msg, y) {
		// only works for main track, not subpanel
		// FIXME when printing new error old error register is overwritten!!
		tk.gerror = tk.glider
			.append('text')
			.text(msg.length > this.width / 10 ? msg.substring(0, this.width / 10 - 20) + '...' : msg)
			.attr('x', this.width / 2)
			.attr('text-anchor', 'middle')
			.attr('y', y ? y : (tk.height_main - tk.toppad - tk.bottompad) / 2)
			.attr('dominant-baseline', 'central')
			.attr('font-size', '14px')
	}

	block_setheight() {
		/*
	each track has height_main and heights from each subpanel
	set tk.height for each track
	then set tk.yoff
	*/
		let h = this.coord.height

		for (const t of this.tklst) {
			if (t.hidden) continue

			t.yoff = h + t.toppad
			t.g.transition().attr('transform', 'translate(0,' + t.yoff + ')')

			if (!Number.isFinite(t.height_main)) {
				// should not happen
				if (this.debugmode) {
					console.log('block_setheight: invalid height_main for ' + t.name)
				}
				continue
			}
			// heights to be considered: subpanels, and main track
			{
				const lst = t.subpanels.map(i => i.height)
				lst.push(t.height_main)
				t.height = Math.max(...lst)
			}

			h += t.height
			t.tkbodybgrect.attr('width', this.width).attr('height', t.height)

			for (const [i, p] of t.subpanels.entries()) {
				p.subpaneltkbgrect.attr('width', this.subpanels[i].width).attr('height', t.height)
			}
		}

		for (const p of this.subpanels) {
			p.subpanelbgrect.attr('height', h)
			p.subpanelleftborder.attr('height', h)
		}

		this.svg.transition().attr('height', h)

		for (const r of this.hlregion.lst) {
			r.rect.attr('height', h)
		}

		if (this.onsetheight) {
			this.onsetheight(h)
		}
	}

	tkarg_bedj(tk) {
		const par = {
			name: tk.name,
			genome: this.genome.name,
			rglst: this.tkarg_rglst(),
			stackheight: tk.stackheight,
			stackspace: tk.stackspace,
			regionspace: this.regionspace,
			width: this.width,
			devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1
		}
		if (tk.file) {
			par.file = tk.file
		} else {
			par.url = tk.url
			if (tk.indexURL) par.indexURL = tk.indexURL
		}
		if (tk.color) par.color = tk.color
		if (tk.categories) par.categories = tk.categories
		if (tk.translatecoding) par.translatecoding = 1
		if (tk.onerow) par.onerow = 1
		if (tk.usevalue) par.usevalue = tk.usevalue
		if (tk.bplengthUpperLimit) par.bplengthUpperLimit = tk.bplengthUpperLimit
		if (tk.hideItemNames) par.hideItemNames = tk.hideItemNames
		if (tk.filterByName) par.filterByName = tk.filterByName
		if (this.usegm && this.gmmode != client.gmmode.genomic) {
			// important, will render a gene in a single row across rglst
			par.gmregion = this.tkarg_maygm(tk)[0]
			par.isoform = this.usegm.isoform
		}
		return par
	}

	bedj_tooltip(tk, data, panel) {
		// process data loaded from main tk and subpanel
		// TODO move this to bedj.js as this is type-specific logic
		let tipnum = 0
		if (data.mapisoform) tipnum += data.mapisoform.length
		if (data.mapexon) tipnum += data.mapexon.length
		if (data.mapaa) tipnum += data.mapaa.length

		const img = (panel || tk).img

		if (tipnum) {
			img
				.on('mousemove', event => {
					if (this.busy) return
					const lst = []
					const p = pointer(event, img.node())
					let stacknumber
					if (data.mapisoform) {
						for (const i of data.mapisoform) {
							const y = (i.y - 1) * (tk.stackheight + tk.stackspace)
							if (i.x1 < p[0] && i.x2 > p[0] && y < p[1] && y + tk.stackheight > p[1]) {
								stacknumber = i.y
								lst.push(
									i.name +
										' <span style="opacity:.5;font-size:.7em">' +
										i.chr +
										':' +
										(i.start + 1) +
										'-' +
										(i.stop + 1) +
										' ' +
										common.bplen(i.stop - i.start) +
										'</span>'
								)
							}
						}
					}
					if (data.mapexon) {
						for (const i of data.mapexon) {
							const y = (i.y - 1) * (tk.stackheight + tk.stackspace)
							if (i.x1 < p[0] && i.x2 > p[0] && y < p[1] && y + tk.stackheight > p[1]) {
								stacknumber = i.y
								lst.push(
									i.name +
										' <span style="opacity:.5;font-size:.7em">' +
										i.chr +
										':' +
										(i.start + 1) +
										'-' +
										(i.stop + 1) +
										' ' +
										common.bplen(i.stop - i.start) +
										'</span>'
								)
							}
						}
					}
					if (data.mapaa) {
						for (const i of data.mapaa) {
							const y = (i.y - 1) * (tk.stackheight + tk.stackspace)
							if (i.x1 < p[0] && i.x2 > p[0] && y < p[1] && y + tk.stackheight > p[1]) {
								stacknumber = i.y
								lst.push(i.name)
								// break: a hack to resolve issue that sometimes two aa show at cursor position
								break
							}
						}
					}
					if (lst.length) {
						tk.tktip.clear()
						for (const i of lst) {
							tk.tktip.d.append('div').html(i)
						}
						tk.tktip.show(
							event.clientX,
							img.node().getBoundingClientRect().top + stacknumber * (tk.stackheight + tk.stackspace) - 10
						)
					} else {
						tk.tktip.hide()
					}
				})
				.on('mouseout', () => {
					tk.tktip.hide()
				})

			/*
		isoform is also for singular bed item
		*/
			if (data.mapisoform) {
				// has isoform, may enable clicking for different reasons

				if (tk.itemurl_appendname) {
					// append item name to url for clicking
					img.on('click', event => {
						const p = pointer(event, img.node())
						for (const i of data.mapisoform) {
							const y = (i.y - 1) * (tk.stackheight + tk.stackspace)
							if (i.x1 < p[0] && i.x2 > p[0] && y < p[1] && y + tk.stackheight > p[1] && i.name) {
								// hit an item with name
								window.open(tk.itemurl_appendname + i.name)
								return
							}
						}
					})
				} else if (data.mapisoform.find(i => i.isoform)) {
					// has isoform name, enable clicking on a isoform to launch protein view

					if (tk.__isgene) {
						// this flag is true for native gene tracks
						// only allow this menu option for these tracks, and won't show it for custom gene tracks

						if (this.tklst.find(i => i.type == 'bam')) {
							// currently there's a bam tk showing in block; as it does not work for protein view yet, disable this option
							// this check can be deleted with a fix e.g. when bam tk is able to properly show pileup-only and no alignment over whole gene
						} else {
							img.on('click', event => {
								const p = pointer(event, img.node())
								for (const i of data.mapisoform) {
									const y = (i.y - 1) * (tk.stackheight + tk.stackspace)
									if (i.x1 < p[0] && i.x2 > p[0] && y < p[1] && y + tk.stackheight > p[1] && i.isoform) {
										// hit an isoform
										tk.tkconfigtip
											.clear()
											.show(event.clientX - 40, event.clientY)
											.d.append('div')
											.attr('class', 'sja_menuoption')
											.text('Gene/protein view for ' + i.isoform)
											.on('click', () => {
												tk.tkconfigtip.hide()
												this.to_proteinview(i.isoform, tk)
											})
										return
									}
								}
							})
						}
					}
				} else {
					img.on('click', null)
				}
			} else {
				img.on('click', null)
			}
		} else {
			img.on('mouseover', null).on('click', null)
		}
	}

	/* show protein view for a given isoform
	and bring along current tracks
	if fromgenetk is provided, will skip this track
	*/
	to_proteinview(isoform, fromgenetk) {
		// when a mds3 tk is part of genomebrowser app in mass ui, this special folder exists; create sandbox into it to make it look nice that the new sandbox is on top of existing genomebrowser sandbox, rather than inside it which looks bad
		const sandbox = newSandboxDiv(this.tklst.find(i => i.type == 'mds3')?.newChartHolder || this.holder0)
		sandbox.header.text(isoform)
		const arg = {
			genome: this.genome,
			debugmode: this.debugmode,
			holder: sandbox.body,
			tklst: [],
			query: isoform
		}
		// bring along current tracks
		for (const tk of this.tklst) {
			if (fromgenetk && tk.tkid == fromgenetk.tkid) {
				continue
			}
			if (tk.type == common.tkt.mdsexpressionrank) {
				// somehow this track won't work (no need to fix)
				continue
			}
			if (tk.type == 'mds3') {
				// TODO code duplication limits script change; after release use createSubTk method instead
				//arg.tklst.push(tk.createSubTk())
				const tkarg = {
					type: 'mds3',
					dslabel: tk.dslabel,
					filter0: tk.filter0,
					showCloseLeftlabel: true,
					filterObj: structuredClone(tk.filterObj),
					allow2selectSamples: tk.allow2selectSamples,
					onClose: tk.onClose,
					hardcodeCnvOnly: tk.hardcodeCnvOnly,
					token: tk.token // for testing
				}
				if (tk.cnv?.presetMax) tkarg.cnv = { presetMax: tk.cnv.presetMax } // preset value is present, pass to subtk
				if (tk.legend.mclass?.hiddenvalues?.size) {
					tkarg.legend = { mclass: { hiddenvalues: new Set() } }
					for (const v of tk.legend.mclass.hiddenvalues) tkarg.legend.mclass.hiddenvalues.add(v)
				}
				arg.tklst.push(tkarg)
				continue
			}
			arg.tklst.push(tk)
			console.log('tk used as-is')
		}
		blockinit(arg)
	}

	tkarg_rglst() {
		// per region/exon, should be used for bigwig and bedj
		const lst = []
		for (let i = this.startidx; i <= this.stopidx; i++) {
			const r = this.rglst[i]
			lst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				reverse: r.reverse
			})
		}
		return lst
	}

	tkarg_maygm(tk) {
		if (!this.usegm || this.gmmode == client.gmmode.genomic) {
			return this.tkarg_rglst()
		}
		const r = this.rglst[this.startidx]
		const reverse = r.reverse
		if (tk.type == client.tkt.ds || tk.mds) {
			/* use entire gm for:
		1. old official ds, vcf
		2. any track from mds
		*/
			return [
				{
					chr: this.usegm.chr,
					start: this.usegm.start,
					stop: this.usegm.stop,
					width: this.width,
					reverse: reverse
				}
			]
		}
		// for bedj/junction
		// restrict by current view range
		// will include entire gm span in view range including hidden introns in exon mode
		let min = Math.min(r.start, r.stop)
		let max = Math.max(r.start, r.stop)
		for (let i = this.startidx + 1; i <= this.stopidx; i++) {
			const r = this.rglst[i]
			min = Math.min(min, r.start, r.stop)
			max = Math.max(max, r.start, r.stop)
		}
		return [
			{
				chr: this.usegm.chr,
				start: min,
				stop: max,
				width: this.width,
				reverse: reverse
			}
		]
	}

	tkarg_q(tk) {
		// bigwig track
		const a = {
			jwt: this.jwt,
			genome: this.genome.name,
			name: tk.name,
			rglst: this.tkarg_rglst(),
			regionspace: this.regionspace,
			width: this.width,
			file: tk.file,
			url: tk.url,
			indexURL: tk.indexURL, // for bedgraph
			barheight: tk.barheight,
			minv: tk.scale.min,
			maxv: tk.scale.max,
			percentile: tk.scale.percentile,
			autoscale: tk.scale.auto,
			pcolor: tk.pcolor,
			pcolor2: tk.pcolor2,
			ncolor: tk.ncolor,
			ncolor2: tk.ncolor2,
			devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1
		}
		if (tk.normalize && !tk.normalize.disable) {
			a.dividefactor = tk.normalize.dividefactor
		}
		return a
	}

	maketkconfighandle(tk) {
		return tk.gright
			.append('text')
			.text('CONFIG')
			.attr('fill', '#555')
			.attr('font-size', this.labelfontsize)
			.attr('y', this.labelfontsize)
			.attr('class', 'sja_clbtext2')
	}

	maketklefthandle(tk, y) {
		return tk.gleft
			.append('text')
			.attr('font-size', this.labelfontsize)
			.attr('y', this.labelfontsize / 2 + (y || 0))
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('class', 'sja_clbtext2')
			.attr('fill', 'black')
			.attr('x', this.tkleftlabel_xshift)
	}

	/** __tk__ end **/

	/** __gm__ **/

	setgmmode(mode, willupdate) {
		if (!mode) return this.error('setgmmode: no given mode')
		if (typeof mode != 'string') return this.error('setgmmode: mode value is not string')
		if (!this.usegm) return this.error('setgmmode: this.usegm missing')

		this.rglst = []
		const c = this.genome.chrlookup[this.usegm.chr.toUpperCase()]
		if (!c) {
			this.error('invalid chr of usegm: ' + this.usegm.chr)
			return true
		}
		if (this.gmmode == mode) {
			return
		}
		if (this.gmmode) {
			this.gmmodepast = this.gmmode
		}
		this.gmmode = mode
		let addgene = false
		switch (this.gmmode) {
			case client.gmmode.genomic:
				this.rglst = [
					{
						chr: this.usegm.chr,
						bstart: 0,
						bstop: c.len,
						start: this.usegm.start,
						stop: this.usegm.stop,
						reverse: this.usegm.strand == '-'
					}
				]
				this.regionspace = 0
				addgene = true
				break
			case client.gmmode.splicingrna:
				// TODO allow padding bases
				for (const e of this.usegm.exon) {
					this.rglst.push({
						chr: this.usegm.chr,
						bstart: e[0],
						bstop: e[1],
						start: e[0],
						stop: e[1],
						reverse: this.usegm.strand == '-'
					})
				}
				this.regionspace = 10
				break
			case client.gmmode.exononly:
				for (const e of this.usegm.exon) {
					this.rglst.push({
						chr: this.usegm.chr,
						bstart: e[0],
						bstop: e[1],
						start: e[0],
						stop: e[1],
						reverse: this.usegm.strand == '-'
					})
				}
				this.regionspace = 0
				break
			case client.gmmode.protein:
				for (const e of this.usegm.coding) {
					this.rglst.push({
						chr: this.usegm.chr,
						bstart: e[0],
						bstop: e[1],
						start: e[0],
						stop: e[1],
						reverse: this.usegm.strand == '-'
					})
				}
				this.regionspace = 0
				break
			case client.gmmode.gmsum:
				this.rglst = allgm2sum(this.allgm)[0]
				this.regionspace = 10
				break
			default:
				this.error('setgmmode: unknown mode ' + this.gmmode)
				this.gmmode = this.gmmodepast
				return
		}
		this.startidx = 0
		this.stopidx = this.rglst.length - 1
		if (this.rglst.length > 1 && this.regionspace > 0) {
			// adjust width
			if (this.regionspace * (this.rglst.length - 1) > this.width * 0.3) {
				this.regionspace = Math.max(2, (this.width * 0.3) / (this.rglst.length - 1))
			}
			const inw = this.regionspace * (this.rglst.length - 1)
			const exonlen = this.rglst.reduce((a, b) => a + b.stop - b.start, 0)
			this.exonsf = (this.width - (inw > this.width * 0.4 ? 0 : inw)) / exonlen
			this.width = exonlen * this.exonsf + inw
		}

		if (this.gbase) {
			let hasgene = false
			for (const tk of this.tklst) {
				if (tk.__isgene) hasgene = true
			}
			if (addgene) {
				if (!hasgene) {
					// add
					for (const tk of this.genome.tracks) {
						if (tk.__isgene) {
							this.block_addtk_template(tk)
							// by breaking, block will only add the first gene track, but not more than 1
							break
						}
					}
				}
			} else {
				if (hasgene) {
					// remove
					while (hasgene) {
						for (let i = 0; i < this.tklst.length; i++) {
							if (this.tklst[i].__isgene) {
								this.tk_remove(i)
								break
							}
						}
						hasgene = false
					}
				}
			}
			if (willupdate) {
				delete this.pannedpx
				this.block_coord_updated()
			}
		} else {
			// gbase is missing
			// this is setting gmmode at init
			// somehow this will also prevent from adding default gene track
		}
	}

	showgmmode4switch(holder, hideuponselect) {
		let row1, row2, row3, row4, row5

		const width = 400

		if (this.allowGenomeMode()) {
			// 1 - genomic
			row1 = holder
				.append('div')
				.style('margin', '1px')
				.attr('class', this.gmmode == client.gmmode.genomic ? 'sja_inset_a' : 'sja_menuoption')
				.on('click', () => {
					this.setgmmode(client.gmmode.genomic, true)
					if (hideuponselect) {
						this.usegmtip.fadeout()
					} else {
						row1.attr('class', 'sja_inset_a')
						if (row2) row2.attr('class', 'sja_menuoption')
						if (row3) row3.attr('class', 'sja_menuoption')
						if (row4) row4.attr('class', 'sja_menuoption')
						if (row5) row5.attr('class', 'sja_menuoption')
					}
				})
			client.sketchGene(
				row1.append('div').style('vertical-align', 'middle').style('display', 'inline-block'),
				this.usegm,
				width,
				20,
				this.usegm.start,
				this.usegm.stop,
				common.exoncolor,
				true,
				this.usegm.strand == '-'
			)
			row1.append('div').style('display', 'inline-block').style('padding', '13px').text(client.gmmode.genomic)
		}

		// 2 - splicing rna
		if (this.usegm.exon.length > 1) {
			row2 = holder
				.append('div')
				.style('margin', '1px')
				.attr('class', this.gmmode == client.gmmode.splicingrna ? 'sja_inset_a' : 'sja_menuoption')
				.on('click', () => {
					this.setgmmode(client.gmmode.splicingrna, true)
					if (hideuponselect) {
						this.usegmtip.fadeout()
					} else {
						row2.attr('class', 'sja_inset_a')
						if (row1) row1.attr('class', 'sja_menuoption')
						if (row3) row3.attr('class', 'sja_menuoption')
						if (row4) row4.attr('class', 'sja_menuoption')
						if (row5) row5.attr('class', 'sja_menuoption')
					}
				})
			client.sketchSplicerna(
				row2.append('div').style('vertical-align', 'middle').style('display', 'inline-block').style('padding', '0px'),
				this.usegm,
				width,
				common.exoncolor
			)
			row2.append('div').style('display', 'inline-block').style('padding', '13px').text(client.gmmode.splicingrna)
		}
		// 3 - whole rna
		row3 = holder
			.append('div')
			.style('margin', '1px')
			.attr('class', this.gmmode == client.gmmode.exononly ? 'sja_inset_a' : 'sja_menuoption')
			.on('click', () => {
				if (hideuponselect) {
					this.usegmtip.fadeout()
				} else {
					row3.attr('class', 'sja_inset_a')
					if (row1) row1.attr('class', 'sja_menuoption')
					if (row2) row2.attr('class', 'sja_menuoption')
					if (row4) row4.attr('class', 'sja_menuoption')
					if (row5) row5.attr('class', 'sja_menuoption')
				}
				this.setgmmode(client.gmmode.exononly, true)
			})
		client.sketchRna(
			row3.append('div').style('vertical-align', 'middle').style('display', 'inline-block').style('padding', '0px'),
			this.usegm,
			width,
			common.exoncolor
		)
		row3
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '13px')
			.text(this.usegm.exon.length == 1 ? 'RNA' : client.gmmode.exononly)
		// 4 - protein
		if (this.usegm.coding) {
			row4 = holder
				.append('div')
				.style('margin', '1px')
				.attr('class', this.gmmode == client.gmmode.protein ? 'sja_inset_a' : 'sja_menuoption')
				.on('click', () => {
					if (hideuponselect) {
						this.usegmtip.fadeout()
					} else {
						row4.attr('class', 'sja_inset_a')
						if (row1) row1.attr('class', 'sja_menuoption')
						if (row2) row2.attr('class', 'sja_menuoption')
						if (row3) row3.attr('class', 'sja_menuoption')
						if (row5) row5.attr('class', 'sja_menuoption')
					}
					this.setgmmode(client.gmmode.protein, true)
				})
			client.sketchProtein2(
				row4.append('div').style('vertical-align', 'middle').style('display', 'inline-block').style('padding', '0px'),
				this.usegm,
				width
			)
			row4.append('div').style('display', 'inline-block').style('padding', '13px').text(client.gmmode.protein)
		}
		if (this.allgm.length > 1) {
			row5 = holder
				.append('div')
				.style('margin', '1px')
				.attr('class', this.gmmode == client.gmmode.gmsum ? 'sja_inset_a' : 'sja_menuoption')
				.on('click', () => {
					if (hideuponselect) {
						this.usegmtip.fadeout()
					} else {
						row5.attr('class', 'sja_inset_a')
						if (row1) row1.attr('class', 'sja_menuoption')
						if (row2) row2.attr('class', 'sja_menuoption')
						if (row3) row3.attr('class', 'sja_menuoption')
						if (row4) row4.attr('class', 'sja_menuoption')
					}
					this.setgmmode(client.gmmode.gmsum, true)
				})
			row5
				.append('div')
				.style('padding', '13px')
				.style('text-align', 'center')
				.text('Aggregation of ' + this.allgm.length + ' isoforms')
		}
	}

	allowGenomeMode() {
		/*
		allow some mds3 tk to disable genomic view mode, due to gdc ssm genomic range query is not working yet
		*/
		for (const t of this.tklst) {
			if (t.type == 'mds3' && t.mds?.noGenomicMode4lollipopTk) return false
		}
		return true
	}

	showisoform4switch(holder, hideuponselect) {
		/*
		showing gene in gmmode
		list all isoforms to allow switching isoform
		*/
		if (!this.allgm) {
			this.error('this.allgm[] missing')
			return
		}
		if (!this.usegm) {
			this.error('this.usegm missing')
			return
		}

		const [rglst, chrcount] = allgm2sum(this.allgm)
		let pxwidth = 370
		let intronpx = 10
		if (intronpx * (rglst.length - 1) > pxwidth * 0.3) {
			intronpx = Math.max(2, (pxwidth * 0.3) / (rglst.length - 1))
		}
		const inw = intronpx * (rglst.length - 1)
		const exonlen = rglst.reduce((a, b) => a + b.stop - b.start, 0)
		const exonsf = (pxwidth - (inw > pxwidth * 0.4 ? 0 : inw)) / exonlen
		pxwidth = exonlen * exonsf + inw
		for (const e of rglst) {
			e.width = Math.ceil((e.stop - e.start) * exonsf)
		}

		let mayscroll = holder
		if (this.allgm.length > 10) {
			mayscroll = holder
				.append('div')
				.attr('tabindex', 0)
				.style('height', '200px')
				.style('overflow-y', 'scroll')
				.style('resize', 'vertical')
		}

		const table = mayscroll.append('table').style('color', '#555')

		const gmlabellst = []

		for (const gm1 of this.allgm) {
			const tr = table
				.append('tr')
				.attr('class', 'sja_clb')
				.on('click', async () => {
					if (hideuponselect) {
						// hardcoded, hide the block menu
						this.usegmtip.fadeout()
					} else {
						// toggle gm label font color
						for (const gm2 of gmlabellst) {
							gm2.label.style(
								'color',
								gm2.isoform == gm1.isoform && gm2.chr == gm1.chr && gm2.start == gm1.start ? '#cc0000' : '#545454'
							)
						}
					}
					this.holder0.selectAll('*').remove()

					/*
					this selected isoform may not have genomic sequence loaded
					which is initially only loaded in block.init for bb.usegm
					now may need to load it
					*/
					if (!gm1.genomicseq) {
						const data = await dofetch3('ntseq', {
							method: 'POST',
							body: JSON.stringify({
								genome: this.genome.name,
								coord: gm1.chr + ':' + (gm1.start + 1) + '-' + gm1.stop
							})
						})
						if (data.error) {
							this.error(data.error)
							return
						}
						gm1.genomicseq = data.seq
						gm1.aaseq = common.nt2aa(gm1)
					}

					// quick fix based on changes to mds3/maketk
					const tklst = []
					for (const t of this.tklst) {
						if (t.type == client.tkt.usegm) continue
						if (t.type == client.tkt.mds3) delete t.mds
						tklst.push(t)
					}
					new Block({
						holder: this.holder0,
						genome: this.genome,
						hostURL: this.hostURL,
						nobox: true,
						gmstackheight: 37,
						usegm: gm1,
						allgm: this.allgm,
						tklst,
						gmmode: gm1.cdslen ? client.gmmode.protein : client.gmmode.exononly,
						hidedatasetexpression: this.hidedatasetexpression,
						hidegenecontrol: this.hidegenecontrol,
						hidegenelegend: this.hidegenelegend,
						variantPageCall_snv: this.variantPageCall_snv,
						samplecart: this.samplecart,
						debugmode: this.debugmode
					})
				})

			tr.append('td')
				.text(gm1.isdefault ? 'DEFAULT' : '')
				.style('font-size', '.6em')
			const lab = tr
				.append('td')
				.text(gm1.isoform)
				.style(
					'color',
					gm1.isoform == this.usegm.isoform && gm1.chr == this.usegm.chr && gm1.start == this.usegm.start
						? '#cc0000'
						: '#545454'
				)
			gmlabellst.push({
				isoform: gm1.isoform,
				chr: gm1.chr,
				start: gm1.start,
				label: lab
			})
			if (chrcount > 1) {
				tr.append('td').text(gm1.chr)
			}
			client.sketchGmsum(tr.append('td'), rglst, gm1, exonsf, intronpx, pxwidth, 16, common.exoncolor)
			client.sketchProtein(tr.append('td'), gm1, 200)
		}
	}

	/** __gm__ ends **/

	/** __subpanel **/

	add_subpanel() {
		/*
	called by:
	- in ifbusy(), when all tracks of the browser finish loading
	- when changing view range for one subpanel (by panning, zooming)
	*/

		if (this.subpanels.length == 0) {
			this.clean_subpanel()
			return
		}
		for (let panelidx = 0; panelidx < this.subpanels.length; panelidx++) {
			const panelrecord = this.subpanels[panelidx]

			for (const tk of this.tklst) {
				if (tk.hidden) continue

				if (!tk.subpanels[panelidx]) {
					/*
				must not closure the panelidx with each tk's subpanel
				since panels from block.subpanels[] can be deleted and array index shifted
				*/
					tk.subpanels[panelidx] = this.new_tk_subpanel(tk, panelrecord)
				}

				const thispanel = tk.subpanels[panelidx]

				// position this panel
				{
					let x = panelrecord.leftpad
					for (let i = 0; i < panelidx; i++) {
						x += this.subpanels[i].leftpad + this.subpanels[i].width
					}
					thispanel.gtksubpanel.transition().attr('transform', 'translate(' + x + ',0)')
				}

				if (
					thispanel.chr == panelrecord.chr &&
					thispanel.start == panelrecord.start &&
					thispanel.stop == panelrecord.stop &&
					thispanel.width == panelrecord.width
				) {
					// no need to update this panel
					continue
				}

				// update this panel in this track
				thispanel.chr = panelrecord.chr
				thispanel.start = panelrecord.start
				thispanel.stop = panelrecord.stop
				thispanel.width = panelrecord.width
				thispanel.leftpad = panelrecord.leftpad

				this.updateruler_subpanel(panelrecord)

				switch (tk.type) {
					case client.tkt.bam:
						bamload(tk, this)
						break
					case client.tkt.bedj:
						bedjloadsubpanel(tk, this, thispanel)
						break
					case client.tkt.bigwig:
						bigwigloadsubpanel(tk, this, thispanel)
						break
					case client.tkt.bigwigstranded:
						bigwigstrandedloadsubpanel(tk, this, thispanel)
						break
					case client.tkt.hicstraw:
						hicstrawload(tk, this)
						break
					case client.tkt.ase:
						aseload(tk, this)
						break
					case client.tkt.mdsjunction:
						mdsjunctionload(tk, this)
						break
					case client.tkt.mdssvcnv:
						mdssvcnvload(tk, this)
						break
					case client.tkt.mds3:
						mds3_load(tk, this)
						break
					case client.tkt.bedgraphdot:
						bedgraphdot_load(tk, this)
						break
					case client.tkt.mdsexpressionrank:
						mdsexpressionrankload(tk, this)
						break
					case client.tkt.aicheck:
						aicheckloadsubpanel(tk, this, thispanel)
						break
				}
			}
		}
		this.clean_subpanel()
	}

	new_tk_subpanel(tk, panelrecord) {
		/*
	panelrecord is from block.subpanels[]
	create an instance of it for this track
	okay to keep closure between paneltkinstance with panelrecord
	*/

		// panel instance in this track
		// do not assign chr/start so that it won't match and will trigger track loading
		const obj = {
			height: 30 // default dummy height
		}

		obj.gtksubpanel = tk.gtksubpanels.append('g').on('mousedown', event => {
			// scrolling a sub panel

			event.preventDefault()
			const body = d3select(document.body)
			const x = event.clientX

			body
				.on('mousemove', event => {
					panelrecord.coord.g.attr('transform', 'translate(' + (event.clientX - x) + ',0)')

					for (const t2 of this.tklst) {
						if (t2.hidden) continue
						const t2panel = t2.subpanels.find(
							i => i.chr == panelrecord.chr && i.start == panelrecord.start && i.stop == panelrecord.stop
						)
						if (t2panel) {
							t2panel.glider.attr('transform', 'translate(' + (event.clientX - x) + ',0)')
						} else {
							console.log(panelrecord.chr, panelrecord.start, panelrecord.stop)
						}
					}
				})
				.on('mouseup', event => {
					body.on('mousemove', null).on('mouseup', null)
					const xoff = event.clientX - x
					if (xoff == 0) return
					// set new view range
					const bpspan = panelrecord.stop - panelrecord.start // bp span won't change when panning
					const dist = Math.ceil((Math.abs(xoff) * bpspan) / panelrecord.width)
					let shiftback = false
					if (xoff > 0) {
						// to left
						if (panelrecord.start <= 0) {
							shiftback = true
						} else {
							if (panelrecord.start < dist) {
								panelrecord.start = 0
								panelrecord.stop = dist
							} else {
								panelrecord.start -= dist
								panelrecord.stop -= dist
							}
						}
					} else {
						// to right
						const l = this.genome.chrlookup[panelrecord.chr.toUpperCase()].len
						if (panelrecord.stop >= l) {
							shiftback = true
						} else {
							if (panelrecord.stop + dist > l) {
								panelrecord.stop = l
								panelrecord.start = panelrecord.stop - bpspan
							} else {
								panelrecord.start += dist
								panelrecord.stop += dist
							}
						}
					}
					if (shiftback) {
						panelrecord.coord.g.transition().attr('transform', 'translate(0,0)')
						for (const t2 of this.tklst) {
							if (t2.hidden) continue
							const t2panel = t2.subpanels.find(
								i => i.chr == panelrecord.chr && i.start == panelrecord.start && i.stop == panelrecord.stop
							)
							if (t2panel) {
								t2panel.glider.transition().attr('transform', 'translate(0,0)')
							}
						}
						return
					}
					// subpanel panned, reload tracks
					// for this, must cancel block pan memory so reloading some client-rendered tracks (junction) won't be affected
					delete this.pannedpx
					this.add_subpanel()
				})
		})

		obj.subpaneltkbgrect = obj.gtksubpanel.append('rect').attr('fill', 'white').attr('fill-opacity', 0)

		obj.glider = obj.gtksubpanel.append('g')

		// important!

		if (tk.type == client.tkt.bedj) {
			obj.img = obj.glider.append('image')
		} else if (tk.type == client.tkt.bigwig) {
			obj.img = obj.glider.append('image')
		} else if (tk.type == client.tkt.bigwigstranded) {
			obj.strand1 = {
				img: obj.glider.append('image')
			}
			obj.strand2 = {
				img: obj.glider.append('image')
			}
		} else if (tk.type == client.tkt.aicheck) {
			obj.img = obj.glider.append('image')
		}

		obj.cloak = obj.gtksubpanel.append('g').attr('transform', 'scale(0)')
		obj.cloakbox = obj.cloak.append('rect').attr('fill', 'white').attr('fill-opacity', 0)
		obj.cloaktext = obj.cloak
			.append('text')
			.attr('id', 'loadingCloak2')
			.text('Loading ...')
			.attr('fill', common.defaultcolor)
			.attr('fill-opacity', 0)
			.attr('font-weight', 'bold')
			.attr('font-size', '18px')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')

		return obj
	}

	clean_subpanel() {
		// remove excess panels
		let removed = false
		for (const tk of this.tklst) {
			if (tk.hidden) continue
			while (tk.subpanels.length > this.subpanels.length) {
				const p = tk.subpanels.pop()
				p.gtksubpanel.remove()
				removed = true
			}
		}
		if (removed) {
			this.blocksetw()
		}
	}

	tkcloakon_subpanel(panel) {
		panel.cloak.attr('transform', 'scale(1)')
		panel.cloakbox
			.attr('width', panel.width)
			.attr('height', panel.height)
			.transition()
			.duration(600)
			.attr('fill-opacity', 0.5)
		panel.cloaktext
			.attr('x', panel.width / 2)
			.attr('y', panel.height / 2)
			.transition()
			.duration(600)
			.attr('fill-opacity', 1)
		if (panel.gerror) {
			panel.gerror.remove()
		}
	}

	tkcloakoff_subpanel(panel, data) {
		panel.cloak.attr('transform', 'scale(0)')
		panel.cloakbox.attr('fill-opacity', 0)
		panel.cloaktext.attr('fill-opacity', 0)
		panel.glider.attr('transform', 'translate(0,0)')
		if (!data) {
			this.tkerror_subpanel(panel, 'Server error ...')
		} else if (data.error) {
			this.tkerror_subpanel(panel, data.error)
		}
	}

	tkerror_subpanel(panel, msg) {
		panel.gerror = panel.glider
			.append('text')
			.text(msg)
			.attr('x', panel.width / 2)
			.attr('text-anchor', 'middle')
			.attr('y', panel.height / 2)
			.attr('dominant-baseline', 'central')
			.attr('font-size', '14px')
	}

	zoombutton_mouseover(fold, zoomout, button) {
		/* mouse over zoom button
	if there are subpanels, show button for subpanels to allow zoom that panel instead of main rglst
	*/

		if (this.subpanels.length == 0) return
		// has subpanels, show options for zooming subpanels

		{
			const p = button.getBoundingClientRect()
			this.blocktip
				.clear()
				.showunder(button)
				.d.style('top', null)
				.style('bottom', window.innerHeight - p.top - window.pageYOffset + 3 + 'px')
		}

		this.blocktip.d
			.append('div')
			.html('ZOOM ' + (zoomout ? 'OUT' : 'IN') + ' ' + fold + ' FOLDS ON A SUB PANEL')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.style('margin', '5px')

		const table = this.blocktip.d.append('table')

		for (const [panelidx, panel] of this.subpanels.entries()) {
			const tr = table.append('tr')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(panel.chr + ':' + panel.start + '-' + panel.stop)
				.on('click', () => {
					const mid = Math.ceil((panel.start + panel.stop) / 2)
					const span = Math.ceil(
						Math.max((panel.stop - panel.start) * (zoomout ? fold : 1 / fold), panel.width / ntpxwidth)
					)
					const chrlen = this.genome.chrlookup[panel.chr.toUpperCase()].len

					// buggy!
					if (mid < span / 2) {
						panel.start = 0
						panel.stop = span
					} else if (mid + span / 2 > chrlen) {
						panel.stop = chrlen
						panel.start = chrlen - span
					} else {
						panel.start = mid - Math.ceil(span / 2)
						panel.stop = panel.start + span
					}

					panel.start = Math.max(0, panel.start)
					panel.stop = Math.min(panel.stop, chrlen)

					panel.exonsf = panel.width / (panel.stop - panel.start)

					this.blocktip.hide()
					this.add_subpanel()
				})

			/*
		tr.append('td')
			.text('DELETE')
			.attr('class','sja_clbtext')
			.style('font-size','.7em')
			.on('click',()=>{
				this.blocktip.hide()

				const _p = this.subpanels.splice(panelidx,1)[0]
				_p.coord.g0.remove()

				// remove instances of this panel from tracks
				for(const t of this.tklst) {
					if(t.hidden) continue
					const thispanel = t.subpanels.splice( panelidx, 1)[0]
					thispanel.gtksubpanel.remove()
				}

				this.blocksetw()
				this.block_setheight()
			})
			*/
		}
	}

	init_coord_subpanel(panel) {
		/*
	initialize subpanel
	an element from block.subpanels[]
	*/
		panel.coord = {}
		panel.coord.g0 = this.coord.gcoordsubpanels.append('g') // immobile

		// background box works for drag and move
		panel.subpanelbgrect = panel.coord.g0.append('rect').attr('y', -this.coordyp1 - this.rulerheight)
		if (panel.background) {
			panel.subpanelbgrect.attr('fill', panel.background)
		} else {
			panel.subpanelbgrect.attr('fill', 'white').attr('fill-opacity', 0)
		}

		panel.subpanelleftborder = panel.coord.g0
			.append('rect')
			.attr('y', -this.coordyp1 - this.rulerheight)
			.attr('x', -panel.leftpad)
			.attr('width', panel.leftpad)
		if (panel.leftborder) {
			panel.subpanelleftborder.attr('fill', panel.leftborder)
		} else {
			panel.subpanelleftborder.attr('fill', 'white').attr('fill-opacity', 0)
		}

		panel.coord.g = panel.coord.g0.append('g') // scrolls
		panel.coord.axesg = panel.coord.g.append('g')
		panel.coord.grab = panel.coord.g
			.append('rect')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('y', -this.coordyp1 - this.rulerheight)
			.on('mousedown', event => {
				this.rulermousedown(event, panel)
					.then(tmp => {
						panel.busy = false
						const [toofine, startpx, spanpx] = tmp
						/*
				if(panel.toselecthlregion) {
					this.busy=false
					delete this.toselecthlregion
					const [startidx,startpos] = this.pxoff2region(startpx)
					const [stopidx, stoppos] = this.pxoff2region(startpx+spanpx)
					const chr=this.rglst[startidx].chr
					if(chr==this.rglst[stopidx].chr) {
						this.addhlregion( chr, Math.min(startpos, stoppos), Math.max(startpos, stoppos) )
					}
					return
				}
				*/
						// zoom in
						if (toofine) {
							// too fine won't zoom in
							return
						}
						panel.zoomedin = true
						panel.start += Math.ceil(startpx / panel.exonsf)
						panel.stop = panel.start + Math.ceil(spanpx / panel.exonsf)
						panel.exonsf = panel.width / (panel.stop - panel.start)

						// must cancel block pan memory so reloading some client-rendered tracks (junction) won't be affected
						delete this.pannedpx
						this.add_subpanel()
					})
					.catch(e => {
						if (e == 'busy') return
						this.error(e.message)
						console.log(e.stack)
					})
			})
	}

	updateruler_subpanel(panel) {
		// panel is element from block.subpanels[]

		panel.coord.g.attr('transform', 'translate(0,0)')

		// if at bplevel, will show nt seq
		panel.coord.height =
			this.coordyp1 + this.rulerheight + this.coordyp2 + (panel.stop - panel.start <= panel.width ? baseheight + 2 : 0)
		this.update_ruler_height()

		panel.coord.grab.attr('height', panel.coord.height)
		panel.coord.axesg.selectAll('*').remove()

		const pxpernt = panel.width / (panel.stop - panel.start) // # pixel per nt

		{
			const rulerg = panel.coord.axesg.append('g')
			// 0-based to 1-based
			const domain = [panel.start + 1, panel.stop + 1]
			const range = [pxpernt / 2, panel.width - pxpernt / 2] // ADJUST shift half nt px width to right

			// measure coordinate text width to decide how many ticks to use
			let maxticknumber
			{
				let w
				const pos = panel.stop
				rulerg
					.append('text')
					.text(pos > 1000000 ? d3format('s')(pos) : d3format(',d')(pos))
					.attr('font-size', this.rulerfontsize)
					.each(function () {
						w = this.getBBox().width
					})
					.remove()
				maxticknumber = Math.floor(panel.width / (w + 60))
			}

			const scale = scaleLinear().domain(domain).range(range)
			const axis = axisTop().scale(scale).tickSize(this.rulerticksize).ticks(maxticknumber)
			if (panel.stop - panel.start > 1000000) {
				axis.tickFormat(d3format('s'))
			} else {
				axis.tickFormat(d3format(',d'))
			}
			axisstyle({
				axis: rulerg.call(axis),
				color: 'black',
				showline: true,
				fontsize: this.rulerfontsize
			})
		}

		if (panel.stop - panel.start <= panel.width) {
			// get nt sequence
			const seqg = panel.coord.axesg.append('g').attr('transform', 'translate(0,' + this.coordyp2 + ')')
			this.getntsequence4ruler(panel, seqg)
		}
	}

	/** __subpanel ends **/

	error(m) {
		sayerror(this.errdiv, m)
	}

	moremenu(tip) {
		// a row of buttons
		{
			const row = tip.d.append('div').style('margin-bottom', '10px')

			// svg
			row
				.append('button')
				.text('Export SVG')
				.on('click', () => {
					tip.hide()
					import('./block.svg').then(p => {
						p.default(this)
					})
				})

			// dna
			row
				.append('button')
				.text('Reference DNA sequence')
				.on('click', () => {
					maygetdna(this, tip)
				})

			// ideogram
			if (this.genome.hasIdeogram) {
				row
					.append('button')
					.text((this.ideogram.visible ? 'Hide' : 'Show') + ' ideogram')
					.on('click', () => {
						this.toggleIdeogram()
						tip.hide()
					})
			}
		}

		// highlight region
		{
			const div = tip.d
				.append('div')
				.style('border', 'solid 1px #eee')
				.style('padding', '10px')
				.style('margin', '20px 0px 20px 0px')
			const row = div.append('div')
			row.append('span').text('Highlight').style('opacity', 0.75).style('padding-right', '10px')
			row
				.append('button')
				.text('Select a region')
				.on('click', () => {
					tip.clear()
					tip.d.append('div').html('&#9660; drag on the ruler')
					tip.d.transition().style('top', Number.parseInt(tip.d.style('top')) - 60 + 'px')
					this.toselecthlregion = true
				})
			row
				.append('button')
				.text('Enter regions')
				.on('click', () => {
					tip.clear()
					const ta = tip.d.append('textarea').attr('rows', 5).attr('cols', 30)
					const row = tip.d.append('div').style('margin-top', '3px')
					row
						.append('button')
						.text('Submit')
						.on('click', () => {
							const str = ta.property('value').trim()
							if (!str) return
							for (const line of str.split('\n')) {
								const l = line.split(' ')
								if (!l[0]) continue
								const r = coord.string2pos(
									l[0],
									this.genome,
									true // do not extend
								)
								if (!r) continue
								this.addhlregion(r.chr, r.start, r.stop, l[1] || hlregioncolor)
							}
							this.moremenu(tip.clear())
						})
					row
						.append('button')
						.text('Clear')
						.on('click', () => {
							ta.property('value', '')
						})
					tip.d
						.append('div')
						.html(
							'<ul><li>Limited to adding regions to the current chromosome</li><li>One row per region</li><li>Example row: "chr1:123-456 #96FAF8"</li><li>Color is optional, must be hex format</li><li>If provided, separate coordinate and color by space</ul>'
						)
				})

			// list for editing
			if (this.hlregion.lst.length) {
				const div2 = div.append('div').style('margin-top', '10px')
				for (const h of this.hlregion.lst) {
					const row = div2.append('div')
					row
						.append('div')
						.html('&#10005;')
						.style('display', 'inline-block')
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							for (let i = 0; i < this.hlregion.lst.length; i++) {
								const h2 = this.hlregion.lst[i]
								if (h2.chr == h.chr && h2.start == h.start && h2.stop == h.stop) {
									this.hlregion.lst.splice(i, 1)
									h2.rect.remove()
									break
								}
							}
							row.remove()
						})
					row
						.append('span')
						.style('color', '#858585')
						.html('&nbsp;&nbsp;' + h.chr + ':' + h.start + '-' + h.stop + '&nbsp;&nbsp;')
					row
						.append('input')
						.attr('type', 'color')
						.property('value', h.color)
						.on('change', event => {
							h.color = event.target.value
							h.rect.transition().attr('fill', h.color)
						})
				}
			}
		}

		// experimental
		if (!JSON.parse(sessionStorage.getItem('optionalFeatures')).disableBlockExperimentFeatures) {
			tip.d
				.append('div')
				.text('EXPERIMENTAL')
				.style('font-size', '.7em')
				.style('margin', '10px 0px 2px 0px')
				.style('opacity', 0.5)
			tip.d
				.append('button')
				.text('Customize mutation class color')
				.on('click', () => {
					tip.clear()
					client.mclasscolorchangeui(tip)
				})
		}
	}

	initIdeogram(arg) {
		const vpad = 5
		this.ideogram = {
			width: 800,
			height: 20,
			visible: arg.showIdeogram, // boolean, if ideogram is showing or not
			chr: null // current chr, to be set when rglst is available
		}
		this.ideogram.div = this.holder
			.append('div') // place to show ideogram
			.style('position', 'relative')
			.style('width', this.ideogram.width + 'px')
			.style('margin', '5px')

		this.ideogram.canvas = this.ideogram.div
			.append('canvas')
			.attr('width', this.ideogram.width)
			.attr('height', this.ideogram.height)
			.style('margin-top', vpad + 'px')

		this.ideogram.ctx = this.ideogram.canvas.node().getContext('2d')
		this.ideogram.blueBox = this.ideogram.div
			.append('div')
			.style('border', 'solid 1px blue')
			.style('position', 'absolute')
			.style('height', this.ideogram.height + vpad * 2 + 'px')
			.style('top', '0px')
	}
	toggleIdeogram() {
		if (!this.ideogram) return
		this.ideogram.visible = !this.ideogram.visible
		if (!this.ideogram.visible) {
			disappear(this.ideogram.div)
			return
		}
		appear(this.ideogram.div)
		this.updateIdeogram()
	}
	async updateIdeogram() {
		if (!this.ideogram) return
		const currentChr = this.rglst[0].chr
		if (currentChr != this.ideogram.chr) await this.plotIdeogram(currentChr)
		// TODO move blueBox
	}
	async plotIdeogram(chr) {
		if (!this.ideogram) return
		try {
			if (!chr) throw 'unknonw chr to show ideogram'
			this.ideogram.chr = chr
			const data = await dofetch3('ideogram?genome=' + this.genome.name + '&chr=' + chr)
			if (data.error) throw data.error
			if (!Array.isArray(data)) throw 'data is not array'
			console.log(data)
			// TODO plot on canvas
		} catch (e) {
			this.error(e.message || e)
		}
	}

	mds_handle_make(key) {
		// make handle for a mds dataset, also the click menu for that handle
		const ds = this.genome.datasets[key]
		if (!ds) return
		const d0 = this.ctrl.mdsHandleHolder
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '2px')
			.style('border', 'solid 1px black')
		ds.handle = {
			holder: d0
		}
		ds.handle.labelButton = d0
			.append('div')
			.text(ds.label)
			.attr('class', 'sja_handle_green')
			.on('click', async event => {
				this.blocktip.clear().showunder(event.target)

				if (ds.mdsIsUninitiated) {
					const d = await dofetch3(`getDataset?genome=${this.genome.name}&dsname=${ds.label}`)
					if (d.error) throw d.error
					if (!d.ds) throw 'ds missing'
					Object.assign(ds, d.ds)
					delete ds.mdsIsUninitiated
				}

				if (ds.queries) {
					const table = this.blocktip.d.append('table')
					// one tk per tr

					for (const querykey in ds.queries) {
						if (ds.queries[querykey].hideforthemoment) continue

						const findtkindex = this.tklst.findIndex(t => t.mds && t.mds.label == key && t.querykey == querykey)

						const tr = table.append('tr')
						const td1 = tr.append('td')
						if (findtkindex != -1) {
							td1.html('&nbsp;&nbsp;SHOWN').style('color', '#858585').style('font-size', '.8em')
						}

						tr.append('td')
							.append('div')
							.style('padding', '10px 15px')
							.attr('class', 'sja_menuoption')
							.text(ds.queries[querykey].name)
							.on('click', () => {
								this.blocktip.hide()
								if (findtkindex != -1) {
									// shown, to drop
									this.tk_remove(findtkindex)
									return
								}
								this.mds_load_query_bykey(ds, { querykey: querykey })
							})
					}
				}
				if (ds.about) {
					this.blocktip.d
						.append('div')
						.style('margin', '10px')
						.append('span')
						.attr('class', 'sja_clbtext')
						.style('color', '#858585')
						.text('About this dataset')
						.on('click', () => {
							this.blocktip.clear()
							client.make_table_2col(this.blocktip.d, ds.about)
						})
				}
			})
	}

	async mds_load_query_bykey(ds, q) {
		/*
		official ds
		q comes from datasetqueries of embedding, with customizations
		*/

		if (ds.mdsIsUninitiated) {
			const d = await dofetch3(`getDataset?genome=${this.genome.name}&dsname=${ds.label}`)
			if (d.error) throw d.error
			if (!d.ds) throw 'ds missing'
			Object.assign(ds, d.ds)
			delete ds.mdsIsUninitiated
		}

		if (!ds.queries) return console.log('ds.queries{} missing')
		const tk0 = ds.queries[q.querykey]
		if (!tk0) return console.log('querykey not found in ds.queries: ' + q.querykey)

		if (tk0.isgenenumeric) {
			// gene numeric values, show gene search box
			// TODO not doing anything yet
			return
		}

		if (this.tklst.find(t => t.mds && t.mds.label == ds.label && t.querykey == q.querykey)) {
			// already shown
			return
		}

		if (q.singlesample && q.getsampletrackquickfix) {
			const data = await dofetch3('mdssvcnv', {
				method: 'POST',
				body: JSON.stringify({
					genome: this.genome.name,
					dslabel: ds.label,
					querykey: q.querykey,
					gettrack4singlesample: q.singlesample.name
				})
			})
			if (data.error) throw data.error
			if (data.tracks) {
				for (const t of data.tracks) {
					const tk = this.block_addtk_template(t)
					this.tk_load(tk)
				}
			}
		}

		const tk = this.block_addtk_template(tk0)
		tk.mds = ds
		tk.querykey = q.querykey
		if (q.singlesample) {
			// in sampleview, to show all cnvs, not just focal ones
			tk.bplengthUpperLimit = 0
		}
		tk.customization = q

		this.tk_load(tk)
	}

	totalheight() {
		let h = this.coord.height
		for (const t of this.tklst) {
			if (t.hidden) continue
			h += t.height
		}
		return h
	}

	newblock(arg) {
		if (!arg.holder) return this.error('holder missing')
		arg.genome = this.genome
		arg.hostURL = this.hostURL
		arg.jwt = this.jwt
		arg.nobox = true
		return new Block(arg)
	}

	turnOnTrack(arg) {
		const lst = Array.isArray(arg) ? arg : [arg]
		const toadd = []
		for (const t of lst) {
			{
				const [i, tt] = findtrack(this.tklst, t)
				if (tt) {
					// already shown
					continue
				}
			}
			const [i, f] = findtrack(this.genome.tracks, t)
			if (f) {
				toadd.push(f)
			} else {
				toadd.push(t)
			}
		}
		for (const f of toadd) {
			delete f.hidden
			const t = this.block_addtk_template(f)
			this.tk_load(t)
		}
	}
	turnOffTrack(arg) {
		const lst = Array.isArray(arg) ? arg : [arg]
		for (const t of lst) {
			const [idx, f] = findtrack(this.tklst, t)
			if (idx != -1) this.tk_remove(idx)
		}
	}

	showTrackByFile(files) {
		if (!Array.isArray(files)) {
			this.error('showTrackByFile() argument must be array')
			return
		}
		const type2files = new Map()
		for (const f of files) {
			if (!f.type) {
				this.error('.type missing from a file')
				return
			}
			if (!f.file) {
				this.error('.file missing from a file')
				return
			}
			if (!type2files.has(f.type)) type2files.set(f.type, new Set())
			type2files.get(f.type).add(f.file)
		}
		const toremove = this.tklst.filter(t => type2files.has(t.type) && !type2files.get(t.type).has(t.file))
		const toadd = []
		for (const [type, files] of type2files) {
			for (const file of files) {
				const gt = this.genome.tracks.find(t => t.type == type && t.file == file)
				if (gt && !this.tklst.find(t => t.type == type && t.file == file)) {
					// in genome.tracks but not tklst, to show
					toadd.push(gt)
				}
			}
		}
		for (const f of toremove) {
			this.tk_remove(this.tklst.findIndex(t => t.type == f.type && t.file == f.file))
		}
		for (const f of toadd) {
			const t = this.block_addtk_template(f)
			this.tk_load(t)
		}
	}

	/*********** end of class:Block  ************/
}

function findtrack(lst, t) {
	// given track object t, find the identical one in lst[]
	for (const [i, f] of lst.entries()) {
		if (f.type != t.type) continue
		if (t.type == client.tkt.junction) {
			if (t.file || t.url) {
				// t is a single-sample track
				if (f.tracks.length == 1) {
					if (f.tracks[0].file ? f.tracks[0].file == t.file : f.tracks[0].url == t.url) {
						return [i, f]
					}
				} else {
					// a multi-sample track,
				}
			} else if (t.tracks) {
				if (t.tracks.length == 1 && f.tracks.length == 1) {
					// both single sample
					if (f.tracks[0].file ? f.tracks[0].file == t.tracks[0].file : f.tracks[0].url == t.tracks[0].url) {
						return [i, f]
					}
				} else {
					// number of samples not matching
				}
			} else {
				// should throw exception
			}
			continue
		}
		// all other track types
		if (f.type == t.type && (f.file ? f.file == t.file : f.url == t.url)) {
			return [i, f]
		}
	}
	return [-1, null]
}

function getrulerunit(span, ticks) {
	// not in use
	const u = []
	for (let i = 0; i < 10; i++) {
		const p = Math.pow(10, i)
		u.push(p)
		u.push(2 * p)
		u.push(5 * p)
	}
	for (let j of u) {
		if (Math.floor(span / j) <= ticks) {
			return j
		}
	}
}

function makecoordinput(bb, butrow) {
	bb.coord.inputtip = new Menu({
		padding: '0px',
		offsetX: 0,
		offsetY: 0
	})

	bb.coord.input = butrow
		.append('input')
		.attr('type', 'text')
		.attr('size', 20)
		.style('margin-left', '10px')
		.style('padding-right', '20px')
		.attr('aria-label', 'Genome browser coordinates')

	bb.coord.inputtipshow = () => {
		bb.coord.inputtip.clear()
		const p = bb.coord.input.node().getBoundingClientRect()
		bb.coord.inputtip.show(p.left, p.top + p.height + 5)
	}

	bb.coord.input
		.on('focus', event => {
			event.target.select()
		})
		.on('keyup', event => {
			bb.zoomedin = false
			bb.pannedpx = undefined
			bb.resized = false
			const input = event.target
			const v = input.value.trim()
			if (v.length <= 1) {
				bb.coord.inputtip.hide()
				return
			}
			if (client.keyupEnter(event)) {
				bb.coord.inputtip.hide()
				input.blur()
				bb.jump_1basedcoordinate(v)
				return
			}
			if (event.code == 'Escape') {
				bb.coord.inputtip.hide()
				if (bb.rglst.length == 1) {
					const r = bb.rglst[0]
					input.value = r.chr + ':' + (r.start + 1) + '-' + (r.stop + 1)
				}
				input.blur()
				return
			}
			if (v.length > 6) return
			debouncer()
		})

	async function genesearch() {
		// gene name lookup
		const v = bb.coord.input.property('value')
		if (!v) return
		bb.coord.inputtipshow()
		try {
			const data = await dofetch3('genelookup', {
				body: { genome: bb.genome.name, input: v }
			})
			if (data.error) throw data.error
			if (!data.hits || data.hits.length == 0) return bb.coord.inputtip.hide()
			for (const s of data.hits) {
				bb.coord.inputtip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(s)
					.on('click', () => {
						bb.coord.inputtip.hide()
						bb.block_jump_gene(s)
					})
			}
		} catch (e) {
			bb.inputerr(e.message || e)
		}
	}

	const debouncer = debounce(genesearch, 300)
}

function allgm2sum(gmlst) {
	const chr2gm = new Map()
	for (const gm of gmlst) {
		if (gm.hidden) {
			continue
		}
		if (!chr2gm.has(gm.chr)) {
			chr2gm.set(gm.chr, [])
		}
		chr2gm.get(gm.chr).push(gm)
	}
	const alllst = []
	for (let [chr, gmlst] of chr2gm.entries()) {
		const elst = []
		for (const m of gmlst) {
			for (const e of m.exon) {
				elst.push([e[0], e[1]])
			}
		}
		const reverse = gmlst[0].strand == '-'
		elst.sort((a, b) => a[0] - b[0])
		let thisregion = elst[0]
		const rglst = []
		for (let i = 1; i < elst.length; i++) {
			const e = elst[i]
			if (e[0] > thisregion[1]) {
				const r = {
					chr: chr,
					bstart: thisregion[0],
					bstop: thisregion[1],
					start: thisregion[0],
					stop: thisregion[1],
					reverse: reverse
				}
				if (reverse) {
					rglst.unshift(r)
				} else {
					rglst.push(r)
				}
				thisregion = e
			} else {
				thisregion[1] = Math.max(thisregion[1], e[1])
			}
		}
		const r = {
			chr: chr,
			bstart: thisregion[0],
			bstop: thisregion[1],
			start: thisregion[0],
			stop: thisregion[1],
			reverse: reverse
		}
		if (reverse) {
			rglst.unshift(r)
		} else {
			rglst.push(r)
		}
		alllst.push(...rglst)
	}
	return [alllst, chr2gm.size]
}

const dnalenlimit = 100000

async function maygetdna(block, tip) {
	tip.clear()
	const regions = []
	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop
		})
	}
	const totallen = regions.reduce((i, j) => i + j.stop - j.start, 0)
	if (totallen > dnalenlimit) {
		tip.d.append('div').text('Please zoom in under ' + common.bplen(dnalenlimit) + ' to get DNA sequence.')
		return
	}
	const lst = []
	for (const r of regions) {
		const coord = r.chr + ':' + (r.start + 1) + '-' + r.stop
		const data = await dofetch3('ntseq', {
			method: 'POST',
			body: JSON.stringify({ genome: block.genome.name, coord })
		})
		lst.push('>' + coord + '\n' + data.seq)
	}
	client.export_data(
		'Reference DNA from ' + block.genome.name,
		[{ text: lst.join('\n') }],
		1,
		1,
		10,
		100,
		tip.d.style('left', '100px')
	)
}

function init_cursorhlbar(block) {
	// highlight bar under the cursor
	// default fill color is registered on block, as the bar can be changed by actions in certain tracks
	// eg hover over splice junction. this allows the style to be restored to the bar
	block.cursorhlbarFillColor = '#FFFF99'
	block.cursorhlbar = block.gbase.append('rect').attr('fill', block.cursorhlbarFillColor)

	block.gbase
		.on('mousemove', event => {
			// pointer() accounts for whether block is rotated or not
			const x = pointer(event, block.gbase.node())[0]

			let xoffset = block.leftheadw + block.lpad

			if (x < xoffset) {
				block.cursorhlbar.attr('width', 0)
				return
			}

			// if cursor in main block or sub panels, light up bar
			let barx, barw

			if (x < xoffset + block.width) {
				// in main block
				barw = Math.max(2, block.exonsf)
				barx = x
				if (block.exonsf >= 2) {
					// at bp level, highlight to a bp
					barx -= (x - xoffset) % block.exonsf
				}
			} else {
				xoffset += block.width
				for (const panel of block.subpanels) {
					xoffset += panel.leftpad
					if (x < xoffset + panel.leftpad) {
						// inside left padding, no show
						break
					}
					if (x < xoffset + panel.leftpad + panel.width) {
						// inside this panel
						barw = Math.max(2, panel.exonsf)
						barx = x
						if (panel.exonsf >= 2) {
							barx -= (x - xoffset - panel.leftpad) % panel.exonsf
						}
						break
					}
					xoffset += panel.leftpad + panel.width
				}
			}

			if (barx) {
				block.cursorhlbar.attr('x', barx).attr('width', barw).attr('height', block.totalheight())
			}
		})
		.on('mouseout', () => {
			block.cursorhlbar.attr('width', 0)
		})
}

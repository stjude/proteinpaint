import { bplen } from '#shared/common.js'
import * as client from './client'
import { rgb as d3rgb } from 'd3-color'
import { hicparsestat, hicparsefragdata } from '../tracks/hic/data/parseData.ts'
import { ColorScale } from '#dom'

/*
single-sample hic
always draw on canvas

3 sources of data
	tk.textdata:
		parse data from raw text input, no server query
	tk.bedfile/bedurl:
		request data from bed file track
	tk.file/url
		load data from .hic straw file





********************** EXPORTED
loadTk()


********************** INTERNAL
makeTk
configPanel
textdata_load
textdata_parseraw
textdata_editUI


*/

const defaultnmeth = 'NONE' // default normalization method, only for juicebox hic

const minimumbinnum_bp = 200 // minimum bin number at bp resolution
const minimumbinnum_frag = 200 // minimum bin number at frag resolution

const labyspace = 5
const insidedomaincolor = '102,102,102'
const docurl_text =
	'https://docs.google.com/document/d/1MQ0Z_AD5moDmaSx2tcn7DyVKGp49TS63pO0cceGL_Ns/edit#heading=h.kr6p4w2zhhwq'

// let hicstraw // loaded on the fly, will result in bundle duplication

export function loadTk(tk: any, block: any) {
	block.tkcloakon(tk)
	block.block_setheight()

	Promise.resolve()
		// .then(() => {
		// 	return import('../tracks/hic/HicApp.ts').then(_ => {
		// 		// hicstraw = p
		// 	})
		// })

		.then(() => {
			if (!tk.uninitialized) return
			// initialize the track
			delete tk.uninitialized

			makeTk(tk, block) // also parse raw text data if any
			if (tk.textdata || tk.bedfile || tk.bedurl) return

			/*
		first time querying a hic file
		hic file is always custom, need to stat the file
		*/

			return client.dofetch2('hicstat?' + (tk.file ? 'file=' + tk.file : 'url=' + tk.url)).then(data => {
				if (data.error) throw data.error
				const err = hicparsestat(tk.hic, data.out)
				if (err) throw err
			})
		})

		.then(() => {
			return setResolution(tk, block)
		})

		.then(() => {
			return mayLoadDomainoverlay(tk)
		})

		.then((): any => {
			if (tk.textdata) return textdata_load(tk, block)

			if (tk.bedfile || tk.bedurl) return bedfile_load(tk, block)

			updateNormalizationArray(tk.hic)

			return loadStrawdata(tk, block)
		})
		.then(() => {
			if (tk.data.length == 0) {
				tk.height_main = 100
				tk.img.attr('width', 0)
				throw tk.name + ': no data in view range'
			}
			drawCanvas(tk, block)
		})
		.catch(err => {
			if (err.stack) {
				console.error(err.stack)
			}
			return typeof err == 'string' ? err : err.message
		})
		.then(errmsg => {
			block.tkcloakoff(tk, { error: errmsg })
			block.block_setheight()
		})
}

function setResolution(tk: any, block: any) {
	/*
	when using text data, no need to set resolution but still need .regions[]
	determine what resolution, if using fragment, will load fragment index
	*/

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = [] as any

	let x = 0

	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: x + (i == 0 ? 0 : 1) * block.regionspace
		})
		x += block.regionspace + r.width
	}

	for (const r of block.subpanels) {
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: x + r.leftpad
		})
		x += r.leftpad + r.width
	}

	tk.regions = regions

	if (tk.textdata || tk.bedfile || tk.bedurl) {
		return
	}

	/*
	following is only for hic straw file
	determine which resolution to use, "bp" for zoomd out to low res, or "frag" for zoomed in at high res
	the same resolution will be shared across all block regions
	find biggest region by bp span, use it's pixel width to determine resolution
	*/
	const maxbpwidth = Math.max(...regions.map(i => i.stop - i.start))
	let resolution_bp = null
	for (const res of tk.hic.bpresolution) {
		if (maxbpwidth / res > minimumbinnum_bp) {
			// this bp resolution is good
			resolution_bp = res
			break
		}
	}
	// if cannot find the finest bp resolution for current zoom, then check available fragment resolution

	return Promise.resolve()
		.then(() => {
			if (resolution_bp) {
				return
			}
			// cannot find bp resolution
			if (!tk.hic.enzymefile || !tk.hic.fragresolution?.length) {
				// no enzyme fragment data (missing enzyme, or fragresolution array is blank)
				// just use finest bp resolution
				resolution_bp = tk.hic.bpresolution[tk.hic.bpresolution.length - 1]
				return
			}

			/*
		bp resolution not applicable, will use frag resolution
		retrieve fragments in each regions, then use the fragment index to determine the resolution (# of fragments)
		*/

			const tasks = [] as any

			// fetch fragments for each region
			for (const r of regions) {
				const arg = {
					getdata: 1,
					getBED: 1,
					file: tk.hic.enzymefile,
					rglst: [{ chr: r.chr, start: r.start, stop: r.stop }],
					genome: block.genome.name
				}
				tasks.push(
					client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
						if (data.error) throw data.error
						if (!data.items) throw '.items[] missing at mapping coord to fragment index'
						//Replace with ParseFragData
						const [err, map, start, stop] = hicparsefragdata(data.items)
						if (err) throw err
						r.frag = {
							id2coord: map,
							startidx: start,
							stopidx: stop
						}
						return
					})
				)
			}
			return Promise.all(tasks)
		})
		.then(() => {
			let resolution_frag
			if (!resolution_bp) {
				const maxfragspan = Math.max(...regions.map(i => i.frag.stopidx - i.frag.startidx))
				for (const v of tk.hic.fragresolution) {
					if (maxfragspan / v > minimumbinnum_frag) {
						resolution_frag = v
						break
					}
				}
				if (!resolution_frag) {
					resolution_frag = tk.hic.fragresolution[tk.hic.fragresolution.length - 1]
				}
			}
			tk.resolution_bp = resolution_bp
			tk.resolution_frag = resolution_frag
			if (resolution_bp) {
				tk.label_resolution.text('Resolution: ' + bplen(resolution_bp))
			} else {
				tk.label_resolution.text('Resolution: ' + resolution_frag + ' fragment' + (resolution_frag > 1 ? 's' : ''))
			}
			return
		})
}

function mayLoadDomainoverlay(tk: any) {
	// must already have tk.regions[]

	if (!tk.domainoverlay || !tk.domainoverlay.inuse) return

	return Promise.resolve().then(() => {
		// fetch domains for each region
		const tasks = [] as any
		for (const r of tk.regions) {
			const arg: any = { getdata: 1, getBED: 1, rglst: [{ chr: r.chr, start: r.start, stop: r.stop }] }
			if (tk.domainoverlay.file) {
				arg.file = tk.domainoverlay.file
			} else {
				arg.url = tk.domainoverlay.url
			}
			tasks.push(
				client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
					if (data.error) throw data.error
					if (!data.items || data.items.length == 0) return
					r.domainlst = data.items
					// each item is a domain, may support inter-chr domains by parsing json
				})
			)
		}
		return Promise.all(tasks)
	})
}

function textdata_load(tk: any, block: any) {
	/*
	at the end, set tk.data[]
	*/
	tk.data = []
	for (const i of tk.textdata.lst) {
		const point = coordpair2plotpoint(i.chr1, i.start1, i.stop1, i.chr2, i.start2, i.stop2, block)
		if (point) {
			point.push(i.value)
			tk.data.push(point)
		}
	}
}

function coordpair2plotpoint(
	chr1: string,
	start1: number,
	stop1: number,
	chr2: string,
	start2: number,
	stop2: number,
	block: any
) {
	let left1 = map_point(chr1, start1, block)
	let left2 = map_point(chr1, stop1, block)
	if (left1 == -1 && left2 == -1) return

	if (left1 == -1) left1 = left2
	else if (left2 == -1) left2 = left1

	let right1 = map_point(chr2, start2, block)
	let right2 = map_point(chr2, stop2, block)
	if (right1 == -1 && right2 == -1) return

	if (right1 == -1) right1 = right2
	else if (right2 == -1) right2 = right1

	if (left1 < right1) return [left1, left2, right1, right2]
	return [right1, right2, left1, left2]
}

function map_point(chr: string, pos: number, block: any) {
	const lst = block.seekcoord(chr, pos)
	for (const r of lst) {
		if (r.ridx != undefined) {
			if (r.x > 0 && r.x < block.width) return r.x
		} else if (r.subpanelidx != undefined) {
			return r.x
		}
	}
	return -1
}

function bedfile_load(tk: any, block: any) {
	/*
	at end, set tk.data[]
	*/
	const arg: any = {
		getdata: 1,
		getBED: 1,
		rglst: tk.regions.map(i => {
			return { chr: i.chr, start: i.start, stop: i.stop }
		}),
		genome: block.genome.name
	}
	if (tk.bedfile) {
		arg.file = tk.bedfile
	} else {
		arg.url = tk.bedurl
		if (tk.bedindexURL) arg.indexURL = tk.bedindexURL
	}

	return client.dofetch2('tkbedj', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
		if (data.error) throw data.error
		tk.data = []
		if (!data.items) {
			return
		}
		// remove duplicating lines
		const usedlines = new Set()
		/*
		used lines from the bed file
		for each uniq interaction, it would have a duplicating line
		e.g. {chr1, start1, stop1, rest:{chr2,start2,stop2} }
		will have duplicating line of "chr2 start2 stop2 chr1 start1 stop1", and this line should be skipped
		*/

		for (const i of data.items) {
			const skipline = i.chr + ' ' + i.start + ' ' + i.stop + ' ' + i.rest[0] + ' ' + i.rest[1] + ' ' + i.rest[2]
			if (usedlines.has(skipline)) continue

			const thisline = i.rest[0] + ' ' + i.rest[1] + ' ' + i.rest[2] + ' ' + i.chr + ' ' + i.start + ' ' + i.stop
			usedlines.add(thisline)

			const chr2 = i.rest[0]
			const start2 = Number.parseInt(i.rest[1])
			const stop2 = Number.parseInt(i.rest[2])
			if (Number.isNaN(start2)) throw 'invalid start2 position: ' + i.rest[1]
			if (Number.isNaN(stop2)) throw 'invalid stop2 position: ' + i.rest[2]

			const value = Number.parseFloat(i.rest[3])
			if (Number.isNaN(value)) throw 'invalid value: ' + i.rest[3]
			const point = coordpair2plotpoint(i.chr, i.start, i.stop, chr2, start2, stop2, block)
			if (point) {
				point.push(value)
				tk.data.push(point)
			}
		}
	})
}

/** Generally NONE is not listed in the hicstraw normalization array.
 * Include here before loading the hicdata. Fixes issue with the
 * dropdown not showing NONE when tk.normalizationmethod == NONE. */
function updateNormalizationArray(hic: any) {
	if (hic.normalization?.length > 0 && !hic.normalization.includes(defaultnmeth)) {
		hic.normalization.unshift(defaultnmeth)
	}
}

function loadStrawdata(tk: any, block: any): Promise<string | undefined> {
	/*
	at the end, set tk.data[]
	*/

	const resolution_bp = tk.resolution_bp
	const resolution_frag = tk.resolution_frag

	// coord string for querying to use for each region
	for (const r of tk.regions) {
		r._str =
			(tk.hic.nochr ? r.chr.replace('chr', '') : r.chr) +
			':' +
			(resolution_bp ? r.start + ':' + r.stop : r.frag.startidx + ':' + r.frag.stopidx)
	}

	const tasks = [] as any

	type RegionPar = {
		jwt: any
		file?: string
		url?: string
		pos1: number
		pos2: number
		nmeth: string
		mincutoff: number
		resolution?: number
		isfrag?: boolean
	}

	// 1: load data within each region

	for (const [i, r] of tk.regions.entries()) {
		const par: RegionPar = {
			jwt: block.jwt,
			file: tk.file,
			url: tk.url,
			pos1: r._str,
			pos2: r._str,
			nmeth: tk.normalizationmethod,
			mincutoff: tk.mincutoff
		}
		if (resolution_bp) {
			par.resolution = resolution_bp
		} else {
			par.resolution = resolution_frag
			par.isfrag = true
		}
		tasks.push(
			client
				.dofetch2('hicdata', {
					method: 'POST',
					body: JSON.stringify(par)
				})
				.then(data => {
					if (data.error) throw data.error
					if (!data.items || data.items.length == 0) {
						// a region have no data
						return null
					}
					return {
						items: data.items,
						regionidx: i
					}
				})
		)
	}

	// 2: load data from each pair of regions

	for (let i = 0; i < tk.regions.length - 1; i++) {
		for (let j = i + 1; j < tk.regions.length; j++) {
			const par: RegionPar = {
				jwt: block.jwt,
				file: tk.file,
				url: tk.url,
				pos1: tk.regions[i]._str,
				pos2: tk.regions[j]._str,
				nmeth: tk.normalizationmethod,
				mincutoff: tk.mincutoff
			}
			if (resolution_bp) {
				par.resolution = resolution_bp
			} else {
				par.resolution = resolution_frag
				par.isfrag = true
			}
			tasks.push(
				client
					.dofetch2('hicdata', {
						method: 'POST',
						body: JSON.stringify(par)
					})
					.then(data => {
						if (data.error) throw { message: data.error }
						if (!data.items || data.items.length == 0) {
							return null
						}
						return {
							items: data.items,
							leftregionidx: i,
							rightregionidx: j
						}
					})
			)
		}
	}

	return Promise.all(tasks).then(data => {
		return parseStrawData(data, resolution_bp, resolution_frag, tk, block)
	})
}

function parseStrawData(datalst: any, resolution_bp: number, resolution_frag: number, tk: any, block: any) {
	tk.data = []

	for (const data of datalst) {
		if (!data) {
			// no data over a particular region or pair
			continue
		}

		let r_left,
			r_right,
			fs_left, // # pixel per bp
			fs_right

		// using the same logic in tracks/hi.ts, inherently related to how straw generates data
		let firstisleft = false

		if (data.regionidx != undefined) {
			// single region
			r_left = r_right = tk.regions[data.regionidx]
			fs_left = fs_right = r_left.width / (r_left.stop - r_left.start)
			firstisleft = true // doesn't matter
		} else {
			// pair of regions
			r_left = tk.regions[data.leftregionidx]
			fs_left = r_left.width / (r_left.stop - r_left.start)
			r_right = tk.regions[data.rightregionidx]
			fs_right = r_right.width / (r_right.stop - r_right.start)

			firstisleft = tk.hic.chrorder.indexOf(r_left.chr) < tk.hic.chrorder.indexOf(r_right.chr)
		}

		for (const [n1, n2, v] of data.items) {
			/*
			n1: coord of one point
			n2: coord of the other point
			v:  value
			*/

			let coord1, // bp position
				coord2,
				span1, // bp span
				span2

			if (resolution_frag) {
				// fragment resolution

				// the beginning of fragment index
				const idx_left = firstisleft ? n1 : n2
				const idx_right = firstisleft ? n2 : n1

				let a = r_left.frag.id2coord.get(idx_left)
				if (!a) {
					a = r_right.frag.id2coord.get(idx_left)
					if (!a) return 'unknown frag id in region ' + data.leftregionidx + ': ' + idx_left
				}
				coord1 = a[0]
				span1 = a[1] - a[0]

				// the end of fragment id of a, may be out of range!
				if (r_left.frag.id2coord.has(idx_left + resolution_frag)) {
					const x = r_left.frag.id2coord.get(idx_left + resolution_frag)
					span1 = x[1] - coord1
				}

				let b = r_right.frag.id2coord.get(idx_right)
				if (!b) {
					b = r_left.frag.id2coord.get(idx_right)
					if (!b) return 'unknown frag id in region ' + data.rightregionidx + ': ' + idx_right
				}
				coord2 = b[0]
				span2 = b[1] - b[0]

				// the end of fragment id of b
				if (r_right.frag.id2coord.has(idx_right + resolution_frag)) {
					const x = r_right.frag.id2coord.get(idx_right + resolution_frag)
					span2 = x[1] - coord2
				}
			} else {
				// bp resolution
				coord1 = firstisleft ? n1 : n2
				coord2 = firstisleft ? n2 : n1
				span1 = span2 = resolution_bp
			}

			/*
			if(coord1>coord2) {
				// flip? why?
				let x=coord2
				coord2=coord1
				coord1=x
				x=span2
				span2=span1
				span1=x
			}
			*/

			// if the contact is inside a domain
			let insidedomain = false
			if (tk.domainoverlay && tk.domainoverlay.inuse) {
				if (data.regionidx != undefined) {
					// single region
					if (r_left.domainlst) {
						if (r_left.domainlst.find(i => i.start <= coord1 && i.stop >= coord2)) {
							insidedomain = true
						}
					}
				} else {
					// pair of region
					// only look for overlapping regions
				}
			}

			// on-screen x start/stop of left/right bins
			// x positions remain constant by screezing or shifting side

			if (data.leftregionidx != undefined && r_left.chr == r_right.chr) {
				// a pair of regions both from same chr
				// in case the pair overlaps, contact points will need to be duplicated to appear symmetrical
				if (
					coord1 > r_left.start - span1 &&
					coord1 < r_left.stop &&
					coord2 > r_right.start - span2 &&
					coord2 < r_right.stop
				) {
					const left1 = r_left.x + fs_left * (coord1 - r_left.start)
					const left2 = left1 + fs_left * span1
					const right1 = r_right.x + fs_right * (coord2 - r_right.start)
					const right2 = right1 + fs_right * span2
					tk.data.push([left1, left2, right1, right2, v, insidedomain])
				}

				if (coord2 > r_left.start - span2 && coord2 < r_left.stop && coord1 > r_right.start && coord1 < r_right.stop) {
					const left1 = r_left.x + fs_left * (coord2 - r_left.start)
					const left2 = left1 + fs_left * span2
					const right1 = r_right.x + fs_right * (coord1 - r_right.start)
					const right2 = right1 + fs_right * span1
					tk.data.push([left1, left2, right1, right2, v, insidedomain])
				}
			} else {
				// single region
				const left1 = r_left.x + fs_left * (coord1 - r_left.start)
				const left2 = left1 + fs_left * span1
				const right1 = r_right.x + fs_right * (coord2 - r_right.start)
				const right2 = right1 + fs_right * span2
				tk.data.push([left1, left2, right1, right2, v, insidedomain])
			}
		}
	}

	drawCanvas(tk, block)

	return
}

function drawCanvas(tk: any, block: any) {
	/* call when:
		finish loading data
		changing max value, min cutoff, color
	*/

	if (tk.data.length == 0) return

	let rgbstring
	{
		const t = d3rgb(tk.color)
		rgbstring = t.r + ',' + t.g + ',' + t.b
	}

	const canvas = tk.hiddencanvas.node()

	const canvaswidth = block.width + block.subpanels.reduce((i, j) => i + j.leftpad + j.width, 0)

	// dynamic height
	let canvasheight = 0
	if (tk.mode_hm) {
		/*
		at tiny region the span from data may be huge, limit it
		*/
		canvasheight = Math.min(
			canvaswidth,
			tk.data.reduce((i, j) => Math.max(i, (j[3] - j[0]) / 2), 0)
		)
	} else if (tk.mode_arc) {
		for (const i of tk.data) {
			const arcxspan = (i[2] + i[3]) / 2 - (i[0] + i[1]) / 2
			const h = arcxspan / 2 / Math.tan((Math.PI - tk.arcangle / 2) / 2)
			canvasheight = Math.max(canvasheight, h)
		}
	}

	canvas.width = canvaswidth
	canvas.height = canvasheight

	const ctx = canvas.getContext('2d')
	if (window.devicePixelRatio > 1) {
		canvas.width = canvaswidth * window.devicePixelRatio
		canvas.height = canvasheight * window.devicePixelRatio
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
	}

	// the max value for saturated color, color scale
	let maxv

	// new method of using percentile
	{
		const values = tk.data.map(i => i[4])
		values.sort((i, j) => i - j)
		maxv = values[Math.floor((values.length * tk.percentile_max) / 100)]
	}

	resize_label(tk, block)

	for (const [left1, left2, right1, right2, value, insidedomain] of tk.data) {
		if (value < tk.mincutoff) {
			continue
		}

		// diamond
		// color of the diamond

		let color
		if (insidedomain) {
			/*
			const r = 200+Math.floor( 50* (maxv-value) / maxv)
			color = 'rgb('+r+','+r+','+r+')'
			*/
			color = 'rgba(' + insidedomaincolor + ',' + (value / maxv).toFixed(2) + ')'
		} else {
			/*
			const r = Math.floor( 255* (maxv-value) / maxv)
			color = 'rgb(255,'+r+','+r+')'
			*/
			color = 'rgba(' + rgbstring + ',' + (value / maxv).toFixed(2) + ')'
		}

		if (tk.mode_hm) {
			ctx.fillStyle = color
			ctx.beginPath()

			let x1,
				y1, // top
				x2,
				y2, // left
				x3,
				y3, // bottom
				x4,
				y4 // top
			if (tk.pyramidup) {
				x1 = (left1 + right2) / 2
				y1 = canvasheight - (right2 - left1) / 2
				x2 = (left1 + right1) / 2
				y2 = canvasheight - (right1 - left1) / 2
				x3 = (left2 + right1) / 2
				y3 = canvasheight - (right1 - left2) / 2
				x4 = (left2 + right2) / 2
				y4 = canvasheight - (right2 - left2) / 2
			} else {
				x1 = (left2 + right1) / 2
				y1 = (right1 - left2) / 2
				x2 = (left1 + right1) / 2
				y2 = (right1 - left1) / 2
				x3 = (left1 + right2) / 2
				y3 = (right2 - left1) / 2
				x4 = (left2 + right2) / 2
				y4 = (right2 - left2) / 2
			}

			ctx.moveTo(x1, y1)
			ctx.lineTo(x2, y2)
			ctx.lineTo(x3, y3)
			ctx.lineTo(x4, y4)

			ctx.closePath()
			ctx.fill()
		} else if (tk.mode_arc) {
			/* in an arc file converted from hic
			(left1+left2) is bigger than (right1+right2)
			following is to ensure not to get negative arcxspan and radius
			*/
			const a = (left1 + left2) / 2
			const b = (right1 + right2) / 2
			const arcxspan = Math.abs(a - b)
			const centerx = Math.min(a, b) + arcxspan / 2
			const radius = arcxspan / 2 / Math.sin(tk.arcangle / 2)
			let centery, startangle, endangle
			if (tk.pyramidup) {
				centery = canvasheight + radius * Math.cos(tk.arcangle / 2)
				startangle = Math.PI + (Math.PI - tk.arcangle) / 2
				endangle = startangle + tk.arcangle
			} else {
				centery = -radius * Math.cos(tk.arcangle / 2)
				startangle = (Math.PI - tk.arcangle) / 2
				endangle = startangle + tk.arcangle
			}
			ctx.strokeStyle = color
			ctx.beginPath()
			ctx.arc(centerx, centery, radius, startangle, endangle)
			ctx.stroke()
		}
	}

	tk.img.attr('width', canvaswidth).attr('height', canvasheight).attr('xlink:href', canvas.toDataURL())

	tk.colorScale.domain = [0, maxv]
	tk.colorScale.markedValue = tk.mincutoff
	tk.colorScale.updateScale()

	tk.height_main = tk.toppad + Math.max(tk.left_labelheight, canvasheight) + tk.bottompad
}

function resize_label(tk: any, block: any) {
	tk.leftLabelMaxwidth = tk.colorScale.barwidth
	tk.tklabel.each(function (this: any) {
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
	})
	if (tk.label_resolution) {
		tk.label_resolution.each(function (this: any) {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	}
	block.setllabel()
}

function makeTk(tk: any, block: any) {
	/*
	call only once to initialize
	also parse text data
	*/

	if (tk.textdata) {
		if (!tk.textdata.raw) throw '.raw missing from textdata'
		const err = textdata_parseraw(tk, block)
		if (err) throw 'Error with text data: ' + err
	}

	if (tk.mode_hm == undefined) tk.mode_hm = true
	if (tk.mode_arc == undefined) tk.mode_arc = false
	if (tk.mode_hm && tk.mode_arc) {
		tk.mode_arc = false
	} else if (!tk.mode_hm && !tk.mode_arc) {
		tk.mode_hm = true
	}

	if (!tk.color) tk.color = '#ff0000'

	tk.arcangle = Math.PI / 2 // make configurable

	if (tk.pyramidup == undefined) tk.pyramidup = true

	tk.hic.genome = block.genome
	if (tk.hic.enzyme) {
		if (block.genome.hicenzymefragment) {
			const e = block.genome.hicenzymefragment.find(i => i.enzyme.toUpperCase() == tk.hic.enzyme.toUpperCase())
			if (e) {
				tk.hic.enzymefile = e.file
			} else {
				block.error('unknown Hi-C enzyme: ' + tk.hic.enzyme)
				delete tk.hic.enzyme
			}
		} else {
			block.error('Hi-C enzyme fragment not available for this genome')
			delete tk.hic.enzyme
		}
	}

	if (!tk.percentile_max) {
		tk.percentile_max = 90
	}

	if (tk.mincutoff == undefined) {
		tk.mincutoff = 0
	}
	if (!tk.normalizationmethod) {
		tk.normalizationmethod = defaultnmeth
	}

	let laby = labyspace + block.labelfontsize

	if (tk.file || tk.url) {
		// straw file
		tk.label_resolution = block.maketklefthandle(tk, laby).attr('class', null)
		laby += labyspace + block.labelfontsize
	}

	{
		// Render the color scale in the left label
		const barheight = 14
		const barwidth = 100
		const space = 1
		const holder = tk.gleft
			.append('g')
			.attr('transform', `scale(1), translate(${block.tkleftlabel_xshift - barwidth}, ${laby})`)

		tk.colorScale = new ColorScale({
			barheight,
			barwidth,
			//data will update after loading data
			domain: [0, 1],
			fontSize: 12,
			height: 45,
			width: 120,
			holder,
			colors: ['white', tk.color],
			position: `6,${barheight + space}`,
			ticks: 2,
			tickSize: 2,
			markedValue: tk.mincutoff
		})

		laby += barheight + 10 + block.labelfontsize
	}

	laby += 10

	tk.left_labelheight = laby

	tk.img = tk.glider.append('image')

	// sneak canvas, render graph then copy to tk.img for showing
	tk.hiddencanvas = block.holder.append('canvas').style('display', 'none')

	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})
}

function configPanel(tk: any, block: any) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())

	if (tk.textdata) {
		tk.tkconfigtip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('margin-bottom', '10px')
			.text('Edit interaction data')
			.on('click', () => {
				textdata_editUI(tk, block)
			})
	}

	{
		// color
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		row.append('span').text('Change color')
		row
			.append('input')
			.style('margin-left', '5px')
			.attr('type', 'color')
			.property('value', tk.color)
			.on('change', (event: MouseEvent) => {
				tk.color = (event.target as HTMLInputElement).value
				tk.colorScale.colors[tk.colorScale.colors.length - 1] = tk.color
				tk.colorScale.updateScale()
				drawCanvas(tk, block)
			})
	}

	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		row
			.append('input')
			.attr('type', 'number')
			.style('width', '40px')
			.property('value', tk.percentile_max)
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				const v = Number.parseFloat(event.target.value)
				if (Number.isNaN(v) || v <= 0 || v >= 100) {
					alert('Please enter a value between 0 and 100')
					return
				}
				tk.percentile_max = v
				drawCanvas(tk, block)
			})
		row.append('span').html('&nbsp;percentile for color scale max')
	}

	// min cutoff
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		row
			.append('input')
			.attr('type', 'number')
			.style('width', '50px')
			.property('value', tk.mincutoff)
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				const v = Number.parseFloat(event.target.value)
				if (Number.isNaN(v)) {
					alert('Please enter a valid number')
					return
				}
				tk.mincutoff = v
				loadTk(tk, block)
			})
		row.append('span').html('&nbsp;for minimum cutoff value')
		row
			.append('div')
			.style('font-size', '.8em')
			.style('opacity', 0.5)
			.html('Interactions with scores &le; cutoff will not be shown.')
	}

	if (tk.file || tk.url) {
		// hic straw normalization method
		const normalization = tk.hic.normalization
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		row.append('span').html('Normalization&nbsp;')
		if (tk.hic.normalization.length > 0) {
			const s = row.append('select').on('change', () => {
				const ss = s.node()
				tk.normalizationmethod = ss.options[ss.selectedIndex].innerHTML
				loadTk(tk, block)
			})
			for (const method of normalization) s.append('option').text(method)
			for (const o of s.node().options) {
				if (o.innerHTML == tk.normalizationmethod) {
					o.selected = true
					break
				}
			}
		} else {
			row.append('span').text(defaultnmeth)
		}
	}

	// domain overlay
	if (tk.domainoverlay) {
		// equipped with domain overlay data
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		row.append('span').html('Overlay with ' + tk.domainoverlay.name + ' domains&nbsp;')
		row
			.append('button')
			.text(tk.domainoverlay.inuse ? 'No' : 'Yes')
			.on('click', () => {
				tk.tkconfigtip.hide()
				tk.domainoverlay.inuse = !tk.domainoverlay.inuse
				loadTk(tk, block)
			})
	}

	// arc/hm
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px')
		const id = Math.random().toString()
		row
			.append('input')
			.attr('name', id)
			.attr('id', id + '1')
			.attr('type', 'radio')
			.property('checked', tk.mode_hm)
			.on('change', event => {
				if (event.target.checked) {
					tk.mode_hm = true
					tk.mode_arc = false
				} else {
					tk.mode_hm = false
					tk.mode_arc = true
				}
				drawCanvas(tk, block)
				block.block_setheight()
				//tk.tkconfigtip.hide()
			})
		row
			.append('label')
			.attr('for', id + '1')
			.attr('class', 'sja_clbtext')
			.html('&nbsp;Heatmap')
		row
			.append('input')
			.style('margin-left', '10px')
			.attr('name', id)
			.attr('id', id + '2')
			.attr('type', 'radio')
			.property('checked', tk.mode_arc)
			.on('change', event => {
				if (event.target.checked) {
					tk.mode_hm = false
					tk.mode_arc = true
				} else {
					tk.mode_hm = true
					tk.mode_arc = false
				}
				drawCanvas(tk, block)
				block.block_setheight()
				//tk.tkconfigtip.hide()
			})
		row
			.append('label')
			.attr('for', id + '2')
			.attr('class', 'sja_clbtext')
			.html('&nbsp;Arc')
		row.append('span').style('margin-left', '10px').style('opacity', 0.5).text('for showing interactions.')
	}

	// point up down
	{
		tk.tkconfigtip.d
			.append('div')
			.style('margin', '20px 0px')
			.append('button')
			.text('Point ' + (tk.pyramidup ? 'down' : 'up'))
			.on('click', () => {
				tk.pyramidup = !tk.pyramidup
				drawCanvas(tk, block)
				tk.tkconfigtip.hide()
			})
	}

	if (tk.hic.version) {
		tk.tkconfigtip.d
			.append('div')
			.style('opacity', 0.5)
			.text('HiC file version: ' + tk.hic.version)
	}
}

function textdata_editUI(tk: any, block: any) {
	tk.tkconfigtip.d.transition().style('left', Number.parseInt(tk.tkconfigtip.d.style('left')) - 500 + 'px')
	tk.tkconfigtip.clear()
	const d = tk.tkconfigtip.d.append('div')

	const ta = d.append('textarea').attr('cols', 50).attr('rows', 10)
	ta.property('value', tk.textdata.raw)

	const row2 = d.append('div').style('margin-top', '10px')

	row2
		.append('button')
		.text('Update')
		.on('click', () => {
			const text = ta.property('value')
			if (!text) {
				window.alert('Enter text interaction data')
				return
			}
			tk.textdata.raw = text
			const err = textdata_parseraw(tk, block)
			if (err) {
				window.alert(err)
				return
			}
			loadTk(tk, block)
			tk.tkconfigtip.hide()
		})

	row2
		.append('span')
		.style('margin-left', '5px')
		.html('<a href=' + docurl_text + ' target=_blank>Text data format</a>')

	row2
		.append('button')
		.style('margin-left', '30px')
		.text('Cancel')
		.on('click', () => tk.tkconfigtip.hide())
}

function textdata_parseraw(tk: any, block: any) {
	/*
	chr1
	start1
	stop1
	chr2
	start2
	stop2
	xx
	value
	*/
	tk.textdata.lst = []
	const lines = tk.textdata.raw.trim().split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		if (!line) continue
		const l = line.split(/[\t\s]+/)
		const chr1 = l[0]
		if (!block.genome.chrlookup[chr1.toUpperCase()]) return 'wrong chrA name at line ' + (i + 1)
		const start1 = Number.parseInt(l[1])
		if (Number.isNaN(start1)) return 'invalid startA at line ' + (i + 1)
		const stop1 = Number.parseInt(l[2])
		if (Number.isNaN(stop1)) return 'invalid stopA name at line ' + (i + 1)
		const chr2 = l[3]
		if (!block.genome.chrlookup[chr2.toUpperCase()]) return 'wrong chrB name at line ' + (i + 1)
		const start2 = Number.parseInt(l[4])
		if (Number.isNaN(start2)) return 'invalid startB at line ' + (i + 1)
		const stop2 = Number.parseInt(l[5])
		if (Number.isNaN(stop2)) return 'invalid stopB at line ' + (i + 1)
		const value = Number.parseFloat(l[7])
		if (Number.isNaN(value)) return 'invalid value (8th column) at line ' + (i + 1)
		tk.textdata.lst.push({
			chr1: chr1,
			start1: start1,
			stop1: stop1,
			chr2: chr2,
			start2: start2,
			stop2: stop2,
			value: value
		})
	}
	if (tk.textdata.lst.length == 0) return 'No data points from text input'
}

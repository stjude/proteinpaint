///////////////////
//
// all client-side stuff, including DOM
//
///////////////////

import { scaleLinear } from 'd3-scale'
import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'
import { rgb as d3rgb } from 'd3-color'
import { transition } from 'd3-transition'
import { stratinput } from '../shared/tree'
import { stratify } from 'd3-hierarchy'
import { scaleOrdinal, schemeCategory20 } from 'd3-scale'
import * as common from '../shared/common'

export const font = 'Arial'
export const unspecified = 'Unspecified'
export const colorinframe = 'green'
export const coloroutframe = '#858585'
export const colorbgleft = '#FCE3B8'
export const colorbgright = '#D2E2FC'
export const colorantisense = 'red'
export const colorctx = '#DE3336'
export const textlensf = 0.6 // to replace n.getBBox().width for detecting filling font size which breaks in chrome

export let base_zindex = null

// things that used to be in client.js but now have been moved to common
export const tkt = common.tkt
export const gmmode = common.gmmode

export const domaincolorlst = [
	'#8dd3c7',
	'#bebada',
	'#fb8072',
	'#80b1d3',
	'#E8E89E',
	'#a6d854',
	'#fdb462',
	'#ffd92f',
	'#e5c494',
	'#b3b3b3'
]

// track fetch urls to restrict
// simultaneous reporting for the same issue
const fetchTimers = {}
const fetchReported = {}
const maxAcceptableFetchResponseTime = 15000 // disable with 0, or default to 15000 milliseconds
const maxNumReportsPerSession = 2

export async function get_one_genome(name) {
	const data = await dofetch2(`genomes?genome=${name}`)
	if (!data.genomes) throw 'error'
	const g = data.genomes[name]
	if (!g) throw 'unknown genome: ' + name
	initgenome(g)
	return g
}

export function initgenome(g) {
	g.tkset = []
	g.isoformcache = new Map()
	// k: upper isoform
	// v: [gm]
	g.junctionframecache = new Map()
	/*
	k: junction chr-start-stop
	v: Map
	   k: isoform
	   v: true/false for in-frame
	*/
	g.isoformmatch = (n2, chr, pos) => {
		if (!n2) return null
		const n = n2.toUpperCase()
		if (!g.isoformcache.has(n)) return null
		const lst = g.isoformcache.get(n)
		if (lst.length == 1) return lst[0]
		// multiple available
		if (!chr) {
			console.log('no chr provided for matching with ' + n)
			return lst[0]
		}
		let gm = null
		for (const m of lst) {
			if (m.chr.toUpperCase() == chr.toUpperCase() && m.start <= pos && m.stop >= pos) {
				gm = m
			}
		}
		if (gm) return gm
		for (const m of lst) {
			if (m.chr.toUpperCase() == chr.toUpperCase()) return m
		}
		return null
	}
	g.chrlookup = {}
	for (const nn in g.majorchr) {
		g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.majorchr[nn], major: true }
	}
	if (g.minorchr) {
		for (const nn in g.minorchr) {
			g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.minorchr[nn] }
		}
	}

	if (!g.tracks) {
		g.tracks = []
	}

	for (const t of g.tracks) {
		/*
		essential for telling if genome.tracks[] item is same as block.tklst[]
		*/
		t.tkid = Math.random().toString()
	}
	// validate ds info
	for (const dsname in g.datasets) {
		const ds = g.datasets[dsname]

		if (ds.isMds) {
			// nothing to validate for the moment
		} else {
			const e = validate_oldds(ds)
			if (e) {
				return '(old) official dataset error: ' + e
			}
		}
	}
	return null
}

function validate_oldds(ds) {
	// old official ds
	if (ds.geneexpression) {
		if (ds.geneexpression.maf) {
			try {
				ds.geneexpression.maf.get = eval('(' + ds.geneexpression.maf.get + ')')
			} catch (e) {
				return 'invalid Javascript for get() of expression.maf of ' + ds.label
			}
		}
	}
	if (ds.cohort) {
		if (ds.cohort.raw && ds.cohort.tosampleannotation) {
			/*
			tosampleannotation triggers converting ds.cohort.raw to ds.cohort.annotation
			*/
			if (!ds.cohort.key4annotation) {
				return 'cohort.tosampleannotation in use by .key4annotation missing of ' + ds.label
			}
			if (!ds.cohort.annotation) {
				ds.cohort.annotation = {}
			}
			let nosample = 0
			for (const a of ds.cohort.raw) {
				const sample = a[ds.cohort.tosampleannotation.samplekey]
				if (sample) {
					const b = {}
					for (const k in a) {
						b[k] = a[k]
					}
					ds.cohort.annotation[sample] = b
				} else {
					nosample++
				}
			}
			if (nosample) return nosample + ' rows has no sample name from sample annotation of ' + ds.label
			delete ds.cohort.tosampleannotation
		}
		if (ds.cohort.levels) {
			if (ds.cohort.raw) {
				// to stratify
				// cosmic has only level but no cohort info, buried in snvindel
				const nodes = stratinput(ds.cohort.raw, ds.cohort.levels)
				ds.cohort.root = stratify()(nodes)
				ds.cohort.root.sum(i => i.value)
			}
		}
		if (ds.cohort.raw) {
			delete ds.cohort.raw
		}
		ds.cohort.suncolor = scaleOrdinal(schemeCategory20)
	}
	if (ds.snvindel_attributes) {
		for (const at of ds.snvindel_attributes) {
			if (at.get) {
				try {
					at.get = eval('(' + at.get + ')')
				} catch (e) {
					return 'invalid Javascript for getter of ' + JSON.stringify(at)
				}
			} else if (at.lst) {
				for (const at2 of at.lst) {
					if (at2.get) {
						try {
							at2.get = eval('(' + at2.get + ')')
						} catch (e) {
							return 'invalid Javascript for getter of ' + JSON.stringify(at2)
						}
					}
				}
			}
		}
	}
	if (ds.stratify) {
		if (!Array.isArray(ds.stratify)) {
			return 'stratify is not an array in ' + ds.label
		}
		for (const strat of ds.stratify) {
			if (!strat.label) {
				return 'stratify method lacks label in ' + ds.label
			}
			if (strat.bycohort) {
				if (!ds.cohort) {
					return 'stratify method ' + strat.label + ' using cohort but no cohort in ' + ds.label
				}
			} else {
				if (!strat.attr1) {
					return 'stratify method ' + strat.label + ' not using cohort but no attr1 in ' + ds.label
				}
				if (!strat.attr1.label) {
					return '.attr1.label missing in ' + strat.label + ' in ' + ds.label
				}
				if (!strat.attr1.k) {
					return '.attr1.k missing in ' + strat.label + ' in ' + ds.label
				}
			}
		}
	}

	if (ds.url4variant) {
		// quick fix for clinvar
		for (const u of ds.url4variant) {
			u.makelabel = eval('(' + u.makelabel + ')')
			u.makeurl = eval('(' + u.makeurl + ')')
		}
	}

	// no checking vcfinfofilter
	// no population freq filter
}

/*
	path: URL
	arg: HTTP request body
	opts: see dofetch2() opts argument
*/
export function dofetch(path, arg, opts = null) {
	if (opts && typeof opts == 'object') {
		if (opts.serverData && typeof opts.serverData == 'object') {
			if (!dofetch.serverData) {
				dofetch.serverData = opts.serverData
			} else if (!opts.serverData) {
				opts.serverData = dofetch.serverData
			}
		}
		return dofetch2(path, { method: 'POST', body: JSON.stringify(arg) }, opts)
	} else {
		// path should be "path" but not "/path"
		if (path[0] == '/') {
			path = path.slice(1)
		}

		const jwt = sessionStorage.getItem('jwt')
		if (jwt) {
			arg.jwt = jwt
		}

		let url = path
		const host = sessionStorage.getItem('hostURL') || window.testHost || ''
		if (host) {
			// hostURL can end with / or not, must use 'host/path'
			if (host.endsWith('/')) {
				url = host + path
			} else {
				url = host + '/' + path
			}
		}

		trackfetch(url, arg)

		return fetch(new Request(url, { method: 'POST', body: JSON.stringify(arg) })).then(data => {
			if (fetchTimers[url]) {
				clearTimeout(fetchTimers[url])
			}
			return data.json()
		})
	}
}

const cachedServerDataKeys = []
const maxNumOfServerDataKeys = 20

export function dofetch2(path, init = {}, opts = {}) {
	/*
	path "" string URL path

	init {}
		will be supplied as the second argument to
		the native fetch api, so the method, headers, body
		may be optionally supplied in the "init" argument
		see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch

	opts {}
		.serverData{}              an object for caching fetch Promise 
	*/
	// path should be "path" but not "/path"
	if (path[0] == '/') {
		path = path.slice(1)
	}

	const jwt = sessionStorage.getItem('jwt')
	if (jwt) {
		if (!init.headers) {
			init.headers = {}
		}
		init.headers.authorization = 'Bearer ' + jwt
	}

	let url = path
	const host = sessionStorage.getItem('hostURL') || window.testHost || ''
	if (host) {
		// hostURL can end with / or not, must use 'host/path'
		if (host.endsWith('/')) {
			url = host + path
		} else {
			url = host + '/' + path
		}
	}

	const dataName = url + ' | ' + init.method + ' | ' + init.body

	if (opts.serverData) {
		if (!(dataName in opts.serverData)) {
			trackfetch(url, init)
			opts.serverData[dataName] = fetch(url, init).then(data => {
				if (fetchTimers[url]) {
					clearTimeout(fetchTimers[url])
				}
				// stringify to not share parsed response object
				// to-do: support opt.freeze to enforce Object.freeze(data.json())
				const prom = data.text()
				return prom
			})
		}

		// manage the number of stored keys in serverData
		const i = cachedServerDataKeys.indexOf(dataName)
		if (i !== -1) cachedServerDataKeys.splice(i, 1)
		cachedServerDataKeys.unshift(dataName)
		if (cachedServerDataKeys.length > maxNumOfServerDataKeys) {
			const oldestDataname = cachedServerDataKeys.pop()
			delete opts.serverData[oldestDataname]
		}

		return opts.serverData[dataName].then(str => JSON.parse(str))
	} else {
		trackfetch(url, init)
		return fetch(url, init).then(data => {
			if (fetchTimers[url]) {
				clearTimeout(fetchTimers[url])
			}
			return data.json()
		})
	}
}

const defaultServerDataCache = {}
export function dofetch3(path, init = {}, opts = {}) {
	/*
		This is a convenience function that sets a default serverData object
	*/
	opts.serverData = defaultServerDataCache
	return dofetch2(path, init, opts)
}

function trackfetch(url, arg) {
	if (maxAcceptableFetchResponseTime < 1) return

	// report slowness if the fetch does not respond
	// within the acceptableResponseTime;
	// if the server does respond in time,
	// this timer will just be cleared by the
	// fetch promise handler
	if (
		!fetchTimers[url] &&
		!fetchReported[url] &&
		Object.keys(fetchReported).length <= maxNumReportsPerSession &&
		(window.location.hostname == 'proteinpaint.stjude.org' || sessionStorage.hostURL == 'proteinpaint.stjude.org')
	) {
		fetchTimers[url] = setTimeout(() => {
			// do not send multiple reports for the same page
			fetchReported[url] = 1

			const opts = {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					issue: 'slow response',
					url, // server route
					arg, // request body
					page: window.location.href
				})
			}

			fetch('https://pecan.stjude.cloud/api/issue-tracker', opts)
		}, maxAcceptableFetchResponseTime)
	}
}

export function may_get_locationsearch() {
	if (!location.search) return
	const h = new Map()
	for (const tmp of decodeURIComponent(location.search.substr(1)).split('&')) {
		const l = tmp.split('=')
		const key = l[0].toLowerCase()
		h.set(key, l[1] || 1)
	}
	return h
}

export function appear(d, display) {
	d.style('opacity', 0)
		.style('display', display || 'block')
		.transition()
		.style('opacity', 1)
}

export function disappear(d, remove) {
	d.style('opacity', 1)
		.transition()
		.style('opacity', 0)
		.call(() => {
			if (remove) {
				d.remove()
			} else {
				d.style('display', 'none').style('opacity', 1)
			}
		})
}

export class Menu {
	constructor(arg = {}) {
		this.typename = Math.random().toString()

		const body = d3select(document.body)
		this.d = body
			.append('div')
			.attr('class', 'sja_menu_div')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('background-color', 'white')
			.style('font-family', font)
			.on('mousedown.menu' + this.typename, () => {
				/* 
					When clicking on non-interactive elements within a menu, 
					it should trigger other menus to be hidden. For example,
					clicking on an empty spot in a parent menu should close 
					any submenu that are open, which is done by allowing the 
					mousedown event to propagate to the body (default behavior).
				*/
				const t = d3select(d3event.target)
				if (
					/*** 
						NOTE on interactive menu elements: 
						Any menu element (input, button, etc) that has event listeners
					  is expected to handle that event, including possibly closing any
					  associated menus, and thus no need to propagate the mousedown event 
						to the document body
					***/
					t.on('mousedown') ||
					t.on('click') ||
					// also assume that the following elements have event listeners by default,
					// so same logic of not wanting to propagate the event to the body
					['INPUT', 'SELECT', 'TEXTAREA'].includes(d3event.target.tagName.toUpperCase())
				) {
					d3event.stopPropagation()
				} /* else {
					 // allow the bubbling of the mouse event to the document body
				}*/
			})

		// detect if this menu is launched from within another menu
		// (aka, the 'parent_menu'); this value may be empty (undefined, null)
		// check if this.d isn't empty before assigning parent_menu
		if (Object.values(this.d._groups[0]).length) this.d.node().parent_menu = arg.parent_menu

		body.on('mousedown.menu' + this.typename, () => {
			/*** 
				Problem: A parent menu can close unexpectedly when clicking on a 
				non-interactive submenu element, leaving its submenu still visible
				but "floating" without context since its parent menu disappeared on 'body' click.

				Solution: Do not hide a menu if it happens to be a parent of a clicked menu
			***/
			// when pressing the mouse cursor on the menu itself or any of its submenu, it should stay open
			if (this.d.node().contains(d3event.target)) return
			// this assumes that the mousedown occured on the menu holder itself (not any of its child elements)
			if (d3event.target.parent_menu === this.d.node()) return
			// detect in case the mousedown occurred on a menu's child element,
			// in which case the menu's parent should still be not hidden
			const menu = d3event.target.closest('.sja_menu_div')
			if (menu && menu.parent_menu === this.d.node()) return
			// close a menu for all other mousedown events outside of its own div or submenu
			this.hide()
		})

		if (base_zindex) {
			this.d.style('z-index', base_zindex + 1)
		}

		this.d.style('padding', 'padding' in arg ? arg.padding : '20px')
		if (arg.border) {
			this.d.style('border', arg.border)
		} else {
			this.d.style('box-shadow', '0px 2px 4px 1px #999')
		}
		this.offsetX = Number.isInteger(arg.offsetX) ? arg.offsetX : 20
		this.offsetY = Number.isInteger(arg.offsetY) ? arg.offsetY : 20
		// The hideXmute and hideYmute options would cancel tip hiding if the
		// cursor's X,Y movement is less than the corresponding hide*mute value.
		// This helps avoid flickering when the tooltip div blocks a stationary cursor,
		// which trigers an unwanted mouseout of the element that triggered a mouseover.
		// Also useful for decreasing the sensitivity of the mouseout behavior in general.
		this.hideXmute = Number.isInteger(arg.hideXmute) ? arg.hideXmute : 0
		this.hideYmute = Number.isInteger(arg.hideYmute) ? arg.hideYmute : 0
		this.prevX = -1
		this.prevY = -1
		// string selector option to limit clear()/removal of elements
		// so that other elements may persist within tip.d
		this.clearSelector = arg.clearSelector
	}

	clear() {
		if (this.clearSelector)
			this.d
				.select(this.clearSelector)
				.selectAll('*')
				.remove()
		else this.d.selectAll('*').remove()
		return this
	}

	show(x, y) {
		this.prevX = x
		this.prevY = y

		// show around a given point
		document.body.appendChild(this.d.node())

		this.d.style('display', 'block')
		const leftx = x + this.offsetX
		const topy = y + this.offsetY
		const p = this.d.node().getBoundingClientRect()

		// x adjust
		if (leftx + p.width > window.innerWidth) {
			//if(window.innerWidth-x > p.width)
			if (x > p.width) {
				this.d.style('left', null).style('right', window.innerWidth - x - window.scrollX + this.offsetX + 'px')
			} else {
				// still apply 'left', shift to left instead
				this.d.style('left', Math.max(0, window.innerWidth - p.width) + window.scrollX + 'px').style('right', null)
			}
		} else {
			this.d.style('left', leftx + window.scrollX + 'px').style('right', null)
		}

		if (topy + p.height > window.innerHeight) {
			//if(window.innerHeight-y > p.height)
			if (y > p.height) {
				this.d.style('top', null).style('bottom', window.innerHeight - y - window.scrollY + this.offsetY + 'px')
			} else {
				// still apply 'top', shift to top instead
				this.d.style('top', Math.max(0, window.innerHeight - p.height) + window.scrollY + 'px').style('bottom', null)
			}
		} else {
			this.d.style('top', topy + window.scrollY + 'px').style('bottom', null)
		}

		this.d.transition().style('opacity', 1)
		return this
	}

	showunder(dom, yspace) {
		// route to .show()
		const p = dom.getBoundingClientRect()
		return this.show(p.left - this.offsetX, p.top + p.height + (yspace || 5) - this.offsetY)

		/*
		this.d
			.style('display','block')
			.style('right',null)
			.style('bottom',null)
			.style('left', (p.left+window.scrollX)+'px')
			.style('top',  (p.top + p.height + window.scrollY + (yspace || 5) )+'px' )
			.transition().style('opacity',1)
		return this
		*/
	}

	showunderoffset(dom, yspace) {
		// route to .show()
		const p = dom.getBoundingClientRect()
		return this.show(p.left, p.top + p.height + (yspace || 5))

		/*
		this.d
			.style('display','block')
			.style('right',null)
			.style('bottom',null)
			.style('left', (p.left+window.scrollX)+'px')
			.style('top',  (p.top + p.height + window.scrollY + (yspace || 5) )+'px' )
			.transition().style('opacity',1)
		return this
		*/
	}

	hide() {
		if (d3event) {
			// d3event can be undefined
			// prevent flickering, decrease sensitivity of tooltip to movement on mouseout
			if (
				Math.abs(this.prevX - d3event.clientX) < this.hideXmute &&
				Math.abs(this.prevY - d3event.clientY) < this.hideYmute
			)
				return
		}
		this.d.style('display', 'none').style('opacity', 0)
		return this
	}

	fadeout() {
		this.d
			.transition()
			.style('opacity', 0)
			.on('end', () => this.d.style('display', 'none'))
		return this
	}

	toggle() {
		if (!this.hidden) {
			this.hide()
			this.hidden = true
		} else {
			this.d.style('opacity', 1).style('display', 'block')
			this.hidden = false
		}
		return this
	}
}

export const tip = new Menu({ padding: '' })
tip.d.style('z-index', 1000)

export function menushow(x, y, opts = {}) {
	/********************* deprecated **********************/
	console.log('client.menushow is deprecated')

	d3selectAll('.sja_menu').remove()
	d3selectAll('.sja_menu_persist').style('display', 'none')
	let left = x + document.body.scrollLeft,
		right = '',
		top0 = y + document.body.scrollTop,
		bottom = ''
	x = document.body.clientWidth + document.body.scrollLeft - left
	if (x < 200) {
		left = ''
	} else {
		left = left + 'px'
	}
	y = document.body.clientHeight + document.body.scrollTop - top0
	if (y < 200) {
		top0 = ''
		bottom = y - document.body.scrollTop + 40 + 'px'
	} else {
		top0 = top0 + 'px'
	}
	const body = d3select(document.body)
	const menu = body
		.append('div')
		.attr('class', opts.persist ? 'sja_menu_persist' : 'sja_menu')
		.on('mouseover', () => body.on('mousedown', null))
		.on('mouseout', () => body.on('mousedown', menuhide))
	menu
		.style('left', left)
		.style('top', top0)
		.style('right', right)
		.style('bottom', bottom)
		.style('display', 'block')
	body.on('mousedown', menuhide)
	function menuhide() {
		if (opts.persist) {
			menu.style('display', 'none')
		} else {
			menu.remove()
			body.on('mousedown', null)
		}
	}
	menu.show = function() {
		d3selectAll('.sja_menu').remove()
		d3selectAll('.sja_menu_persist').style('display', 'none')
		if (menu) menu.style('display', 'block')
	}
	return menu
}

export function menuunderdom(d, opts = {}) {
	const p = d.getBoundingClientRect()
	return menushow(p.left, p.top + p.height + 3, opts)
}

export function sayerror(holder, msg) {
	const div = holder.append('div').attr('class', 'sja_errorbar')
	// msg can contain injected XSS, so never do .html(msg)
	div.append('div').text(msg)
	div
		.append('div')
		.html('&#10005;')
		.on('click', () => {
			disappear(div, true)
		})
}

export function axisstyle(p) {
	if (!p || !p.axis) return
	if (!p.color) {
		p.color = '#545454'
	}
	p.axis
		.selectAll('line')
		.attr('stroke', p.color)
		.attr('shape-rendering', 'crispEdges')
	p.axis
		.selectAll('path')
		.attr('fill', 'none')
		.attr('stroke', p.showline ? p.color : 'none')
		.attr('stroke-width', p.showline ? 1 : 0)
		.attr('shape-rendering', 'crispEdges')
	p.axis
		.selectAll('text')
		.style('cursor', 'default')
		.attr('font-family', font)
		.attr('font-size', p.fontsize ? p.fontsize + 'px' : '12px')
		.attr('fill', p.color)
}

export function newpane(pm) {
	/*
	parameter

	.setzindex
		quick dirty way to set the global variable base_zindex

	.x
	.y
	.toshrink
		bool
	.close
		callback
	.closekeep
		bool
	.headpad
		header label bar padding

	*/

	if (pm.setzindex) {
		/*
		dirty fix
		*/
		base_zindex = pm.setzindex
		return
	}

	const dur = 300
	const pp = {}
	const body = d3select(document.body)
	pp.pane = body
		.append('div')
		.attr('class', 'sja_pane')
		.style('left', pm.x + window.pageXOffset + 'px')
		.style('top', pm.y + window.pageYOffset + 'px')
		.style('opacity', 0)

	if (pm.$id) {
		pp.pane.attr('id', pm.$id)
	}

	if (base_zindex) {
		// fixed, from embedding instructions
		pp.pane.style('z-index', base_zindex)
	}

	pp.pane
		.transition()
		.duration(dur)
		.style('opacity', 1)

	const toprow = pp.pane.append('div').on('mousedown', () => {
		d3event.preventDefault()
		d3event.stopPropagation()
		const oldx = Number.parseInt(pp.pane.style('left')),
			oldy = Number.parseInt(pp.pane.style('top'))
		const x0 = d3event.clientX,
			y0 = d3event.clientY
		body.on('mousemove', () => {
			pp.pane.style('left', oldx + d3event.clientX - x0 + 'px').style('top', oldy + d3event.clientY - y0 + 'px')
		})
		body.on('mouseup', function() {
			body.on('mouseup', null).on('mousemove', null)
		})
		// order of precedence, among all panes
		document.body.appendChild(pp.pane.node())
	})

	const butt = toprow
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('padding', '4px 10px')
		.style('margin', '0px')
		.style('border-right', 'solid 1px white')
		.style('cursor', 'default')
		.style('font-size', '1.5em')
		.on('mousedown', () => {
			document.body.dispatchEvent(new Event('mousedown'))
			d3event.stopPropagation()
		})

	if (pm.toshrink) {
		pp.mini = false
		butt.html('&#9473;').on('click', () => {
			butt.html(pp.mini ? '&#9473;' : '&#9725;')
			if (pp.mini) {
				appear(pp.body)
			} else {
				disappear(pp.body)
			}
			pp.mini = !pp.mini
		})
	} else {
		butt.html('&times;')
		if (pm.close) {
			// custom callback on close button
			butt.on('click', pm.close)
		} else if (pm.closekeep) {
			// hide and keep to bring it on later
			butt.on('click', () => {
				pp.pane
					.transition()
					.duration(dur)
					.style('opacity', 0)
					.call(() => pp.pane.style('display', 'none'))
			})
		} else {
			// close and remove pane from page
			butt.on('click', () => {
				pp.pane
					.transition()
					.duration(dur)
					.style('opacity', 0)
					.call(() => pp.pane.remove())
			})
		}
	}
	// where you can write
	pp.header = toprow
		.append('div')
		.style('display', 'inline-block')
		.style('font-family', font)
		.style('padding', pm.headpad || '5px 10px')
	pp.body = pp.pane.append('div').style('font-family', font)
	return pp
}

export function getdomaintypes(gm) {
	if (!gm.pdomains) return []

	const types = new Map()
	// k: domain.name+domain.description
	// v: {} attributes of this type of domain

	for (const i of gm.pdomains) {
		const key = i.name + i.description
		if (types.has(key)) {
			types.get(key).start = Math.min(types.get(key).start, i.start)
		} else {
			types.set(key, {
				name: i.name,
				description: i.description,
				color: i.color,
				start: i.start,
				iscustom: i.iscustom,
				url: i.url,
				pmid: i.pmid,
				CDD: i.CDD,
				Pfam: i.Pfam,
				SMART: i.SMART,
				COG: i.COG,
				PRK: i.PRK,
				Curated_at_NCBI: i.Curated_at_NCBI
			})
		}
	}
	const lst = []
	for (const [key, domaintype] of types) {
		domaintype.key = key
		domaintype.fill = domaintype.color
		domaintype.stroke = d3rgb(domaintype.color)
			.darker(1)
			.toString()
		delete domaintype.color
		lst.push(domaintype)
	}
	lst.sort((a, b) => a.start - b.start)
	return lst
}

export function sketchSplicerna(holder, gm, pxwidth, color) {
	let intronpx = 10
	if (intronpx * (gm.exon.length - 1) > pxwidth * 0.3) {
		intronpx = Math.max(2, (pxwidth * 0.3) / (gm.exon.length - 1))
	}
	let exonlen = 0
	for (const e of gm.exon) {
		exonlen += e[1] - e[0]
	}
	const inw = intronpx * (gm.exon.length - 1)
	const exonsf = (pxwidth - (inw > pxwidth * 0.4 ? 0 : inw)) / exonlen
	// reset width
	pxwidth = exonsf * exonlen + inw
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	ctx.strokeStyle = color
	//ctx.setLineDash([1,1])
	ctx.beginPath()
	ctx.moveTo(0, Math.floor(h / 2) - 0.5)
	ctx.lineTo(pxwidth, Math.floor(h / 2) - 0.5)
	ctx.stroke()
	// gm.exon is 5 to 3
	const reverse = gm.strand == '-'
	let x = 0
	for (const e of gm.exon) {
		let thin1 = null,
			thick = null,
			thin2 = null
		if (reverse) {
			const start = e[1],
				stop = e[0],
				cds5 = gm.codingstop,
				cds3 = gm.codingstart
			if (stop >= cds5) {
				thin1 = e
			} else if (stop >= cds3) {
				if (start >= cds5) {
					thin1 = [cds5, start]
					thick = [stop, cds5]
				} else {
					thick = e
				}
			} else {
				if (start >= cds5) {
					// assumption: 1 single continuous cds
					thin1 = [cds5, start]
					thin2 = [stop, cds3]
					thick = [cds3, cds5]
				} else if (start >= cds3) {
					thin2 = [stop, cds3]
					thick = [cds3, start]
				} else {
					thin2 = e
				}
			}
		} else {
			if (e[1] <= gm.codingstart) {
				thin1 = e
			} else if (e[1] <= gm.codingstop) {
				if (e[0] <= gm.codingstart) {
					thin1 = [e[0], gm.codingstart]
					thick = [gm.codingstart, e[1]]
				} else {
					thick = e
				}
			} else {
				if (e[0] <= gm.codingstart) {
					// assumption: 1 single continuous cds
					thin1 = [e[0], gm.codingstart]
					thin2 = [gm.codingstop, e[1]]
					thick = [gm.codingstart, gm.codingstop]
				} else if (e[0] < gm.codingstop) {
					thin2 = [gm.codingstop, e[1]]
					thick = [e[0], gm.codingstop]
				} else {
					thin2 = e
				}
			}
		}
		if (thin1) {
			ctx.fillStyle = '#aaa'
			const exonw = Math.max(1, (thin1[1] - thin1[0]) * exonsf)
			ctx.fillRect(x, pad, exonw, h - pad * 2)
			x += exonw
		}
		if (thick) {
			ctx.fillStyle = color
			const exonw = Math.max(1, (thick[1] - thick[0]) * exonsf)
			ctx.fillRect(x, 0, exonw, h)
			x += exonw
		}
		if (thin2) {
			ctx.fillStyle = '#aaa'
			const exonw = Math.max(1, (thin2[1] - thin2[0]) * exonsf)
			ctx.fillRect(x, pad, exonw, h - pad * 2)
			x += exonw
		}
		x += intronpx
	}
}

export function sketchGmsum(holder, rglst, gm, exonsf, intronw, pxwidth, h, color) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	canvas.height = h
	const pad = Math.ceil(h / 5)
	const ctx = canvas.getContext('2d')
	let start
	let x = 0
	for (const r of rglst) {
		if (r.chr != gm.chr) {
			x += r.width + intronw
			continue
		}
		if (gm.start >= r.start && gm.start <= r.stop) {
			start = x + (r.reverse ? r.stop - gm.start : gm.start - r.start) * exonsf
			break
		}
		x += r.width + intronw
	}
	let stop
	x = 0
	for (const r of rglst) {
		if (r.chr != gm.chr) {
			x += r.width + intronw
			continue
		}
		if (gm.stop >= r.start && gm.stop <= r.stop) {
			stop = x + (r.reverse ? r.stop - gm.stop : gm.stop - r.start) * exonsf
			break
		}
		x += r.width + intronw
	}
	ctx.strokeStyle = color
	ctx.beginPath()
	ctx.moveTo(start, Math.floor(h / 2) + 0.5)
	ctx.lineTo(stop, Math.floor(h / 2) + 0.5)
	ctx.stroke()

	const thin = []
	if (gm.utr5) thin.push(...gm.utr5)
	if (gm.utr3) thin.push(...gm.utr3)
	if (!gm.cdslen) thin.push(...gm.exon)
	for (const e of thin) {
		let x = 0
		for (const r of rglst) {
			if (r.chr != gm.chr) {
				x += r.width + intronw
				continue
			}
			const start = Math.max(e[0], r.start)
			const stop = Math.min(e[1], r.stop)
			if (start >= stop) {
				x += r.width + intronw
				continue
			}
			ctx.fillStyle = '#aaa'
			ctx.fillRect(
				x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
				pad,
				Math.max(1, (stop - start) * exonsf),
				h - pad * 2
			)
			x += r.width + intronw
		}
	}
	if (gm.coding) {
		for (const e of gm.coding) {
			let x = 0
			for (const r of rglst) {
				if (r.chr != gm.chr) {
					x += r.width + intronw
					continue
				}
				const start = Math.max(e[0], r.start)
				const stop = Math.min(e[1], r.stop)
				if (start >= stop) {
					x += r.width + intronw
					continue
				}
				ctx.fillStyle = color
				ctx.fillRect(
					x + (r.reverse ? (r.stop - stop) * exonsf : (start - r.start) * exonsf),
					0,
					Math.max(1, (stop - start) * exonsf),
					h
				)
				x += r.width + intronw
			}
		}
	}
}

export function sketchRna(holder, gm, pxwidth, color) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	if (!gm.cdslen) {
		ctx.fillStyle = '#aaa'
		ctx.fillRect(0, pad, pxwidth, h - pad * 2)
		return
	}
	const sf = pxwidth / gm.rnalen
	let x = 0
	if (gm.utr5) {
		let ulen = 0
		for (const e of gm.utr5) ulen += e[1] - e[0]
		ctx.fillStyle = '#aaa'
		ctx.fillRect(0, pad, sf * ulen, h - pad * 2)
		x = sf * ulen
	}
	if (gm.pdomains && gm.pdomains.length) {
		ctx.fillStyle = 'white'
		ctx.fillRect(x, 0, gm.cdslen * sf, h)
		gm.pdomains.sort((a, b) => b.stop - b.start - a.stop + a.start)
		for (const domain of gm.pdomains) {
			ctx.fillStyle = domain.color
			ctx.fillRect(x + domain.start * 3 * sf, 0, (domain.stop - domain.start + 1) * 3 * sf, h)
		}
		ctx.strokeStyle = 'black'
		ctx.strokeRect(x, 0, gm.cdslen * sf, h)
	} else {
		ctx.fillStyle = color
		ctx.fillRect(x, 0, gm.cdslen * sf, h)
	}
	x += gm.cdslen * sf
	if (gm.utr3) {
		let ulen = 0
		for (const e of gm.utr3) ulen += e[1] - e[0]
		ctx.fillStyle = '#aaa'
		ctx.fillRect(x, pad, sf * ulen, h - pad * 2)
	}
}
export function sketchProtein2(holder, gm, pxwidth) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	const h = 20
	const pad = 4
	canvas.height = h
	const ctx = canvas.getContext('2d')
	const sf = pxwidth / (gm.cdslen / 3)
	gm.pdomains.sort((a, b) => b.stop - b.start - a.stop + a.start)
	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, pxwidth, h)
	for (const domain of gm.pdomains) {
		ctx.fillStyle = domain.color
		ctx.fillRect(domain.start * sf, 0, (domain.stop - domain.start + 1) * sf, h)
	}
	ctx.strokeStyle = 'black'
	ctx.strokeRect(0, 0, pxwidth, h)
}

export function sketchGene(holder, gm, pxwidth, h, bpstart, bpstop, color, nostrand, reverse) {
	const canvas = holder.append('canvas').node()
	canvas.width = pxwidth
	canvas.height = h
	const ctx = canvas.getContext('2d')
	const sf = scaleLinear().range([1, pxwidth])
	if (reverse) {
		sf.domain([bpstop, bpstart])
	} else {
		sf.domain([bpstart, bpstop])
	}
	ctx.strokeStyle = color
	ctx.fillStyle = color
	bpBox(ctx, gm.start, gm.stop, bpstart, bpstop, h / 2, 1)
	const pad = Math.ceil(h / 5)
	if (gm.utr3) {
		for (const e of gm.utr3) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (gm.utr5) {
		for (const e of gm.utr5) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (gm.coding) {
		for (const e of gm.coding) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, 1, h)
		}
	}
	if (gm.codingstart == gm.codingstop) {
		for (const e of gm.exon) {
			bpBox(ctx, e[0], e[1], bpstart, bpstop, pad + 1, h - pad * 2 - 1)
		}
	}
	if (!nostrand && gm.strand) {
		const ypad = 3 // but not pad
		if (gm.coding) {
			for (const e of gm.coding) {
				bpStrand(ctx, gm.strand, e[0], e[1], bpstart, bpstop, 1 + ypad, h - ypad * 2 - 1, 'white')
			}
		}
		if (gm.intron) {
			for (const e of gm.intron) {
				bpStrand(ctx, gm.strand, e[0], e[1], bpstart, bpstop, 1 + ypad, h - ypad * 2 - 1, color ? color : 'black')
			}
		}
	}
	function bpBox(ctx, start, stop, borderstart, borderstop, y, h) {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		ctx.fillRect(Math.floor(sf(reverse ? b : a)), y, Math.max(1, Math.abs(sf(b) - sf(a))), h)
	}
	function bpStrand(ctx, strand, start, stop, borderstart, borderstop, y, h, color) {
		const a = Math.max(start, borderstart)
		const b = Math.min(stop, borderstop)
		if (a >= b) return
		const pad = 2,
			spacing = h / 2,
			w = sf(b) - sf(a)
		if (w <= pad * 2 + h / 2) return
		ctx.strokeStyle = color
		const fillcount = Math.floor((w - pad * 2) / (h / 2 + spacing))
		let x = Math.floor(sf(a) + (w - fillcount * (h / 2 + spacing)) / 2) + 0.5
		ctx.beginPath()
		for (let i = 0; i < fillcount; i++) {
			if (strand == '+') {
				ctx.moveTo(x, y)
				ctx.lineTo(x + h / 2, y + h / 2)
				ctx.lineTo(x, y + h)
			} else {
				ctx.moveTo(x + h / 2, y)
				ctx.lineTo(x, y + h / 2)
				ctx.lineTo(x + h / 2, y + h)
			}
			x += h / 2 + spacing
		}
		ctx.stroke()
	}
}

export function sketchProtein(holder, gm, pxwidth) {
	let aalen = -1
	if (gm.cdslen) {
		aalen = gm.cdslen / 3
	}
	return holder
		.append('span')
		.html(
			'&nbsp;' +
				(aalen > 0 ? Math.ceil(aalen) + ' AA' + (Number.isInteger(aalen) ? '' : ' (incomplete CDS)') : 'noncoding')
		)
}

export function make_table_2col(holder, data, overlen) {
	const color = '#9e9e9e'
	const table = holder
		.append('table')
		.style('margin', '5px 8px')
		.style('font-size', 'inherit')
		.attr('class', 'sja_simpletable')
	for (const i of data) {
		const tr = table.append('tr')
		if (i.kvlst) {
			tr.append('td')
				.attr('rowspan', i.kvlst.length)
				.style('padding', '3px')
				.style('color', color)
				.html(i.k)
			tr.append('td')
				.style('padding', '3px')
				.style('color', color)
				.html(i.kvlst[0].k)
			tr.append('td')
				.style('padding', '3px')
				.html(i.kvlst[0].v)
			for (let j = 1; j < i.kvlst.length; j++) {
				const tr2 = table.append('tr')
				tr2
					.append('td')
					.style('padding', '3px')
					.style('color', color)
					.html(i.kvlst[j].k)
				tr2
					.append('td')
					.style('padding', '3px')
					.html(i.kvlst[j].v)
			}
		} else {
			tr.append('td')
				.attr('colspan', 2)
				.style('padding', '3px')
				.style('color', color)
				.html(i.k)
			const td = tr.append('td').style('padding', '3px')
			if (overlen && i.v.length > overlen) {
				td.html(i.v.substr(0, overlen - 3) + ' ...&raquo;')
					.attr('class', 'sja_clbtext')
					.on('click', () => {
						td.html(i.v)
							.classed('sja_clbtext', false)
							.on('click', null)
					})
			} else {
				td.html(i.v)
			}
		}
	}
	return table
}

export function newpane3(x, y, genomes) {
	const pane = newpane({ x: x, y: y })
	const inputdiv = pane.body.append('div').style('margin', '40px 20px 20px 20px')
	const p = inputdiv.append('p')
	p.append('span').html('Genome&nbsp;')
	const gselect = p.append('select')
	for (const n in genomes) {
		gselect.append('option').text(n)
	}
	const filediv = inputdiv.append('div').style('margin', '20px 0px')
	const saydiv = pane.body.append('div').style('margin', '10px 20px')
	const visualdiv = pane.body.append('div').style('margin', '20px')
	return [pane, inputdiv, gselect.node(), filediv, saydiv, visualdiv]
}

export function renderSandboxFormDiv(holder, genomes) {
	const inputdiv = holder.append('div').style('margin', '40px 20px 20px 20px')
	const p = inputdiv.append('p')
	p.append('span').html('Genome&nbsp;')
	const gselect = p.append('select')
	for (const n in genomes) {
		gselect.append('option').text(n)
	}
	const filediv = inputdiv.append('div').style('margin', '20px 0px')
	const saydiv = holder.append('div').style('margin', '10px 20px')
	const visualdiv = holder.append('div').style('margin', '20px')
	return [inputdiv, gselect.node(), filediv, saydiv, visualdiv]
}

export function newSandboxDiv(sandbox_holder) {
	// const sandbox_holder = d3select('#pp_sandbox')
	const app_div = sandbox_holder.insert('div', ':first-child')
	const header_row = app_div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '5px 10px')
		.style('padding-right', '8px')
		.style('margin-bottom', '0px')
		.style('box-shadow', '2px 0px 2px #f2f2f2')
		.style('border-radius', '5px 5px 0 0')
		.style('background-color', '#f2f2f2')
		.style('width', '95vw')

	// close_btn
	header_row
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_menuoption')
		.style('cursor', 'default')
		.style('padding', '4px 10px')
		.style('margin', '0px')
		.style('border-right', 'solid 2px white')
		.style('border-radius', '5px 0 0 0')
		.style('font-size', '1.5em')
		.html('&times;')
		.on('mousedown', () => {
			document.body.dispatchEvent(new Event('mousedown'))
			d3event.stopPropagation()
		})
		.on('click', () => {
			app_div.selectAll('*').remove()
		})

	const header = header_row
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '5px 10px')

	const body = app_div
		.append('div')
		.style('margin', '5px 10px')
		.style('margin-top', '0px')
		.style('padding-right', '8px')
		.style('display', 'inline-block')
		.style('box-shadow', '2px 2px 10px #f2f2f2')
		.style('border-top', 'solid 1px white')
		.style('border-radius', '0  0 5px 5px')
		.style('width', '95vw')

	return { header_row, header, body }
}

export function to_svg(svg, name, opts = {}) {
	if (opts.apply_dom_styles) {
		opts.svgClone = svg.cloneNode(true)
		const clone = d3select(opts.svgClone) // make it easier to apply style below
		const styles = window.getComputedStyle(svg)
		for (const s of styles) {
			clone.style(s, styles.getPropertyValue(s))
		}
	}

	const a = document.createElement('a')
	document.body.appendChild(a)
	a.addEventListener(
		'click',
		function() {
			const serializer = new XMLSerializer()
			const svg_blob = new Blob([serializer.serializeToString(opts.svgClone ? opts.svgClone : svg)], {
				type: 'image/svg+xml'
			})
			a.download = name + '.svg'
			a.href = URL.createObjectURL(svg_blob)
			document.body.removeChild(a)
		},
		false
	)
	a.click()
}

export function to_textfile(filename, text) {
	const a = document.createElement('a')
	a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
	a.setAttribute('download', filename)
	a.style.display = 'none'
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

export function filetypeselect(holder) {
	const s = holder.append('select')
	s.append('option').text('SNV and indel') // 0
	s.append('option').text('SV (tabular format)') // 1
	s.append('option').text('Fusion gene (tabular format)') // 2
	s.append('option').text('ITD') // 3
	s.append('option').text('Deletion, intragenic') // 4
	s.append('option').text('Truncation') // 5
	s.append('option').text('CNV, gene-level')
	// TODO vcf, new tabular format for fusion
	return s
}

export function export_data(title, lst) {
	// lst: {label, text}

	const pane = newpane({
		x: window.innerWidth / 2 - 200,
		y: window.innerHeight / 2 - 150
	})
	pane.header.text(title)
	for (const w of lst) {
		const div = pane.body.append('div').style('margin-top', '10px')
		if (w.label) {
			div
				.append('div')
				.text(w.label)
				.style('margin', '5px')
		}
		pane.body
			.append('textarea')
			.text(w.text)
			.attr('readonly', 1)
			.attr('rows', 10)
			.attr('cols', 100)
	}
	pane.body
		.append('p')
		.style('font-size', '.7em')
		.text('Click on the text box above and press Ctrl-A to select all text for copy-pasting.')
}

export function flyindi(from, to) {
	const p1 = from.node().getBoundingClientRect()
	const p2 = to.node().getBoundingClientRect()
	const d = d3select(document.body)
		.append('div')
		.style('position', 'absolute')
		.style('border', 'solid 1px black')
		.style('left', p1.left + window.pageXOffset + 'px')
		.style('top', p1.top + window.pageYOffset + 'px')
		.style('width', p1.width + 'px')
		.style('height', p1.height + 'px')
	if (base_zindex) {
		d.style('z-index', base_zindex + 3)
	}
	d.transition()
		.duration(500)
		.style('left', p2.left + window.pageXOffset + 'px')
		.style('top', p2.top + window.pageYOffset + 'px')
		.style('width', p2.width + 'px')
		.style('height', p2.height + 'px')
		.on('end', () => d.remove())
}

export function labelbox(arg) {
	/* a box with label overlapping its border
	- holder
	- label
	- color
	*/
	const fontsize = 16
	if (!arg.color) {
		arg.color = '#ccc'
	}
	const d0 = arg.holder
		.append('div')
		.style('position', 'relative')
		.style('padding-top', fontsize / 2 + 'px')
	if (arg.margin) {
		d0.style('margin', arg.margin)
	}
	const bin = d0
		.append('div')
		.style('border', 'solid 1px ' + arg.color)
		.style('padding', fontsize + 'px')
		.style('padding-bottom', fontsize / 2 + 'px')
	d0.append('div')
		.text(arg.label)
		.style('position', 'absolute')
		.style('left', '15px')
		.style('top', '0px')
		.style('background-color', 'white')
		.style('color', arg.color)
		.style('font-family', font)
		.style('font-size', fontsize + 'px')
		.style('padding', '0px 10px')
	return bin
}

export function category2legend(categories, holder) {
	// bound to tk logic
	holder.selectAll('*').remove()
	for (const key in categories) {
		const c = categories[key]
		const div = holder
			.append('div')
			.style('display', 'inline-block')
			.style('white-space', 'nowrap')
			.style('padding', '5px 20px 5px 0px')
		div
			.append('div')
			.style('display', 'inline-block')
			.style('background-color', c.color)
			.style('margin-right', '5px')
			.style('padding', '0px 4px')
			.html('&nbsp;')
		div
			.append('div')
			.style('display', 'inline-block')
			.style('color', c.color)
			.text(c.label)
	}
}

export function bulk_badline(header, lines) {
	const np = newpane({ x: 400, y: 60 })
	np.body.style('margin', '20px 10px 10px 10px')
	np.header.text(lines.length + ' line' + (lines.length > 1 ? 's' : '') + ' rejected, click to check')
	if (lines.length <= 50) {
		// small # of lines, show link for each
		for (const [number, err, line] of lines) {
			np.body
				.append('div')
				.classed('sja_clbtext', true)
				.style('margin', '3px')
				.text('Line ' + number + ': ' + err)
				.on('click', () => {
					const n2 = newpane({ x: 500, y: 60 })
					n2.header.text('Line ' + number)
					n2.body.style('margin', '10px')
					const t = n2.body
						.append('table')
						.style('border-spacing', '1px')
						.style('border-collapse', 'separate')
					let fl = true
					for (let i = 0; i < header.length; i++) {
						const tr = t.append('tr')
						if (fl) {
							tr.style('background-color', '#ededed')
						}
						fl = !fl
						tr.append('td').text(header[i])
						tr.append('td').text(line[i] == undefined ? '' : line[i])
					}
				})
		}
		return
	}
	// group lines by reasons of reject
	const reason = new Map()
	for (const [number, err, line] of lines) {
		if (!reason.has(err)) {
			reason.set(err, [])
		}
		reason.get(err).push({ number: number, line: line })
	}

	const lst = [...reason]

	lst.sort((a, b) => b[1].length - a[1].length)

	for (const [thisreason, linelst] of lst) {
		const line1 = linelst[0]
		np.body
			.append('div')
			.classed('sja_menuoption', true)
			.style('margin', '5px')
			.text(
				'Line ' + line1.number + ': ' + thisreason + (linelst.length > 1 ? ' (total ' + linelst.length + ' lines)' : '')
			)
			.on('click', () => {
				const n2 = newpane({ x: 500, y: 60 })
				n2.header.text('Line ' + line1.number)
				const t = n2.body.style('margin', '10px').append('table')
				let fl = true
				for (let i = 0; i < header.length; i++) {
					const tr = t.append('tr')
					if (fl) {
						tr.style('background-color', '#ededed')
					}
					fl = !fl
					tr.append('td').text(header[i])
					tr.append('td').text(line1.line[i] == undefined ? '' : line1.line[i])
				}
			})
	}
}

export function ensureisblock(b) {
	if (!b) return 'No Block{} object given'
	if (typeof b != 'object') return 'Block is not an object'
	if (!b.error) return 'method block.error() missing'
	if (!b.genome) return 'block.genome missing'
	return null
}

export function fillbar(td, v, at) {
	/*
draw a horizontal bar with bg and fg to show percentage

td: holder
	optional, if missing, will return svg html
v: 
	.f fraction
	.v1 numerator, optional
	.v2 denominator
at:
	optional
	.width
	.height
	.fillbg
	.fill
	.readcountcredible
*/
	if (!at) at = {}
	const w = at.width || 40
	const h = at.height || 12

	let g

	if (td) {
		td.attr('title', (v.f * 100).toFixed(0) + '%' + (v.v1 != undefined ? ' (' + v.v1 + '/' + v.v2 + ')' : ''))
		g = td
			.append('svg')
			.attr('width', w)
			.attr('height', h)
	} else {
		g = d3select(document.body).append('svg')
	}

	let y = 0
	// fill bg
	g.append('rect')
		.attr('y', y)
		.attr('width', w)
		.attr('height', h)
		.attr('fill', at.fillbg || '#CBE2F5')
	// fill fg
	g.append('rect')
		.attr('y', y)
		.attr('width', w * v.f)
		.attr('height', h)
		.attr('fill', at.fill || '#69A1D1')

	if (at.readcountcredible && v.v2 < at.readcountcredible) {
		// wash with gray
		const smudge = '#545454'
		const smudge2 = 0.3
		g.append('rect')
			.attr('y', y)
			.attr('width', w)
			.attr('height', h)
			.attr('fill', smudge)
			.attr('fill-opacity', smudge2)
	}

	if (td) return g

	g.remove()
	return '<svg width=' + w + ' height=' + h + '>' + g.node().innerHTML + '</svg>'
}

export function mclasscolorchangeui(tip) {
	tip.d.append('p').html('<span style="color:#858585;font-size:.7em">EXAMPLE</span> M ; red')
	const input = tip.d
		.append('textarea')
		.attr('cols', 25)
		.attr('rows', 5)
		.attr('placeholder', 'One class per line, join color and class code by semicolon.')
	const row = tip.d.append('div')
	row
		.append('button')
		.text('Submit')
		.on('click', () => {
			const str = input.property('value').trim()
			if (!str) return
			errdiv.text('')
			const good = []
			for (const line of str.split('\n')) {
				const l = line.split(';')
				if (l.length != 2) return errdiv.text('no separator in line: ' + line)
				const c = l[0].trim()
				const color = l[1].trim()
				if (!c || !color) return errdiv.text('wrong line: ' + line)
				if (!common.mclass[c]) return errdiv.text('wrong class: ' + c)
				good.push([c, color])
			}
			if (good.length) {
				for (const [c, color] of good) {
					common.mclass[c].color = color
				}
				mclasscolor2table(table)
				errdiv.text('New color set!')
			}
		})
	row
		.append('button')
		.text('Clear')
		.on('click', () => {
			input.property('value', '')
			errdiv.text('')
		})
	const errdiv = row.append('span').style('margin-left', '10px')

	const table = tip.d.append('div').style('margin-top', '5px')
	mclasscolor2table(table)

	tip.d
		.append('p')
		.style('font-size', '.8em')
		.html(
			'<a href=https://en.wikipedia.org/wiki/Web_colors target=_blank>Use color names</a>, or #ff0000 or rgb(255,0,0)'
		)
}

export function mclasscolor2table(table, snvonly) {
	table
		.style('border-spacing', '3px')
		.selectAll('*')
		.remove()
	const tr = table
		.append('tr')
		.style('color', '#858585')
		.style('font-size', '.7em')
	tr.append('td').text('CLASS')
	tr.append('td')
		.attr('colspan', 2)
		.text('LABEL, COLOR')
	for (const k in common.mclass) {
		const c = common.mclass[k]
		if (snvonly) {
			if (c.dt != common.dtsnvindel) {
				continue
			}
		}
		const tr = table.append('tr')
		tr.append('td').text(k)
		tr.append('td')
			.append('span')
			.attr('class', 'sja_mcdot')
			.style('background-color', c.color)
			.html('&nbsp;&nbsp;')
		tr.append('td')
			.text(c.label)
			.style('color', c.color)
	}
}

// bigwig track
export const bwSetting = {
	height: 1,
	pcolor: 2,
	ncolor: 3,
	pcolor2: 4,
	ncolor2: 5,
	autoscale: 6,
	fixedscale: 7,
	percentilescale: 8,
	nodotplot: 9,
	usedotplot: 10,
	usedividefactor: 11,
	nodividefactor: 12
}

export function first_genetrack_tolist(genome, lst) {
	if (!genome.tracks) return
	for (const t of genome.tracks) {
		if (t.__isgene) {
			lst.push(t)
			return
		}
	}
}

export function tkexists(t, tklst) {
	// return the tkobj found in the list
	for (const t0 of tklst) {
		if (t0.type != t.type) continue
		switch (t.type) {
			case tkt.bigwig:
			case tkt.bedj:
			case tkt.junction:
			case tkt.mdsjunction:
			case tkt.mdscnv:
			case tkt.bampile:
			case tkt.hicstraw:
			case tkt.expressionrank:
				// single file
				if ((t.file && t.file == t0.file) || (t.url && t.url == t0.url)) {
					return t0
				}
				break
			case tkt.bigwigstranded:
				if (t.strand1 && t0.strand1 && t.strand1.file == t0.strand1.file && t.strand1.url == t0.strand1.url) {
					if (t.strand2 && t0.strand2 && t.strand2.file == t0.strand2.file && t.strand2.url == t0.strand2.url) {
						return t0
					}
				}
				break
			// TODO pgv ds-vcf
		}
	}
	return null
}

export function ranksays(v) {
	if (v >= 100) return 'HIGHEST'
	if (v >= 90) return 'HIGH ' + v + '%'
	if (v >= 70) return 'high ' + v + '%'
	if (v >= 30) return v + '%'
	if (v >= 10) return 'low ' + v + '%'
	if (v > 0) return 'LOW ' + v + '%'
	return 'LOWEST'
}

export function rgb2hex(rgb) {
	// should be replaced by d3-color.rgb(xx).hex()
	if (rgb[0] == '#') return rgb
	const r = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i)
	return r && r.length === 4
		? '#' +
				('0' + parseInt(r[1], 10).toString(16)).slice(-2) +
				('0' + parseInt(r[2], 10).toString(16)).slice(-2) +
				('0' + parseInt(r[3], 10).toString(16)).slice(-2)
		: ''
}

export function keyupEnter() {
	return d3event.code == 'Enter' || d3event.code == 'NumpadEnter'
}

export function may_findmatchingsnp(chr, poslst, genome) {
	/*
chr: string
poslst[]
	int, or {start, stop}
genome{ name }
*/
	if (!genome || !genome.hasSNP) return
	const p = {
		genome: genome.name,
		chr: chr,
		ranges: []
	}
	for (const i of poslst) {
		if (Number.isFinite(i)) {
			p.ranges.push({ start: i, stop: i + 1 })
		} else if (i.start & i.stop) {
			p.ranges.push(i)
		}
	}
	return dofetch('snp', p).then(data => {
		if (data.error) throw data.error
		return data.results
	})
}

export function snp_printhtml(m, d) {
	/*
m{}
	.name
	.class
	.observed
*/
	d.append('a')
		.text(m.name)
		.attr('href', 'https://www.ncbi.nlm.nih.gov/snp/' + m.name)
		.attr('target', '_blank')
	d.append('div')
		.attr('class', 'sja_tinylogo_body')
		.text(m.class)
	d.append('div')
		.attr('class', 'sja_tinylogo_head')
		.text('CLASS')
	d.append('div')
		.attr('class', 'sja_tinylogo_body')
		.text(m.observed)
	d.append('div')
		.attr('class', 'sja_tinylogo_head')
		.text('ALLELE')
}

export async function may_findmatchingclinvar(chr, pos, ref, alt, genome) {
	/*
chr: string
pos
	int, or {start, stop}
genome{ name }
*/
	if (!genome || !genome.hasClinvarVCF) return
	if (!Number.isInteger(pos)) throw 'pos is not integer'
	const _c = genome.chrlookup[chr.toUpperCase()]
	if (_c.len < pos) throw 'position out of bound: ' + pos
	const p = { genome: genome.name, chr, pos, ref, alt }
	const lst = ['genome=' + genome.name, 'chr=' + chr, 'pos=' + pos, 'ref=' + ref, 'alt=' + alt]
	const data = await dofetch2('clinvarVCF?' + lst.join('&'))
	if (data.error) throw data.error
	return data.hit
}

export function clinvar_printhtml(m, d) {
	/*
m{}
	.id
	.value
	.bg
	.textcolor
*/
	d.append('div')
		.style('display', 'inline-block')
		.style('background', m.bg)
		.style('padding', '3px')
		.append('a')
		.attr('href', 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' + m.id)
		.attr('target', '_blank')
		.style('color', m.textcolor)
		.text(m.value)
		.style('font-size', '.9em')
		.style('text-decoration', 'none')
}

export function gmlst2loci(gmlst) {
	// gmlst as is returned by genelookup:deep
	const locs = []
	for (const f of gmlst) {
		let nooverlap = true
		for (const r of locs) {
			if (f.chr == r.chr && Math.max(f.start, r.start) < Math.min(f.stop, r.stop)) {
				r.start = Math.min(r.start, f.start)
				r.stop = Math.max(r.stop, f.stop)
				nooverlap = false
			}
		}
		if (nooverlap) {
			locs.push({
				name: f.isoform,
				chr: f.chr,
				start: f.start,
				stop: f.stop
			})
		}
	}
	return locs
}

export function tab2box(holder, tabs, runall, tabheader) {
	/*
tabs[ tab{} ]
	.label:
		required
	.callback()
		required

this function attaches .box (d3 dom) to each tab of tabs[]

*/
	const tr = holder
		.append('table')
		.style('border-spacing', '0px')
		.style('border-collapse', 'separate')
		.append('tr')
	const tdleft = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('padding', '10px 0px 10px 10px')
	const tdright = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('border-left', 'solid 1px #aaa')
		.style('padding', '10px')
	const has_acitve_tab = tabs.findIndex(t => t.active) == -1 ? false : true

	if (tabheader) {
		const tHeader = tdleft
			.append('div')
			.style('padding', '5px 10px')
			.style('margin', '5px 5px 10px 5px')
			.style('font-weight', '550')
			.text(tabheader)
	}

	for (let i = 0; i < tabs.length; i++) {
		const tab = tabs[i]

		tab.tab = tdleft
			.append('div')
			.style('padding', '5px 10px')
			.style('margin', '0px')
			.style('border-top', 'solid 1px #ddd')
			.classed('sja_menuoption', !has_acitve_tab && i != 0)
			.html(tab.label)

		tab.box = tdright
			.append('div')
			.style('padding', '3px')
			.style('display', (!has_acitve_tab && i == 0) || tab.active ? 'block' : 'none')

		if ((runall && tab.callback) || (!has_acitve_tab && i == 0 && tab.callback) || tab.active) {
			tab.callback(tab.box)
			delete tab.callback
		}
		if (has_acitve_tab) tab.tab.classed('sja_menuoption', !tab.active)

		tab.tab.on('click', () => {
			if (tab.box.style('display') != 'none') {
				tab.tab.classed('sja_menuoption', true)
				tab.box.style('display', 'none')
			} else {
				tab.tab.classed('sja_menuoption', false)
				appear(tab.box)
				for (let j = 0; j < tabs.length; j++) {
					if (i != j) {
						tabs[j].tab.classed('sja_menuoption', true)
						tabs[j].box.style('display', 'none')
					}
				}
			}
			if (tab.callback) {
				tab.callback(tab.box)
				delete tab.callback
			}
		})
	}
}

export function tab_wait(d) {
	return d
		.append('div')
		.style('margin', '30px')
		.text('Loading...')
}

export function add_scriptTag(path) {
	// path like /static/js/three.js, must begin with /
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.setAttribute('src', sessionStorage.getItem('hostURL') + path)
		document.head.appendChild(script)
		script.onload = resolve
	})
}

import { arc as d3arc } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { stratify, partition } from 'd3-hierarchy'
import { select as d3select } from 'd3-selection'
import { rgb as d3rgb } from 'd3-color'
import { stratinput } from '#shared/tree.js'
import { font as fontfamily } from './client'

export function burst(ep, val1, val2) {
	if (!ep.p.cohort) {
		return
	}

	ep.grab.min = Math.min(val1, val2)
	ep.grab.max = Math.max(val1, val2)

	// samples within range
	let elst = ep.data.filter(i => i.value >= ep.grab.min && i.value <= ep.grab.max)
	if (elst.length == 0) {
		if (ep.grab.sun) {
			ep.grab.sun.g.remove()
		}
		return
	}

	if (ep.p.cohort.annotation) {
		/*
	for .p.cohort.annotation
	annotation data loaded from a source (e.g. files) and are not directly stored with ep.data[]
	must find annotation for samples
	make a new elst[]
	*/
		const lst = []
		for (const s of elst) {
			const s2 = {}
			for (const k in s) {
				if (k != 'circle') {
					s2[k] = s[k]
				}
			}
			const sanno = ep.p.cohort.annotation[s[ep.p.sampletype]]
			if (sanno) {
				for (const k in sanno) {
					s2[k] = sanno[k]
				}
			}
			lst.push(s2)
		}
		elst = lst
	}

	const grab = ep.grab
	if (grab.sun) {
		grab.sun.g.remove()
	} else {
		grab.sun = {
			x: 0,
			y: 0
		}
	}

	const sun = grab.sun
	sun.g = grab.holder
		.append('g')
		.attr('transform', 'translate(' + sun.x + ',' + sun.y + ')')
		.on('mouseover', () => {
			ep.dottip.hide()
		})

	/*
check if any samples have valid anno for first level
if none, quit!
quick fix to avoid error!
*/
	let numsamplewithlevel1 = 0
	for (const s of elst) {
		if (s[ep.p.cohort.levels[0].k] != undefined) {
			numsamplewithlevel1++
		}
	}
	if (numsamplewithlevel1 == 0) {
		sun.g
			.append('text')
			.text('0/' + elst.length)
			.attr('font-size', 40)
			.attr('font-family', fontfamily)
			.attr('stroke', 'white')
			.attr('stroke-width', 3)
			.attr('text-anchor', 'middle')
		sun.g
			.append('text')
			.text('0/' + elst.length)
			.attr('font-size', 40)
			.attr('font-family', fontfamily)
			.attr('fill', ep.p.hlcolor)
			.attr('text-anchor', 'middle')
			.attr('fill-opacity', 0.8)
			.on('click', () => {
				removesun(sun, grab, ep)
			})
		return
	}

	if (ep.samplecart) {
		grab.selectedsamples = elst.map(d => (d.sample_name ? d.sample_name : d.sample))

		ep.samplecart.setBtns({
			samplelst: grab.selectedsamples,
			basket: 'Gene Expression',
			id: ep.genename + (!ep.grab || !elst.length ? '' : ' FPKM:' + ep.grab.min + '-' + ep.grab.max),
			container: ep.samplecartWrapper,
			reselectable: true
		})
	}

	const radius = Math.min(ep.width, ep.height) * 0.3
	const bgpocket = sun.g.append('g')
	let bgpocketrad
	let emptyspace
	const arcfunc = d3arc()
		.startAngle(d => d.x0)
		.endAngle(d => d.x1)
		.innerRadius(d => {
			if (!d.parent) {
				emptyspace = Math.sqrt(d.y1) - radius / 15
				return emptyspace
			}
			return Math.sqrt(d.y0)
		})
		.outerRadius(d => {
			d.outradius = Math.sqrt(d.y1)
			if (d.parent && !d.parent.parent) {
				bgpocketrad = d.outradius
			}
			return d.outradius
		})

	const nodes = stratinput(elst, ep.p.cohort.levels)
	const root = stratify()(nodes)
	root.sum(d => d.value)
	root.sort((a, b) => b.value - a.value)
	partition().size([Math.PI * 2, radius * radius])(root)
	sun.ring = sun.g
		.selectAll()
		.data(root.descendants())
		.enter()
		.append('path')
		.attr('d', arcfunc)
		.attr('stroke', 'white')
		.attr('fill-opacity', 1)
		.attr('fill-rule', 'evenodd')
		.attr('fill', d => {
			if (!d.parent) return 'white'
			let name
			if (d.children) {
				name = d.id
			} else {
				// this is children, try to apply same color as parent
				if (!d.parent.parent) {
					// the parent is root, use its own name
					name = d.id
				} else {
					name = d.parent.id
				}
			}
			d._color = ep.p.cohort.suncolor(name)
			return d._color
		})
		.on('mouseover', (event, d) => {
			if (!d.parent) return
			//let thissize
			setnamesays.text(d.data.name)
			/*
			.attr('font-size',1)
			.each(function(){ thissize=Math.min(setnamefontsize,(2*Math.sqrt(d.y))/this.getBBox().width)})
			.attr('font-size',thissize)
			*/
			setnamesaysbg.text(d.data.name)
			//.attr('font-size',thissize)
			numsays.text(d.value)
			datatypesays.text(d.data.full || '')
			event.target.setAttribute('fill', d3rgb(d._color).darker(0.5).toString())
		})
		.on('mouseout', (event, d) => {
			setnamesays.text(grab.min + ' - ' + grab.max).attr('font-size', setnamefontsize)
			setnamesaysbg.text(grab.min + ' - ' + grab.max).attr('font-size', setnamefontsize)
			numsays.text(numsamplewithlevel1 == elst.length ? elst.length : numsamplewithlevel1 + '/' + elst.length)
			datatypesays.text(ep.p.datatype)
			//sampletypesays.text(ep.p.sampletype.toUpperCase())
			event.target.setAttribute('fill', d._color)
		})
		.on('click', (event, d) => {
			// clicking a slice
			if (!ep.samplecart) {
				// no callback, do not handle
				return
			}
			const lst = []
			for (const s of d.data.lst) {
				// FIXME hardcoded sample attribute
				lst.push(s.sample_name ? s.sample_name : s.sample)
			}
			ep.samplecart.setBtns({
				samplelst: lst,
				basket: 'Gene Expression',
				note:
					d.data.name +
					' samples with ' +
					ep.genename +
					' ' +
					ep.p.datatype +
					' between ' +
					ep.grab.min +
					' and ' +
					ep.grab.max,
				id:
					ep.genename +
					(!ep.grab || !d.data.lst.length || !d.data.lst[0] ? '' : ' FPKM:' + ep.grab.min + '-' + ep.grab.max) +
					' ' +
					d.data.lst[0].ancestor_dx,
				container: ep.samplecartWrapper,
				reselectable: true
			})
		})

	bgpocket.append('circle').attr('r', bgpocketrad).attr('fill', 'white').attr('fill-opacity', 0.7)

	/*
parent of leaf nodes
items must be sorted in proper order to work with following label y placement method!
*/
	const a = [], // by angle
		b = [],
		c = [],
		d = []
	for (const i of root.leaves()) {
		const r = (i.x0 + i.x1) / 2
		if (r <= Math.PI / 2) a.push(i)
		else if (r <= Math.PI) b.push(i)
		else if (r <= Math.PI * 1.5) c.push(i)
		else d.push(i)
	}
	a.sort((a, b) => b.x0 - a.x0)
	b.sort((a, b) => a.x0 - b.x0)
	c.sort((a, b) => b.x0 - a.x0)
	d.sort((a, b) => a.x0 - b.x0)
	const palst = [...a, ...b, ...c, ...d]
	// arc labels for palst
	const lefth = []
	const righth = [] // stack of occupied vertical space
	const fontsize = Math.max(13, ep.dotsize * 0.7)
	sun.g
		.selectAll()
		.data(palst)
		.enter()
		.append('text')
		.text(
			d => (d.parent.data.name ? (d.parent.data.name == 'root' ? '' : d.parent.data.name + ', ') : '') + d.data.name
		)
		.attr('font-size', fontsize)
		.attr('font-family', fontfamily)
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('fill', 'none')
		.each(function (d) {
			const texth = this.getBBox().height // cannot use fontsize as height
			const a = (d.x0 + d.x1) / 2
			let rr = radius + 5
			let y0 = -rr * Math.cos(a)
			if (a <= Math.PI) {
				// on right
				let nf = true
				for (const h of righth) {
					if (y0 >= h[0] && y0 <= h[1]) {
						// hit
						nf = false
						if (a <= Math.PI / 2) {
							y0 = h[0] - 2
							// lengthen radius
							rr = -y0 / Math.cos(a)
							h[0] = y0 - texth
						} else {
							y0 = 2 + h[1]
							rr = -y0 / Math.cos(a)
							h[1] = y0 + texth
						}
						break
					}
				}
				if (nf) {
					if (a <= Math.PI / 2) {
						righth.push([y0 - texth, y0])
					} else {
						righth.push([y0, y0 + texth])
					}
				}
			} else {
				// on left
				let nf = true
				for (const h of lefth) {
					if (y0 >= h[0] && y0 <= h[1]) {
						nf = false
						if (a <= Math.PI * 1.5) {
							y0 = 2 + h[1]
							rr = -y0 / Math.cos(a)
							h[1] = y0 + texth
						} else {
							y0 = h[0] - 2
							rr = -y0 / Math.cos(a)
							h[0] = y0 - texth
						}
						break
					}
				}
				if (nf) {
					if (a <= Math.PI * 1.5) {
						lefth.push([y0, y0 + texth])
					} else {
						lefth.push([y0 - texth, y0])
					}
				}
			}
			d.labely = y0
			d.labelx = rr * Math.sin(a)
		})
		.attr('x', d => d.labelx)
		.attr('y', d => d.labely)
		.attr('text-anchor', d => ((d.x0 + d.x1) / 2 <= Math.PI ? 'start' : 'end'))
		.attr('dominant-baseline', d => {
			var a = (d.x0 + d.x1) / 2
			if (a <= Math.PI / 2 || a >= Math.PI * 1.5) return ''
			return 'hanging'
		})
	sun.g
		.selectAll()
		.data(palst)
		.enter()
		.append('text')
		.text(d => (d.parent.parent ? d.parent.data.name + ', ' : '') + d.data.name)
		.attr('font-size', fontsize)
		.attr('font-family', fontfamily)
		.attr('fill', '#858585')
		.attr('x', d => d.labelx)
		.attr('y', d => d.labely)
		.attr('text-anchor', d => ((d.x0 + d.x1) / 2 <= Math.PI ? 'start' : 'end'))
		.attr('dominant-baseline', d => {
			var a = (d.x0 + d.x1) / 2
			if (a <= Math.PI / 2 || a >= Math.PI * 1.5) return ''
			return 'hanging'
		})
	// linking line for arc label
	sun.g
		.selectAll()
		.data(palst)
		.enter()
		.append('line')
		.attr('x1', d => d.outradius * Math.sin((d.x0 + d.x1) / 2))
		.attr('y1', d => -d.outradius * Math.cos((d.x0 + d.x1) / 2))
		.attr('x2', d => d.labelx)
		.attr('y2', d => d.labely)
		.attr('stroke', '#858585')
	// center labels
	const bigfont = Math.max(18, emptyspace * 0.6)
	const smallfont = Math.max(14, emptyspace * 0.2) // small font height for title
	let y = -3
	let setnamefontsize
	let w
	const sampletypesays = sun.g
		.append('text')
		.text(ep.p.sampletype.toUpperCase())
		.attr('font-size', smallfont)
		.attr('font-family', fontfamily)
		.attr('y', -bigfont)
		.attr('fill', ep.p.hlcolor)
		.attr('text-anchor', 'middle')
	const numsays = sun.g
		.append('text')
		.text(numsamplewithlevel1 == elst.length ? elst.length : numsamplewithlevel1 + '/' + elst.length)
		.attr('font-size', bigfont)
		.attr('font-family', fontfamily)
		.attr('y', y)
		.attr('fill', ep.p.hlcolor)
		.attr('text-anchor', 'middle')
		.attr('fill-opacity', 0.8)
	y = 5
	const datatypesays = sun.g
		.append('text')
		.text(ep.p.datatype)
		.attr('font-size', smallfont)
		.attr('font-family', fontfamily)
		.attr('y', y)
		.attr('dominant-baseline', 'hanging')
		.attr('text-anchor', 'middle')
		.attr('fill', '#b5b5b5')
	const text = grab.min + ' - ' + grab.max
	const sf = scaleLinear()
		.domain([5, 15])
		.range([emptyspace, emptyspace * 2])
	const setnamesaysbg = sun.g
		.append('text')
		.text(text)
		.attr('font-size', 1)
		.each(function () {
			var b = this.getBBox()
			setnamefontsize = Math.min(sf(text.length) / b.width, (emptyspace * 0.4) / b.height)
		})
		.attr('font-size', setnamefontsize)
		.attr('font-family', fontfamily)
		.attr('y', y + smallfont)
		.attr('dominant-baseline', 'hanging')
		.attr('text-anchor', 'middle')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
		.attr('fill', 'none')
	const setnamesays = sun.g
		.append('text')
		.text(text)
		.attr('font-size', setnamefontsize)
		.attr('font-family', fontfamily)
		.attr('y', y + smallfont)
		.attr('dominant-baseline', 'hanging')
		.attr('text-anchor', 'middle')
		.attr('fill', '#858585')
	// unseen clickable foreground for self remove
	sun.g
		.append('circle')
		.attr('r', emptyspace + radius / 15)
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.on('click', () => {
			if (sun.busy) return
			removesun(sun, grab, ep)
		})
		.on('mousedown', event => {
			const x0 = sun.x,
				y0 = sun.y,
				mx = event.clientX,
				my = event.clientY,
				body = d3select(document.body)
			body
				.on('mousemove', event => {
					event.preventDefault()
					sun.busy = true
					sun.x = x0 + event.clientX - mx
					sun.y = y0 + event.clientY - my
					sun.g.attr('transform', 'translate(' + sun.x + ',' + sun.y + ')')
				})
				.on('mouseup', () => {
					body.on('mousemove', null).on('mouseup', null)
					setTimeout(() => (sun.busy = false), 10)
				})
		})
}

function removesun(sun, grab, ep) {
	if (sun.ring) {
		sun.ring.transition().attr('fill-opacity', 0)
	}
	sun.g
		.transition()
		.attr('transform', 'scale(.5,.5)')
		.on('end', () => {
			sun.g.remove()
			// hide shade
			grab.shade.attr('transform', 'translate(0,1000)')
		})
	grab.shadebox.transition().duration(500).attr('stroke-opacity', 0).attr('fill-opacity', 0)
	grab.shadehandle1.transition().duration(500).attr('fill-opacity', 0)
	grab.shadehandle2.transition().duration(500).attr('fill-opacity', 0)
	delete grab.x
	if (ep.selectsample_button) {
		ep.selectsample_button.style('display', 'none').text('')
	}
}

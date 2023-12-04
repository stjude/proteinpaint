import { bplen } from '#shared/common'
import { nmeth2select } from './hic.straw'

/**
 * Renders control panel for hic whole genome view
 * @param hic
 * @returns
 */
export function initWholeGenomeControls(hic: any) {
	const table = hic.holder.append('table').style('border-spacing', '3px')
	const tr1 = table.append('tr')
	const tr2 = table.append('tr')

	if (hic.enzyme) {
		tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('ENZYME')
		tr2.append('td').text(hic.enzyme)
	}

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('NORMALIZATION')
	const showNMethDiv = tr2.append('td') //placeholder until data is returned from server

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('CUTOFF')
	hic.inputbpmaxv = tr2
		.append('td')
		.append('input')
		.style('width', '70px')
		.attr('type', 'number')
		.property('value', hic.wholegenome.bpmaxv)
		.on('keyup', (event: KeyboardEvent) => {
			if (event.code != 'Enter') return
			const v: any = (event.target as HTMLInputElement).value
			if (v <= 0) return hic.error('invalid cutoff value')
			setmaxv(hic, v)
		})

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('RESOLUTION')
	hic.ressays = tr2.append('td').append('span')

	tr1.append('td').style('color', '#858585').style('font-size', '.7em').text('VIEW')
	const td = tr2.append('td')
	hic.wholegenomebutton = td
		.append('button')
		.style('display', 'none')
		.text('Genome')
		.on('click', () => {
			hic.inwholegenome = true
			hic.inchrpair = false
			hic.indetail = false
			switchview(hic)
		})

	hic.chrpairviewbutton = td
		.append('button')
		.style('display', 'none')
		.on('click', () => {
			hic.inwholegenome = false
			hic.inchrpair = true
			hic.indetail = false
			switchview(hic)
		})

	return showNMethDiv
}

/**
 * setting max value from user input
 * @param hic
 * @param maxv
 * @returns
 */
function setmaxv(hic: any, maxv: any) {
	if (hic.inwholegenome) {
		// viewing whole genome
		hic.wholegenome.bpmaxv = maxv
		if (!hic.wholegenome.lead2follow) return
		const binpx = hic.wholegenome.binpx
		for (const [lead, a] of hic.wholegenome.lead2follow) {
			for (const [follow, b] of a) {
				for (const [leadpx, followpx, v] of b.data) {
					const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
					b.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx.fillRect(followpx, leadpx, binpx, binpx)
					b.ctx2.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx2.fillRect(leadpx, followpx, binpx, binpx)
				}
				b.img.attr('xlink:href', b.canvas.toDataURL())
				if (b.canvas2) {
					b.img2.attr('xlink:href', b.canvas2.toDataURL())
				}
			}
		}
		return
	}
	if (hic.inchrpair) {
		// viewing chr pair
		hic.chrpairview.bpmaxv = maxv
		const binpx = hic.chrpairview.binpx
		for (const [x, y, v] of hic.chrpairview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.chrpairview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.chrpairview.ctx.fillRect(x, y, binpx, binpx)
			if (hic.chrpairview.isintrachr) {
				hic.chrpairview.ctx.fillRect(y, x, binpx, binpx)
			}
		}
		return
	}
	if (hic.indetail) {
		hic.detailview.bpmaxv = maxv
		for (const [x, y, w, h, v] of hic.detailview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.detailview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.detailview.ctx.fillRect(x, y, w, h)
		}
	}
}

/**
 * by clicking buttons
 * only for switching to whole genome view
 * @param hic
 */
function switchview(hic: any) {
	if (hic.inwholegenome) {
		hic.x.td.selectAll('*').remove()
		hic.y.td.selectAll('*').remove()
		hic.c.td.selectAll('*').remove()
		hic.c.td.node().appendChild(hic.wholegenome.svg.node())
		hic.wholegenomebutton.style('display', 'none')
		hic.chrpairviewbutton.style('display', 'none')
		hic.inputbpmaxv.property('value', hic.wholegenome.bpmaxv)
		hic.ressays.text(bplen(hic.wholegenome.resolution) + ' bp')
		nmeth2select(hic, hic.wholegenome.nmeth)
	} else if (hic.inchrpair) {
		hic.y.td.selectAll('*').remove()
		hic.y.td.node().appendChild(hic.chrpairview.axisy.node())
		hic.x.td.selectAll('*').remove()
		hic.x.td.node().appendChild(hic.chrpairview.axisx.node())
		hic.c.td.selectAll('*').remove()
		hic.c.td.node().appendChild(hic.chrpairview.canvas)
		hic.wholegenomebutton.style('display', 'inline-block')
		hic.chrpairviewbutton.style('display', 'none')
		hic.inputbpmaxv.property('value', hic.chrpairview.bpmaxv)
		hic.ressays.text(bplen(hic.chrpairview.resolution) + ' bp')
		nmeth2select(hic, hic.chrpairview.nmeth)
	}
}

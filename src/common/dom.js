import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'
import { font, base_zindex } from '../client'

export function initRadioInputs(opts) {
	const divs = opts.holder
		.selectAll('div')
		.style('display', 'block')
		.data(opts.options, d => d.value)

	divs.exit().each(function(d) {
		d3select(this)
			.on('input', null)
			.on('click', null)
			.remove()
	})

	const labels = divs
		.enter()
		.append('div')
		.style('display', 'block')
		.style('padding', '5px')
		.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', opts.name)
		.attr('value', d => d.value)
		.property('checked', opts.isCheckedFxn)
		.style('vertical-align', 'top')
		.on('input', opts.listeners.input)

	labels
		.append('span')
		.style('vertical-align', 'top')
		.html(d => '&nbsp;' + d.label)

	function isChecked(d) {
		return d.value == radio.currValue
	}

	const radio = {
		main(currValue) {
			radio.currValue = currValue
			inputs.property('checked', isChecked)
		},
		dom: {
			divs: opts.holder.selectAll('div'),
			labels: opts.holder.selectAll('label').select('span'),
			inputs: labels.selectAll('input')
		}
	}

	return radio
}

export class Menu {
	constructor(arg = {}) {
		this.typename = Math.random().toString()

		const body = d3select(document.body)
		body.on('mousedown.menu' + this.typename, () => {
			this.hide()
		})

		this.d = body
			.append('div')
			.attr('class', 'sja_menu_div')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('background-color', 'white')
			.style('font-family', font)
			.on('mousedown.menu' + this.typename, () => {
				d3event.stopPropagation()
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

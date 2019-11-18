import { getInitFxn } from './rx.core'

// the index will be used an input name suffix
// to disambiguate the radio controls with the
// same name but beloging to different control
// component instances
let i = 0

class RadioInput {
	constructor(opts) {
		this.index = i++
		setInteractivity(this)
		setRenderers(this)
		this.setUI(opts)
		this.dom = {
			holder: opts.holder,
			divs: opts.holder.selectAll('div'),
			labels: opts.holder.selectAll('label').select('span'),
			inputs: opts.holder.selectAll('input')
		}

		this.api = {
			main: currValue => {
				this.currValue = currValue
				this.dom.inputs.property('checked', this.isChecked)
			},
			dom: {
				holder: opts.holder,
				divs: opts.holder.selectAll('div'),
				labels: opts.holder.selectAll('label').select('span'),
				inputs: opts.holder.selectAll('input')
			}
		}
	}
}

export const radioInputInit = getInitFxn(RadioInput)

function setRenderers(self) {
	self.setUI = function(opts) {
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
			.attr('name', opts.name + '-' + self.index)
			.attr('value', d => d.value)
			.property('checked', opts.isCheckedFxn)
			.style('vertical-align', 'top')
			.on('input', opts.listeners.input)

		labels
			.append('span')
			.style('vertical-align', 'top')
			.html(d => '&nbsp;' + d.label)
	}
}

function setInteractivity(self) {
	self.isChecked = function(d) {
		return d.value == self.currValue
	}
}

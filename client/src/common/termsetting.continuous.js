import { event as d3event } from 'd3-selection'
const tsInstanceTracker = new WeakMap()
let i = 0

export async function setNumericMethods(self, closureType = 'closured') {
	if (!tsInstanceTracker.has(self)) {
		tsInstanceTracker.set(self, i++)
	}

	if (closureType == 'non-closured') {
		// TODO: always use this non-closured version later
		return {
			get_term_name,
			get_status_msg,
			showEditMenu
		}
	} else {
		// this version maintains a closured reference to 'self'
		// so the 'self' argument does not need to be passed
		//
		// TODO: may convert all other termsetting.*.js methods to
		// just use the non-closured version to simplify
		//
		;(self.get_term_name = d => get_term_name(self, d)),
			(self.get_status_msg = get_status_msg),
			(self.showEditMenu = async div => await showEditMenu(self, div))
	}
}

function get_term_name(self, d) {
	if (!self.opts.abbrCutoff) return d.name
	return d.name.length <= self.opts.abbrCutoff + 2
		? d.name
		: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
}

function get_status_msg() {
	return ''
}

async function showEditMenu(self, div) {
	div
		.style('padding', '10px')
		.selectAll('*')
		.remove()

	div.append('div').style('padding', '10px')

	div
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '3px 10px')
		.html('Scale values')

	const select = div.append('select').on('change', () => {
		if (d3event.target.value != 1) self.q.scale = d3event.target.value
		else delete self.q.scale
		// self.opts.callback({
		// 	term: self.term,
		// 	q: self.q
		// })
	})

	select
		.selectAll('option')
		.data([
			{ html: 'No Scaling', value: 1 },
			{ html: 'Per 10', value: 10 },
			{ html: 'Per 100', value: 100 },
			{ html: 'Per 1000', value: 1000 }
		])
		.enter()
		.append('option')
		.attr('value', d => d.value)
		.html(d => d.html)
		.property('selected', d => (self.q.scale ? d.value == self.q.scale : 0))

	const btndiv = div.append('div').style('padding', '3px 10px')

	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', () => {
			self.q.mode = 'continuous'
			self.opts.callback({
				term: self.term,
				q: self.q
			})
		})

	// btndiv.append('button')
	// 	.style('margin', '5px')
	// 	.html('Reset')
	// 	.on('click', () => {
	// 		self.q.mode = 'discrete'
	// 		delete self.q.scale
	// 		self.opts.callback({
	// 			term: self.term,
	// 			q: self.q
	// 		})
	// 	})
}

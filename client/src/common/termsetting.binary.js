import { event as d3event } from 'd3-selection'

export async function setNumericMethods(self, closureType = 'closured') {

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
		(self.get_term_name = d => get_term_name(self, d)),
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
        .html('binary menu in progress')

	// TODO: 'varying bin size' code from temsettting.discrete.js 
    // and hide/show and disable/enable few dom elements as per requirements 

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

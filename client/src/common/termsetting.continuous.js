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
	div.style('padding', '10px').html('**** TODO: create this menu ***')
}

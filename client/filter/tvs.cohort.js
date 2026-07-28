/*
TVS handler for cohort term
*/

export const handler = {
	type: 'cohort',
	term_name_gen,
	get_pill_label,
	fillMenu
}

async function fillMenu(self, div, tvs) {
	const new_tvs = structuredClone(tvs)
	new_tvs.values = [{ key: tvs.term.id, label: tvs.term.name }]
	self.dom.tip.hide()
	self.opts.callback(new_tvs)
}

function term_name_gen(d) {
	return 'COHORT'
}

function get_pill_label(tvs) {
	if (tvs.values.length != 1) throw 'cohort tvs should only have a single value'
	return { txt: tvs.values[0].label }
}

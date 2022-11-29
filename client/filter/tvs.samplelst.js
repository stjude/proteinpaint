export const handler = {
	term_name_gen,
	get_pill_label
}

function term_name_gen(d) {
	const name = 'sample'
	return name
}

function get_pill_label(tvs) {
	return { txt: ` in ${tvs.term.name}` }
}

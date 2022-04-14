/*
	Will migrate exclude_types:[] to usecase:{}, 
	in order to:
	- centralize the "allowed term" logic
	which can be intricate or dataset-specific 
	for certain terms or contexts
	- also makes it easy to handle new term types,
	rather than scattered across the code base

	Arguments:
	term {}
		.type: 'categorical', etc.
		.included_types: []
	
	use {}
		.target: 'barchart', etc. // may change to chartType 
		.detail: 'term1', 'term2', etc. // optional 
		// may have to add other key-values for more intricate logic
		// for example, regression UI can have its own key-values
		// that other apps or plots do not use and vice-versa
	
	ds

	Returns
	'plot' if the term can be used in a plot chartType
	'tree' if the term can be used only as an expandable tree branch, but not in a plot
	false if the term cannot be used either for plotting or as a tree branch
*/
export function isUsableTerm(term, use, ds) {
	// may apply dataset specific override filter for a use case
	if (ds && ds.usecase && use.target in ds.usecase) {
		return ds.usecase[use.target](term, use)
	}
	// if (term.isprivate && !user.roleCanUse(term)) return false

	// default handling
	switch (use.target) {
		case 'barchart':
			if (term.type && term.type !== 'survival') return 'plot'
			return (term.included_types.length > 1 || term.included_types[0] != 'survival') && 'tree'

		case 'table':
			if (use.detail == 'term') return 'plot'
			return term.included_types.length > 1 && 'tree'

		case 'scatterplot':
			if (user.notlogged.i) if (term.type == 'float' || term.type == 'integer') return 'plot'
			if (term.included_types.includes('float') || term.included_types.includes('integer')) return 'tree'
			return false

		case 'boxplot':
			if (term.type == 'float' || term.type == 'integer') return 'plot'
			if (use.detail === 'term2')
				return (term.included_types.includes('float') || term.included_types.includes('integer')) && 'plot'
			else return false

		case 'cuminc':
			if (use.detail == 'term') {
				if (term.type == 'condition') return 'plot'
				if (term.included_types.includes('condition')) return 'tree'
				return false
			}
			if (use.detail === 'term2') {
				if (term.type == 'survival') return false
				// -- leave it up to user, don't restrict overlay term by ancestry
				// if (usecase.term.ancestors.includes(term.id)) return false

				if (term.isleaf) return 'plot'
				if (term.included_types?.length > 1 || term.included_types?.[0] != 'survival') return 'tree'
				return false
			}
			if (use.detail == 'term0') return 'plot' // any term type can be used to divide charts
			return false

		case 'survival':
			if (use.detail == 'term') {
				if (term.type == 'survival') return 'plot'
				if (term.included_types.includes('survival')) return 'tree'
				return false
			}
			if (use.detail === 'term2') {
				if (term.type == 'survival') return false // For now, do not allow overlaying one survival term over another
				if (term.isleaf) return 'plot'
				if (term.included_types?.length > 1 || term.included_types?.[0] != 'survival') return 'tree'
				return false
			}
			if (use.detail == 'term0') return 'plot' // divide by
			return false

		case 'regression':
			if (use.detail == 'term') {
				// outcome term
				if (use.regressionType == 'linear') {
					return (term.included_types.includes('float') || term.included_types.includes('integer')) && 'plot'
				} else return 'plot'
			}
			if (use.detail == 'independent') {
				return (
					(term.included_types.includes('float') ||
						term.included_types.includes('integer') ||
						term.included_types.includes('categorical')) &&
					'plot'
				)
			}
			return 'plot'

		default:
			return 'plot'
	}
}

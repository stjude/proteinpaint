/*
	Arguments:
	term {}
		.type: 'categorical', etc.
		.included_types: []
	
	use {}
		.target: 'barchart', etc.
		.detail: 'term1', 'term2', etc.
	
	ds

	Returns
	'plot' if the term can be used in a plot chartType
	'tree' if the term can be used only as an expandable tree branch, but not in a plot
	false if the term cannot be used either for plotting or as a tree branch
*/
export function isUsableTerm(term, use, ds) {
	// may apply dataset specific filter for a use case
	if (ds && ds.usecase && use.target in ds.usecase) {
		return ds.usecase[use.target](term, use)
	}

	// default handling
	switch (use.target) {
		case 'barchart':
			if (term.type && term.type !== 'survival') return 'plot'
			return (term.included_types.length > 1 || term.included_types[0] != 'survival') && 'tree'

		case 'table':
			if (use.detail == 'term') return 'plot'
			return term.included_types.length > 1 && 'tree'

		case 'scatterplot':
			if (term.type == 'float' || term.type == 'integer') return 'plot'
			return (term.included_types.includes('float') || term.included_types.includes('integer')) && 'tree'

		case 'boxplot':
			if (use.detail === 'term2')
				return (term.included_types.includes('float') || term.included_types.includes('integer')) && 'plot'
			else return 'tree'

		case 'cuminc':
			if (term.id == 'Arrhythmias') console.log(44, term.id, use.detail)
			if (use.detail == 'term' && term.type == 'condition') return 'plot'
			if (use.detail === 'term2') return 'plot' // any term type can be used as overlay
			return term.included_types.includes('condition') && 'tree'

		case 'survival':
			if (use.detail === 'term2') return 'plot'
			return term.included_types.includes('survival') && 'tree'

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

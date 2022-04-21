const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition', 'survival', 'snplst', 'snplocus'])

/*
	isUsableTerm() will
	- centralize the "allowed term" logic
	which can be intricate or dataset-specific 
	for certain terms or contexts
	- make it easy to handle new term types

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
export function isUsableTerm(term, _usecase, ds) {
	const usecase = _usecase || {}

	// may apply dataset specific override filter for a use case
	if (ds && ds.usecase && use.target in ds.usecase) {
		return ds.usecase[use.target](term, use)
	}
	// if (term.isprivate && !user.roleCanUse(term)) return false

	const uses = new Set()
	// note: expects term.child_types to be null if term.isleaf == true
	const child_types = term.child_types || []

	// default handling
	switch (usecase.target) {
		case 'barchart':
			if (term.type && term.type !== 'survival') uses.add('plot')
			if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
			return uses

		case 'table':
			if (usecase.detail == 'term') uses.add('plot')
			if (child_types.length > 1) uses.add('branch')
			return uses

		case 'scatterplot':
			if (term.type == 'float' || term.type == 'integer') uses.add('plot')
			if (hasNumericChild(child_types)) uses.add('branch')
			return uses

		case 'boxplot':
			if (term.type == 'float' || term.type == 'integer') uses.add('plot')
			if (usecase.detail === 'term2' && hasNumericChild(child_types)) uses.add('branch')
			return uses

		case 'cuminc':
			if (usecase.detail == 'term') {
				if (term.type == 'condition') uses.add('plot')
				if (child_types.includes('condition')) uses.add('branch')
				return uses
			}
			if (usecase.detail === 'term2') {
				if (term.type != 'survival') uses.add('plot')
				// -- leave it up to user, don't restrict overlay term by ancestry
				// if (usecase.term.ancestors.includes(term.id)) return false
				if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
				return uses
			}
			if (usecase.detail == 'term0') {
				uses.add('plot') // any term type can be used to divide charts
				return uses
			}

		case 'survival':
			if (usecase.detail == 'term') {
				if (term.type == 'survival') uses.add('plot')
				if (child_types.includes('survival')) uses.add('branch')
				return uses
			}
			if (usecase.detail === 'term2') {
				if (term.type != 'survival') {
					// do not allow overlaying one survival term over another
					if (term.isleaf) uses.add('plot')
					if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
				}
				return uses
			}
			if (usecase.detail == 'term0') {
				// divide by
				uses.add('plot')
				return uses
			}

		case 'regression':
			if (usecase.detail == 'outcome') {
				if (usecase.regressionType == 'linear') {
					if (term.type == 'float' || term.type == 'integer') uses.add('plot')
					if (hasNumericChild(child_types)) uses.add('branch')
					return uses
				}
				if (usecase.regressionType == 'logistic') {
					if (term.type != 'survival') uses.add('plot')
					if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
					return uses
				} else if (usecase.regressionType == 'cox') {
					if (term.type == 'condition') uses.add('plot')
					if (child_types.includes('condition')) uses.add('branch')
					return uses
				}
			}

			if (usecase.detail == 'independent') {
				if (term.type == 'float' || term.type == 'integer' || term.type == 'categorical') uses.add('branch')
				if (hasChildTypes(child_types, ['categorical', 'float', 'integer'])) uses.add('branch')
				return uses
			}

		default:
			if (graphableTypes.has(term.type)) uses.push('plot')
			if (!term.isleaf) uses.add('branch')
			return uses
	}
}

function hasNonSurvivalTermChild(child_types) {
	if (!child_types.length) return false
	return child_types.length > 1 || child_types[0] != 'survival'
}

function hasNumericChild(child_types) {
	return child_types.includes('float') || child_types.includes('integer')
}

function hasChildTypes(child_types, expected_types) {
	for (const a of expected_types) {
		if (child_types.includes(expected_types)) return true
	}
}

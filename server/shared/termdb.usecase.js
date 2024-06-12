import { TermTypes, isNumericTerm } from './terms.js'

export const graphableTypes = new Set([
	'categorical',
	'integer',
	'float',
	'condition',
	'survival',
	'snplst',
	'snplocus',
	'geneVariant',
	'samplelst',
	'geneExpression',
	TermTypes.METABOLITE_INTENSITY
])
/*
	isUsableTerm() will
	- centralize the "allowed term" logic
	which can be intricate or dataset-specific 
	for certain terms or contexts
	- make it easy to handle new term types

	Arguments:
	term {}
		.type: 'categorical', etc.
		.child_types: []
	
	_usecase {}
		.target (REQUIRED): 'barchart', 'regression', etc
			- used as a switch-case "router" for additional use-specific logic
			- other parameters, if applicable, are described in the route "handler" 
		.detail 
		  - a more specific detailed use case
	
	ds 
	- a bootstrapped dataset object that can supply overrides to the use case logic,
	for example, to apply role-based allowed term uses or performance-related restrictions
	to ancestor terms when a use case aggregates too many data points for a given chart type

	Returns
	a Set{} with zero or more of the following strings:
	- 'plot' if the term can be used in a plot chartType
	- 'branch' if the term can be used only as an expandable tree branch, but not in a plot
	- an empty Set means that the term has no valid uses, i.e, it cannot be used either for plotting or as a tree branch
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
		case 'summary':
			if (usecase.detail == 'term0' && term.type == 'geneVariant') {
				// hide geneVariant terms for Divide by
				return uses
			}
			if (usecase.detail == 'term2' && term.type == 'geneVariant' && usecase.term1type == 'geneVariant') {
				// hide geneVariant terms for Overlay when term1 is a geneVariant term
				return uses
			}
			if (term.type && term.type !== 'survival') uses.add('plot')
			if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
			return uses

		case 'matrix':
			if (term.type) uses.add('plot')
			if (!term.isleaf) uses.add('branch')
			return uses

		case 'table':
			if (usecase.detail == 'term') uses.add('plot')
			if (child_types.length > 1) uses.add('branch')
			return uses
		//This case might not be used anymore, to be checked!!!
		case 'scatterplot':
			if (term.type == 'float' || term.type == 'integer') uses.add('plot')
			if (hasNumericChild(child_types)) uses.add('branch')
			return uses

		case 'sampleScatter':
			if (usecase.detail == 'numeric') {
				if (isNumericTerm(term)) {
					uses.add('plot')
				}
				if (hasNumericChild(child_types)) uses.add('branch')
			} else {
				if (graphableTypes.has(term.type)) uses.add('plot')
				if (!term.isleaf) uses.add('branch')
			}

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
				if (term.type && term.type != 'survival') uses.add('plot')
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
					if (term.type) uses.add('plot')
					if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
				}
				return uses
			}
			if (usecase.detail == 'term0') {
				// divide by
				if (term.type) uses.add('plot')
				if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
				return uses
			}

			if (term.isleaf) uses.add('plot')
			else uses.add('branch')
			return uses

		case 'regression':
			if (usecase.detail == 'outcome') {
				if (usecase.regressionType == 'linear') {
					if (term.type == 'float' || term.type == 'integer') uses.add('plot')
					if (hasNumericChild(child_types)) uses.add('branch')
					return uses
				}
				if (usecase.regressionType == 'logistic') {
					if (term.type && term.type != 'survival') uses.add('plot')
					if (hasNonSurvivalTermChild(child_types)) uses.add('branch')
					return uses
				} else if (usecase.regressionType == 'cox') {
					if (term.type == 'condition' || term.type == 'survival') uses.add('plot')
					if (child_types.includes('condition') || child_types.includes('survival')) uses.add('branch')
					return uses
				}
			}

			if (usecase.detail == 'independent') {
				if (term.type == 'float' || term.type == 'integer' || term.type == 'categorical') uses.add('plot')
				if (hasChildTypes(child_types, ['categorical', 'float', 'integer'])) uses.add('branch')
				return uses
			}

		default:
			if (graphableTypes.has(term.type)) uses.add('plot')
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
		if (child_types.includes(a)) return true
	}
}

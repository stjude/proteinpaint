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
	'dtcnv',
	'dtsnvindel',
	'dtfusion',
	'dtsv',
	'date',
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.SINGLECELL_GENE_EXPRESSION,
	TermTypes.SINGLECELL_CELLTYPE,
	TermTypes.SNP
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
	

	termdbConfig
		optional. provides ds overrides on default rules via excludedTermtypeByTarget. for use on client

	ds
		optional. provides ds overrides when the function runs on backend
		server-side dataset object that can supply overrides (in the form of functions) to the use case logic,
		for example, to apply role-based allowed term uses or performance-related restrictions
		to ancestor terms when a use case aggregates too many data points for a given chart type

Returns

	a Set{} with zero or more of the following strings:
	- 'plot' if the term can be used in a plot chartType
	- 'branch' if the term can be used only as an expandable tree branch, but not in a plot
	- an empty Set means that the term has no valid uses, i.e, it cannot be used either for plotting or as a tree branch
*/
export function isUsableTerm(term, _usecase, termdbConfig, ds) {
	const usecase = _usecase || {}

	// may apply dataset specific override filter for a use case
	if (typeof ds?.usecase?.[use.target] == 'function') {
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
			if (term.type && term.type !== 'survival') uses.add('plot')
			if (hasAllowedChildTypes(child_types, ['survival'])) uses.add('branch')
			return uses

		case 'matrix':
			if (term.type) uses.add('plot')
			if (!term.isleaf) uses.add('branch')
			return uses

		case 'table':
			if (usecase.detail == 'term') uses.add('plot')
			if (child_types.length > 1) uses.add('branch')
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
		case 'runChart':
			if (usecase.detail == 'date') {
				if (term.type == 'date') {
					uses.add('plot')
				}
				if (child_types.includes('date')) uses.add('branch')
			} else if (usecase.detail == 'numeric') {
				if (isNumericTerm(term) && term.type != 'date') {
					uses.add('plot')
				}
				if (hasNumericChild(child_types)) uses.add('branch')
			} else {
				if (graphableTypes.has(term.type)) uses.add('plot')
				if (!term.isleaf) uses.add('branch')
			}
			return uses
		case 'frequencyChart':
			if (usecase.detail == 'term') {
				if (term.type == 'date') {
					uses.add('plot')
				}
				if (child_types.includes('date')) uses.add('branch')
			} else if (usecase.detail == 'numeric') {
				if (isNumericTerm(term) && term.type != 'date') {
					uses.add('plot')
				}
				if (hasNumericChild(child_types)) uses.add('branch')
			} else {
				if (graphableTypes.has(term.type)) uses.add('plot')
				if (!term.isleaf) uses.add('branch')
			}
			return uses
		case 'numericDictTermCluster':
			if (!usecase.detail?.exclude?.includes(term.id)) {
				if (isNumericTerm(term)) {
					uses.add('plot')
				}
				if (hasNumericChild(child_types)) {
					uses.add('branch')
				}
			}
			return uses

		case 'profileForms':
			if (!term.isleaf) {
				const ancestors = term.id.split('__').length //depends on using the __ naming convension!
				if (ancestors == 3) {
					// 3rd level term is a domain, we show the templates associated to this domain
					uses.add('plot')
				} else if (ancestors < 3) uses.add('branch')
			}
			return uses

		// case 'boxplot':
		// 	if (term.type == 'float' || term.type == 'integer') uses.add('plot')
		// 	if (usecase.detail === 'term2' && hasNumericChild(child_types)) uses.add('branch')
		// 	return uses

		case 'cuminc':
			if (usecase.detail == 'term') {
				if (term.type == 'condition') uses.add('plot')
				if (child_types.includes('condition')) uses.add('branch')
				return uses
			}
			if (usecase.detail === 'term2' || usecase.detail == 'term0') {
				if (term.type && term.type != 'condition' && term.type != 'survival') uses.add('plot')
				if (hasAllowedChildTypes(child_types, ['condition', 'survival'])) uses.add('branch')
				return uses
			}

		case 'survival':
			if (usecase.detail == 'term') {
				if (term.type == 'survival') uses.add('plot')
				if (child_types.includes('survival')) uses.add('branch')
				return uses
			}
			if (usecase.detail === 'term2' || usecase.detail == 'term0') {
				if (term.type && term.type != 'survival') uses.add('plot')
				if (hasAllowedChildTypes(child_types, ['survival'])) uses.add('branch')
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
					if (term.type && term.type != 'survival') uses.add('plot')
					if (hasAllowedChildTypes(child_types, ['survival'])) uses.add('branch')
					return uses
				} else if (usecase.regressionType == 'cox') {
					if (term.type == 'condition' || term.type == 'survival') uses.add('plot')
					if (child_types.includes('condition') || child_types.includes('survival')) uses.add('branch')
					return uses
				}
			}

			if (usecase.detail == 'independent') {
				if (term.type == 'float' || term.type == 'integer' || term.type == 'categorical' || term.type == 'samplelst')
					uses.add('plot')
				if (hasChildTypes(child_types, ['categorical', 'float', 'integer'])) uses.add('branch')
				return uses
			}

		case 'filter':
			// apply "exlst" to other targets as needed
			const exlst = termdbConfig?.excludedTermtypeByTarget?.filter
			if (exlst) {
				if (graphableTypes.has(term.type) && !exlst.includes(term.type)) uses.add('plot')
				if (child_types.find(t => !exlst.includes(t))) uses.add('branch') // there's a non-excluded child type, allow branch to show
				return uses
			}
		// no specific rule for filter. pass and use default rules

		case 'correlationVolcano':
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

		default:
			if (graphableTypes.has(term.type)) uses.add('plot')
			if (!term.isleaf) uses.add('branch')
			return uses
	}
}

// determine if the term has at least one child type that
// is not excluded
function hasAllowedChildTypes(child_types, excluded_types) {
	if (!child_types.length) {
		// term does not have children
		return false
	}
	if (!excluded_types?.length) {
		// no excluded types
		return true
	}
	if (child_types.some(type => !excluded_types.includes(type))) {
		// at least one child type is not excluded
		return true
	}
}

function hasNumericChild(child_types) {
	return child_types.includes('float') || child_types.includes('integer')
}

function hasChildTypes(child_types, expected_types) {
	for (const a of expected_types) {
		if (child_types.includes(a)) return true
	}
}

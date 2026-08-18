import { isNumericTerm } from './terms.js'
import { TermTypes, SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, ISOFORM_EXPRESSION } from '#types'

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
	ISOFORM_EXPRESSION,
	'dtcnv',
	'dtsnvindel',
	'dtfusion',
	'dtsv',
	'date',
	TermTypes.SSGSEA,
	TermTypes.DNA_METHYLATION,
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.PROTEOME_ABUNDANCE,
	TermTypes.PSEUDOBULK,
	TermTypes.JUNCTION,
	SINGLECELL_GENE_EXPRESSION,
	SINGLECELL_CELLTYPE,
	TermTypes.SNP,
	TermTypes.TERM_COLLECTION,
	TermTypes.COHORT,
	TermTypes.MULTIVALUE
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
export function isUsableTerm(term, _usecase, termdbConfig?: any, ds?: any) {
	const usecase = _usecase || {}

	// may apply dataset specific override filter for a use case
	if (typeof ds?.usecase?.[usecase.target] == 'function') {
		return ds.usecase[usecase.target](term, usecase)
	}

	// if (term.isprivate && !user.roleCanUse(term)) return false

	const uses = new Set()
	// note: expects term.child_types to be null if term.isleaf == true
	const child_types = term.child_types || []
	// default handling
	switch (usecase.target) {
		case 'barchart':
		case 'violin':
		case 'boxplot':
		case 'summary': {
			// multivalue is excluded as overlay (term2): a sample can belong to multiple
			// categories, which inflates stacked segments past the bar's sample count and
			// invalidates the term1-term2 association tests. it remains allowed as term1
			// and as divide-by (term0), where each chart is a self-contained subset
			const excluded = usecase.detail == 'term2' ? ['survival', 'multivalue'] : ['survival']
			if (term.type && !excluded.includes(term.type)) uses.add('plot')
			if (hasAllowedChildTypes(child_types, excluded)) uses.add('branch')
			return uses
		}

		case 'summaryInput':
			if (usecase.detail === 'term2' || usecase.detail == 'term0') {
				// same overlay exclusion as the barchart/violin/boxplot/summary case above
				const excluded = usecase.detail === 'term2' ? ['survival', 'multivalue'] : ['survival']
				if (term.type && !excluded.includes(term.type)) uses.add('plot')
				if (hasAllowedChildTypes(child_types, excluded)) uses.add('branch')
				return uses
			} else {
				if (graphableTypes.has(term.type)) uses.add('plot')
				if (!term.isleaf) uses.add('branch')
				return uses
			}

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
			}
			// Commenting out for now. May need later for another single
			// cell term. Revisit logic at that time.
			// else if (usecase?.specialCase?.type == 'singleCell') {
			// 		if (term.type && term.type.startsWith('singleCell')) {
			// 			if (term.plot && term.plot == usecase.specialCase?.config.name) {
			// 				uses.add('plot')
			// 			}
			// 		}
			// }
			else {
				// multivalue is excluded: a sample belonging to multiple categories
				// cannot be assigned a single color/shape
				if (graphableTypes.has(term.type) && term.type != 'multivalue') uses.add('plot')
				if (!term.isleaf) uses.add('branch')
			}
			return uses
		case 'runChart2':
			if (usecase.detail == 'date' || usecase.detail == 'xtw') {
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
				// multivalue is excluded: overlapping categories are not supported by this chart
				if (graphableTypes.has(term.type) && term.type != 'multivalue') uses.add('plot')
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

		case 'termCollections':
			if (usecase.detail?.termIds?.includes(term.id)) uses.add('plot')
			if (usecase.detail?.branchIds?.includes(term.id)) uses.add('branch')
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
				// multivalue is excluded: a sample can belong to multiple groups at once,
				// which would place it on multiple incidence curves and invalidate group comparison
				if (term.type && term.type != 'condition' && term.type != 'survival' && term.type != 'multivalue')
					uses.add('plot')
				if (hasAllowedChildTypes(child_types, ['condition', 'survival', 'multivalue'])) uses.add('branch')
				return uses
			}
			return uses

		case 'survival':
			if (usecase.detail == 'term') {
				if (term.type == 'survival') uses.add('plot')
				if (child_types.includes('survival')) uses.add('branch')
				return uses
			}
			if (usecase.detail === 'term2' || usecase.detail == 'term0') {
				// multivalue is excluded: overlapping group membership would place a sample
				// on multiple survival curves and invalidate group comparison
				if (term.type && term.type != 'survival' && term.type != 'multivalue') uses.add('plot')
				if (hasAllowedChildTypes(child_types, ['survival', 'multivalue'])) uses.add('branch')
				return uses
			}
			return uses

		case 'regression':
			if (usecase.detail == 'outcome') {
				if (usecase.regressionType == 'linear') {
					if (term.type == 'float' || term.type == 'integer') uses.add('plot')
					if (hasNumericChild(child_types)) uses.add('branch')
					return uses
				}
				if (usecase.regressionType == 'logistic') {
					// multivalue is excluded: overlapping group membership cannot define a binary outcome
					if (term.type && term.type != 'survival' && term.type != 'multivalue') uses.add('plot')
					if (hasAllowedChildTypes(child_types, ['survival', 'multivalue'])) uses.add('branch')
					return uses
				} else if (usecase.regressionType == 'cox') {
					if (term.type == 'condition' || term.type == 'survival') uses.add('plot')
					if (child_types.includes('condition') || child_types.includes('survival')) uses.add('branch')
					return uses
				}
			}

			if (usecase.detail == 'independent') {
				/* a term collection holds one value per member term, which is not a model variable.
				only a numeric collection is offered, and only as a fraction: selecting it opens the
				numerator/denominator chooser (client/termdb/handlers/termCollectionFractionSelection.ts),
				which reduces the collection to one numeric value per sample. a categorical collection
				has no such scalar form. the outcome is excluded above: it must be a dictionary term,
				as enforced by TermdbVocab.getRegressionData() */
				if (term.type == TermTypes.TERM_COLLECTION) {
					// memberType is read directly: isNumTermCollection() does not yet test it
					if (term.memberType == 'numeric') uses.add('plot')
					return uses
				}
				if (term.type == 'float' || term.type == 'integer' || term.type == 'categorical' || term.type == 'samplelst')
					uses.add('plot')
				if (hasChildTypes(child_types, ['categorical', 'float', 'integer'])) uses.add('branch')
				return uses
			}
			return uses

		case 'filter': {
			// apply "exlst" to other targets as needed
			const exlst = termdbConfig?.excludedTermtypeByTarget?.filter
			if (exlst) {
				if (graphableTypes.has(term.type) && !exlst.includes(term.type)) uses.add('plot')
				if (child_types.find(t => !exlst.includes(t))) uses.add('branch') // there's a non-excluded child type, allow branch to show
				return uses
			}
			// no specific rule for filter. use default rules
			if (graphableTypes.has(term.type)) uses.add('plot')
			if (!term.isleaf) uses.add('branch')
			return uses
		}

		case 'correlationVolcano':
			if (usecase.detail == 'numeric') {
				if (isNumericTerm(term)) {
					uses.add('plot')
				}
				if (hasNumericChild(child_types)) uses.add('branch')
			} else {
				// multivalue is excluded: overlapping categories are not supported by this chart
				if (graphableTypes.has(term.type) && term.type != 'multivalue') uses.add('plot')
				if (!term.isleaf) uses.add('branch')
			}
			return uses

		case 'proteinView':
			if (term.type == TermTypes.PROTEOME_ABUNDANCE) uses.add('plot')
			if (child_types.includes(TermTypes.PROTEOME_ABUNDANCE)) uses.add('branch')
			return uses

		case 'dictionary':
			// dictionary browsing must show every graphable term, including multivalue
			if (graphableTypes.has(term.type)) uses.add('plot')
			if (!term.isleaf) uses.add('branch')
			return uses

		default:
			/* multivalue is excluded by default: a sample can belong to multiple
			categories at once, which a chart must explicitly support (see the
			barchart/violin/matrix cases above). a new chart type that wants
			multivalue terms must add its own case rather than rely on default */
			if (graphableTypes.has(term.type) && term.type != 'multivalue') uses.add('plot')
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

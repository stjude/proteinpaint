import initBinConfig from '#shared/termdb.initbinconfig.js'
import { TermdbVocab } from './TermdbVocab'
import { FrontendVocab } from './FrontendVocab'
import { isNumeric } from '#shared/helpers.js'
import { TermTypes } from '#shared/terms.js'

export function vocabInit(opts) {
	/*** start legacy support for state.genome, .dslabel ***/
	if (opts.vocab && !opts.state) {
		opts.state = { vocab: opts.vocab }
	}
	if (!opts.state) throw 'missing opts.state'
	if (!opts.state.vocab) {
		opts.state.vocab = opts.vocab ? opts.vocab : {}
	}
	const vocab = opts.state.vocab
	if (opts.state.genome) {
		vocab.genome = opts.state.genome
		delete opts.state.genome
	}
	if (opts.state.dslabel) {
		vocab.dslabel = opts.state.dslabel
		delete opts.state.dslabel
	}
	/*** end legacy support ***/

	if (vocab.dslabel) {
		//const { TermdbVocab } = await import('./TermdbVocab')
		return new TermdbVocab(opts)
	} else if (vocab.terms) {
		//const { FrontendVocab } = await import('./FrontendVocab')
		const vocabApi = new FrontendVocab(opts)
		if (vocab.parent_termdbConfig) {
			// parent termdbConfig is provided to track termdbConfig
			// from parent dataset (e.g. geneVariant term generates
			// a frontend vocab of dt terms, but this frontend vocab
			// still needs to track termdbConfig properties from the
			// parent dataset, see setVocabApi() in client/filter/tvs.dt.js)
			vocabApi.parent_termdbConfig = vocab.parent_termdbConfig
		}
		return vocabApi
	} else {
		throw `unable to initialize vocabApi`
	}
}

export function q_to_param(q) {
	// exclude certain attributes of q from dataName
	const q2 = JSON.parse(JSON.stringify(q))
	delete q2.hiddenValues
	return encodeURIComponent(JSON.stringify(q2))
}

// to-do
// class Mds3Vocab {}

export function getVocabFromSamplesArray({ samples, sample_attributes }) {
	const terms = {
		__root: {
			id: 'root',
			name: 'root',
			__tree_isroot: true
		}
	}
	const sanno = {}
	for (const a of samples) {
		const s = a.sample
		if (!sanno[s]) sanno[s] = {}
		// in case a sample has more than one annotation object in the array
		Object.assign(sanno[s], a.s)

		// generate term definitions from
		for (const key in a.s) {
			if (!terms[key]) {
				const name = sample_attributes[key] && sample_attributes[key].label ? sample_attributes[key].label : key
				terms[key] = {
					id: key,
					name,
					parent_id: null,
					type:
						sample_attributes[key].type == 'float'
							? 'float'
							: sample_attributes[key].type == 'integer'
							? 'integer'
							: // need to work with the cloud/PROPEL team to define type for legacy scatterplot usage
							  'categorical',
					values: {},
					isleaf: true
				}
			}
			const t = terms[key]
			if (!('id' in t)) t.id = key
			if (!('parent_id' in t)) t.parent_id = null
			if (!('values' in t)) t.values = {}
			if (!('isleaf' in t)) t.isleaf = true
			if (!t.computableVals && (t.type == 'float' || t.type == 'integer')) {
				t.computableVals = [] // will be used to initialize binconfig for numeric terms
			}

			const value = a.s[key]
			if (t.type == 'categorical') {
				t.groupsetting = { disabled: true }
				if (!(value in t.values)) {
					t.values[value] = { key: value, label: value }
				}
			} else if (t.type == 'integer' || t.type == 'float') {
				// may need to auto-detect more string values that
				// can be assumed to be non-numeric here, like "N/A"
				if (value === 'Not Available' && !(value in t.values)) {
					t.values[value] = { label: value, uncomputable: true }
				}
				if (!(value in t.values)) {
					if (!isNumeric(a.s[key])) throw `non-numeric term value='${value}' for term='${key}'`
					a.s[key] = Number(a.s[key])
					const val = a.s[key]
					t.computableVals.push(val)
				}
			} else if (t.type == 'condition') {
				//TODO: add logic for conditional terms
			} else if (t.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
				//TODO: add logic for conditional terms
			} else {
				throw 'Term type not supported:' + t.type
			}
		}
	}

	for (const key in terms) {
		const t = terms[key]
		if ((t.type == 'integer' || t.type == 'float') && !t.bins) {
			t.bins = {
				default: initBinConfig(t.computableVals)
			}
			delete t.computableVals
		}
	}

	return {
		sampleannotation: sanno,
		terms: Object.values(terms)
	}
}

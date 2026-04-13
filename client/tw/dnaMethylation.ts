import type { RawDnaMethylationTerm, VocabApi } from '#types'
import { type TwOpts } from './TwBase.ts'
import { DNA_METHYLATION } from '#shared/terms.js'

const termType = DNA_METHYLATION

export class DnaMethylationBase {
	id: string
	name: string
	unit: string

	static async fill(term: RawDnaMethylationTerm, opts: TwOpts) {
		DnaMethylationBase.validate(term)
		if (!term.id) term.id = makeDNAMethTermId(term)
		if (!term.name) {
			term.unit = getDNAMethUnit(term.genomicFeatureType, opts.vocabApi)
			term.name = getDNAMethTermName(term)
		}
	}

	static validate(term: RawDnaMethylationTerm) {
		if (!term || typeof term !== 'object') throw 'Term is missing or not an object'
		if (term.type != termType) throw `Incorrect term.type='${term?.type}', expecting '${termType}'`
		if (!term.chr || !Number.isInteger(term.start) || !Number.isInteger(term.stop))
			throw 'Incomplete coordinate in term{}'
		if (!term.genomicFeatureType) throw 'Missing term.genomicFeatureType'
	}

	constructor(term: RawDnaMethylationTerm, opts: TwOpts) {
		DnaMethylationBase.validate(term)
		this.id = term.id || makeDNAMethTermId(term)
		this.unit = term.unit || getDNAMethUnit(term.genomicFeatureType, opts.vocabApi)
		this.name = term.name || getDNAMethTermName(term, this.unit)
	}
}

function makeDNAMethTermId(term: RawDnaMethylationTerm) {
	return `${term.chr}:${term.start}-${term.stop}`
}

/** Function standardizes DNA methylation units */
export function getDNAMethUnit(genomicFeatureType: string, vocabApi: VocabApi) {
	switch (genomicFeatureType) {
		case 'gene':
			return vocabApi.termdbConfig.queries.dnaMethylation?.unit || 'Average Beta Value'
		case 'promoter':
			return vocabApi.termdbConfig.queries.dnaMethylation?.promoter?.unit || 'Average M-value'
		default:
			return 'Average Beta Value'
	}
}

/** Function standardizes DNA methylation term name
 * May evolve over time. For example, unit may be optional in the future. */
export function getDNAMethTermName(term: RawDnaMethylationTerm, termUnit?: string) {
	const unit = term.unit || termUnit

	switch (term.genomicFeatureType) {
		case 'promoter':
			return `Promoter ${unit} (${term.id})` //term.id is expected to be in "chr:start-stop" format
		case 'gene':
			return `${term.featureName} - Promoter ${unit} (${term.id})`
		default:
			return `${term.id} ${unit}`
	}
}

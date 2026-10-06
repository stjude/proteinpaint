import type { NumericBaseTerm, NumericQ, PresetNumericBins, NumTW, RawNumTW } from './numeric.ts'

export type DnaMethylationQ = NumericQ & { dt?: number }

export type DnaMethylationTerm = NumericBaseTerm & {
	type: 'dnaMethylation'
	/** concatenated string value "chr:start-stop" */
	id?: string
	chr: string
	start: number
	stop: number
	/** Type used to categorize the genomic feature */
	genomicFeatureType: 'gene' | 'promoter' | 'region' | 'enhancer'
	/** Key of the element matrix the term's element was tested in, one of
	 * termdbConfig.queries.dnaMethylation.elementTypes[].key. Set on a term opened from a
	 * differential methylation hit; when absent the dataset's default matrix answers the term. */
	elementType?: string
	bins?: PresetNumericBins
}

export type RawDnaMethylationTerm = DnaMethylationTerm & {
	/** Name of the genomic feature, e.g., gene name or promoter id/name, etc.
	 * Different than .name, which includes the genomic coordinates and unit,
	 * and is used for display purposes.*/
	featureName?: string
	name?: string
	unit?: string
}

export type DnaMethylationTW = NumTW & { term: DnaMethylationTerm }

export type RawDnaMethylationTW = RawNumTW & { term: RawDnaMethylationTerm }

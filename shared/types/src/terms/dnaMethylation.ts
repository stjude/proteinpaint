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

import type { NumericBaseTerm, NumericQ, PresetNumericBins, NumTW, RawNumTW } from './numeric.ts'

export type DnaMethylationQ = NumericQ & { dt?: number }

export type DnaMethylationTerm = NumericBaseTerm & {
	/** term.id: plan to be concatenated string value "chr:start-stop" */
	/** term.name: can be user-assigned */
	name: string
	type: 'dnaMethylation'
	chr: string
	start: number
	stop: number
	bins?: PresetNumericBins
	unit?: string
}

export type RawDnaMethylationTerm = DnaMethylationTerm & {
	name?: string
}

export type DnaMethylationTW = NumTW & { term: DnaMethylationTerm }

export type RawDnaMethylationTW = RawNumTW & { term: DnaMethylationTerm }

import type { NumericBaseTerm, NumTW, PresetNumericBins, RawNumTW } from '../index.ts'

export type JunctionTerm = NumericBaseTerm & {
	type: 'junction'
	chr: string
	start: number
	stop: number
	strand: '+' | '-' | '?'
	/** to be fully documented */
	info: any
	bins?: PresetNumericBins
}

export type JunctionTW = NumTW & { term: JunctionTerm }

export type RawJunctionTerm = JunctionTerm

export type RawJunctionTW = RawNumTW & { term: RawJunctionTerm }

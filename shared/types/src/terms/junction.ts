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
	/** the value of a sample. Absent: the read count of the junction.
	'IR' (JT_ir): the IR ratio of the sample, of the intron between the two ends of the junction */
	measure?: 'IR'
}

export type JunctionTW = NumTW & { term: JunctionTerm }

export type RawJunctionTerm = JunctionTerm

export type RawJunctionTW = RawNumTW & { term: RawJunctionTerm }

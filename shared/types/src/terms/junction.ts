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
	'IR' (JT_ir): the IR ratio of the sample, of the intron between the two ends of the junction.
	'share': the junction's reads as a percent of all the reads of the junctions of .gene in .region, as the junction
	track's group test takes it (server j2/validate.ts junctionShares()); a sample without reads of the gene has none */
	measure?: 'IR' | 'share'
	/** with measure 'share': the gene whose junction reads are the denominator */
	gene?: string
	/** with measure 'share': the region whose junctions of .gene are summed, on .chr and around the junction */
	region?: { chr: string; start: number; stop: number }
}

export type JunctionTW = NumTW & { term: JunctionTerm }

export type RawJunctionTerm = JunctionTerm

export type RawJunctionTW = RawNumTW & { term: RawJunctionTerm }

import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

/** Per-sample CpG methylation along one gene, next to the gene's expression in the same samples */
export type MethylationLocusRequest = {
	genome: string
	dslabel: string
	/** gene symbol: samples are sorted by its expression, which each bin is correlated with, and without a region
	the locus is an isoform of it with 5 kb added on each side. Required unless region is given. */
	gene?: string
	/** isoform of the gene that sets the locus; default is the gene's default isoform. Expression stays gene-level. */
	isoform?: string
	/** the locus to read instead of the isoform and its flanks, e.g. the view range of a genome browser track */
	region?: { chr: string; start: number; stop: number }
	/** number of bins the locus is cut into, default 40; a locus with no more CpGs than this gets one bin per CpG */
	nbins?: number
	filter?: Filter
	filter0?: any
	/** optional samplelst tw (e.g. the two groups of a volcano), returned as each sample's group */
	groupTw?: TermWrapper
	__protected__?: any
}

export type MethylationLocusBin = {
	/** first and last CpG of the bin, so a region term built from them reads the same CpGs */
	start: number
	stop: number
	nCpg: number
	/** per sample, aligned with samples[]: pooled methylated reads / pooled reads; null below the depth floor */
	beta: (number | null)[]
	/** Spearman rho of beta vs expression; absent when the bin has too few values or no variance */
	rho?: number
	/** BH-adjusted p across the bins with a rho */
	q?: number
	/** rho and q within each group, in the order of response.groups; present when groups were requested */
	byGroup?: { group: string; rho?: number; q?: number }[]
}

/** an isoform as the genome's gene db stores it; each feature is a list of [start, stop] */
export type MethylationLocusIsoform = {
	isoform: string
	chr: string
	start: number
	stop: number
	strand: string
	isdefault: boolean
	exon: [number, number][]
	intron?: [number, number][]
	coding?: [number, number][]
	utr5?: [number, number][]
	utr3?: [number, number][]
	cdslen?: number
	codingstart?: number
	codingstop?: number
}

export type MethylationLocusResponse =
	| {
			/** the isoform that sets the locus; with isoforms, unit and samples[].value, present when a gene was requested */
			gene?: MethylationLocusIsoform
			/** every isoform of the gene, for choosing one and marking their TSSs */
			isoforms?: MethylationLocusIsoform[]
			region: { chr: string; start: number; stop: number }
			/** unit of samples[].value, e.g. TPM */
			unit?: string
			/** ascending by the gene's expression (value) when a gene was requested */
			samples: { name: string; value?: number; group?: string }[]
			/** the requested groups that have samples here, in request order; with two, the difference is the second minus the first */
			groups?: string[]
			bins: MethylationLocusBin[]
	  }
	| { error: string }

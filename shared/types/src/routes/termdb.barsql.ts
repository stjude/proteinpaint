import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Term } from '../terms/term.ts'

type JsonObject = Record<string, unknown>

export type TermdbBarSqlRequest = {
	genome: string
	dslabel: string
	embedder?: string

	term0?: TermWrapper | Term
	term1?: TermWrapper | Term
	term2?: TermWrapper | Term

	filter?: Filter
	filter0?: JsonObject

	/** hidden term1 and term2 labels excluded from association-test calculations */
	hiddenValues?: { term1: string[]; term2: string[] }

	/** identifies a genotype-by-sample file previously loaded via loadfile_ssid(), for VCF-genotype overlay bars */
	ssid?: string
	chr?: string
	pos?: number | string
	term2_is_genotype?: boolean
}

export type BarBoxplotStat = {
	w1?: number
	w2?: number
	p05?: number
	p25?: number
	p50?: number
	p75?: number
	p95?: number
	iqr?: number
	out: unknown[]
	mean?: number
	sd?: number
	min?: number
	max?: number
}

export type BarDataEntry = {
	dataId: string
	total: number
}

export type BarSeries = {
	seriesId: string
	data: BarDataEntry[]
	total: number
	boxplot?: BarBoxplotStat
	/** allele frequency, only computed when ds.track.vcf.termdb_bygenotype.getAF is configured and term2_is_genotype is set */
	AF?: unknown
}

export type BarChart = {
	chartId: string
	total: number
	maxSeriesTotal: number
	serieses: BarSeries[]
	dedupedSerieses: BarSeries[]
	/** only set for a membership-multivalue term1: distinct sample count across its (overlapping) bars */
	visibleDistinctTotal?: number
	/** only set for a membership-multivalue term1 with no term2: distinct sample count per synthesized overlay segment */
	distinctSegmentTotals?: Record<string, number>
}

export type BarRefs = {
	cols?: unknown[]
	dedupCols?: unknown[]
	colgrps?: string[]
	rows?: unknown[]
	rowgrps?: string[]
	col2name?: JsonObject
	row2name?: JsonObject
	useColOrder?: boolean
	useRowOrder?: boolean
	bins?: unknown[]
	q?: JsonObject[]
	[key: string]: unknown
}

export type BarData = {
	charts: BarChart[]
	refs?: BarRefs
	maxAcrossCharts?: number
	tests?: Record<string, unknown[]>
	min?: number
	max?: number
	boxplot?: BarBoxplotStat
	times?: { sql: number; pj: number }
}

export type BarSqlResponse = {
	data: BarData
	/** per term0/term1/term2 index: that term's bins (data.refs.byTermId[id].bins), or [] when absent */
	bins: unknown[][]
	/** per term0/term1/term2 index: that term's categories (data.refs.byTermId[id].categories), or [] when absent */
	categories: unknown[][]
	sampleType?: { name: string; plural_name: string; parent_id?: string | null }
	/** only set when term1 or term2 is a geneVariant term without groupsetting: chart id (dt+origin label) -> a minimal dt term used to render its legend */
	chartid2dtterm?: Record<string, JsonObject>
}

export type TermdbBarsqlResponse =
	| BarSqlResponse
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only

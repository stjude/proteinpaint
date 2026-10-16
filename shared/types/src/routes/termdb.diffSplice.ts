import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

export type DiffSpliceMethod = 'edgeR' | 'leafcutter'

export type DiffSpliceRequest = {
	kind: 'DS'
	genome: string
	dslabel: string
	samplelst: any
	/** which engine. absent = server default (edgeR) */
	method?: DiffSpliceMethod
	/** leafcutter's own filters, applied by both engines so they test the same cluster set.
	 * All are absolute integer counts. minSamplesPerIntron and minSamplesPerGroup are sample
	 * counts, derived by the client from fractions of N with a floor (see validateDSSettings);
	 * minCountsPerCluster is a read count and does not scale with N. */
	minSamplesPerIntron: number
	minSamplesPerGroup: number
	minCountsPerCluster: number
	tw?: any
	tw2?: any
	preAnalysis?: boolean
	clusterId?: string
	volcanoRender: VolcanoRenderRequest
	signal?: any
	__protected__?: any
}

/** One intron cluster. Deliberately engine-independent: edgeR::diffSpliceDGE and the
 * leafcutter DM model have different native granularities, but both are normalized to
 * the cluster here so nothing downstream branches on which engine ran. */
export type DiffSpliceEntry = DataEntry & {
	cluster_id: string
	/** comma-joined; a cluster may span more than one gene, and may be empty */
	genes: string
	n_junc: number
	/** the effect size, the x axis, and the unit foldChangeCutoff is interpreted in */
	delta_psi: number
	top_intron: string
	psi_control: number
	psi_case: number
	chr: string
	start: number
	stop: number
	/** engine-specific extras; never read by the volcano */
	leafcutter?: { junction_effects: { intron: string; dpsi: number }[]; status: string }
}

export type DiffSplicePreAnalysisResponse = {
	data: { [groupName: string]: number }
	alert?: string
}

export type DiffSpliceFullResponse = {
	data: VolcanoData<DiffSpliceEntry>
	sample_size1: number
	sample_size2: number
	/** what actually ran — may differ from what was requested */
	method: DiffSpliceMethod
	/** clusters that entered the test, and why the rest were dropped */
	skipped?: { [reason: string]: number }
}

/** One tested junction of a cluster. start/stop follow the junction track: the 0-based
 * positions of the last base of the left exon and the first base of the right exon. */
export type DiffSpliceJunction = {
	chr: string
	start: number
	stop: number
	/** raw p of the junction's own test, against the rest of its cluster */
	p: number
	/** group-mean PSI; null when no sample of the group covers the cluster */
	psi_control: number | null
	psi_case: number | null
}

export type DiffSpliceJunctionsResponse = {
	junctions: DiffSpliceJunction[]
}

export type DiffSpliceResponse = DiffSplicePreAnalysisResponse | DiffSpliceFullResponse | DiffSpliceJunctionsResponse

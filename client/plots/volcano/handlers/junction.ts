import type { DiffSpliceRequest } from '#types'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { roundValueAuto } from '#shared/roundValue.js'
import type { TooltipRow, VolcanoHandler } from './types'
import type { DSVolcanoSettings } from '../settings/Settings'
import { countGroupSamples } from './shared'

/** The engines of differential splicing, for the launch menu and the volcano's control.
 * A new array each time, as the launch menu marks its options as disabled. */
export function getSpliceMethodOptions(): { label: string; value: DSVolcanoSettings['method'] }[] {
	return [
		{ label: 'edgeR (diffSplice)', value: 'edgeR' },
		{ label: 'leafcutter', value: 'leafcutter' }
	]
}

/** Default sample thresholds for n samples: max(5, 2% of n) per intron and max(3, 1% of n)
 * per group. n should be the number of samples with splicing data; a larger raw count can
 * push the thresholds above the group sizes and drop every cluster. */
export function scaleDsFilters(n: number): { minSamplesPerIntron: number; minSamplesPerGroup: number } {
	return {
		minSamplesPerIntron: Math.max(5, Math.round(n * 0.02)),
		minSamplesPerGroup: Math.max(3, Math.round(n * 0.01))
	}
}

/** Differential splicing of junction clusters */
export const junctionHandler: VolcanoHandler = {
	termType: tt.JUNCTION,
	route: 'termdb/diffSplice',
	comparesGroups: true,

	getRequestBody(ctx) {
		const { app, config, settings } = ctx
		ctx.setOthersGroup(config.samplelst)
		const state = app.getState()
		const body = {
			kind: 'DS',
			genome: app.vocabApi.vocab.genome,
			dslabel: app.vocabApi.vocab.dslabel,
			samplelst: config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			method: settings.method,
			/* leafcutter's own cluster filters, applied by the edgeR screen too so both engines
			rank the same cluster set. Sent already scaled to cohort size by validateDSSettings --
			as absolute counts they silently loosen as N grows. */
			minSamplesPerIntron: settings.minSamplesPerIntron,
			minSamplesPerGroup: settings.minSamplesPerGroup,
			minCountsPerCluster: settings.minCountsPerCluster,
			volcanoRender: ctx.getVolcanoRender()
		} as Partial<DiffSpliceRequest>

		ctx.addConfounderTw(body)

		return body
	},

	// splicing always plots delta_psi
	getEffectAxis(settings) {
		return { xField: 'delta_psi', cutoff: settings.deltaPsiCutoff }
	},

	getRowNoun: () => 'clusters',
	actions: [],
	// a cluster is not a gene, and may map to several genes or none
	gsea: false,

	getRowKey: d => d.cluster_id,
	getIdColumns: () => [
		{ label: 'Cluster', value: d => d.cluster_id },
		{ label: 'Gene(s)', value: d => d.genes || '' }
	],
	getTableEffectColumn: () => ({ label: 'ΔPSI', value: d => roundValueAuto(d.delta_psi) }),
	getExtraColumns: () => [
		{ label: 'PSI (group 1)', value: d => roundValueAuto(d.psi_control) },
		{ label: 'PSI (group 2)', value: d => roundValueAuto(d.psi_case) },
		{ label: 'Junctions', value: d => d.n_junc }
	],
	getTooltipRows(d, _run, shared) {
		const rows: TooltipRow[] = [['Cluster', d.cluster_id]]
		if (d.genes) rows.push(['Gene(s)', d.genes])
		if (d.chr) rows.push(['Position', `${d.chr}:${d.start}-${d.stop}`])
		rows.push(shared.effect)
		/* Both group means, because a ΔPSI of 0.2 means something different depending on the
		underlying changes (e.g., 0.1→0.3 vs. 0.7→0.9) */
		if (d.psi_control != null) rows.push(['PSI (group 1)', roundValueAuto(d.psi_control)])
		if (d.psi_case != null) rows.push(['PSI (group 2)', roundValueAuto(d.psi_case)])
		if (d.n_junc != null) rows.push(['Junctions', d.n_junc])
		if (d.top_intron) rows.push(['Top intron', d.top_intron])
		return [...rows, ...shared.pValues]
	},

	addDefaultSettings(defaults) {
		defaults.method = 'edgeR'
		defaults.minSamplesPerIntron = 5
		defaults.minSamplesPerGroup = 3
		defaults.minCountsPerCluster = 20
		/* 0.05 = a 5-point PSI shift. */
		defaults.deltaPsiCutoff = 0.05
	},
	/* Read groups from opts; config.samplelst is populated only after copyMerge().
	Apply caps to eligible counts rather than raw groups, and enforce them in 
	preAnalysis and at run time. */
	validateSettings(settings, opts) {
		const groups = opts.samplelst?.groups || []

		/* Leafcutter’s -i/-g thresholds are absolute sample counts, so their effective stringency decreases 
	as cohort size grows. Scale the defaults as a floor plus a fraction of N to keep filtering comparable 
	across cohort sizes. These are defaults only: opts.overrides takes precedence, followed by saved settings 
	via copyMerge(config, opts) */
		/* The Run button in groups.js scales from the eligible pre-analysis counts
	instead and passes the result in settings, which copyMerge lays over these values. */
		const sampleNum = countGroupSamples(groups)
		if (sampleNum > 0) {
			const scaled = scaleDsFilters(sampleNum)
			if (opts.overrides?.minSamplesPerIntron == undefined) settings.minSamplesPerIntron = scaled.minSamplesPerIntron
			if (opts.overrides?.minSamplesPerGroup == undefined) settings.minSamplesPerGroup = scaled.minSamplesPerGroup
		}
	},
	getControlInputs: () => [
		{
			label: 'Method',
			type: 'radio',
			chartType: 'volcano',
			settingsKey: 'method',
			title:
				'edgeR is a fast screen that also tests each junction. leafcutter is the exact test of a cluster: it takes longer, and has no p-value per junction.',
			options: getSpliceMethodOptions()
		},
		{
			label: 'Minimum counts per cluster',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'minCountsPerCluster',
			title: "Threshold on each sample's total read count in the cluster",
			min: 0,
			max: 10000
		},
		{
			/* leafcutter's -i: an intron must be seen in at least this many samples. Defaulted by
			validateDSSettings to a fraction of cohort size rather than a fixed count, because a
			fixed one silently loosens as N grows -- 5 samples is a third of a 15-sample run and
			0.2% of a 2,500-sample one. Editable here so a user can override that default. */
			label: 'Minimum samples per intron',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'minSamplesPerIntron',
			title:
				'An intron must be observed in at least this many samples to be kept. Defaults to 2% of the cohort, floor 5.',
			min: 1,
			max: 10000
		},
		{
			// leafcutter's -g: the same floor, applied within each of the two groups
			label: 'Minimum samples per group',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'minSamplesPerGroup',
			title:
				'A cluster must have sufficient coverage in at least this many samples in EACH group. Defaults to 1% of the cohort, floor 3.',
			min: 1,
			max: 10000
		},
		{
			/* The cutoff that actually matters for this term type. At large cohorts the p-value
			stops discriminating -- at ~1000 per group most "significant" clusters shift under a
			percentage point of PSI -- so the effect size is the filter, not the p. The unit is
			named in the title because 0.05 here is 5 percentage points, not a p-value. */
			label: 'Minimum |ΔPSI|',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'deltaPsiCutoff',
			title: 'Clusters must shift at least this much in PSI to count as significant. 0.05 = 5 percentage points.',
			min: 0,
			max: 1,
			step: 0.01
		}
	],
	/* splicing plots and thresholds on delta-PSI, and supplies its own |dPSI| control */
	leavesOutControls: ['foldChangeCutoff'],

	getRowActions: (d, ctx) => [
		{ label: 'Genome browser', onClick: async () => ctx.interactions.launchSpliceGenomeBrowser(d) }
	],

	getProvenance(s, response) {
		const parts: string[] = []
		/* The engine the server actually ran, not the requested one: pickDsEngine may override
		the request, and the two engines compute different quantities (a Simes-adjusted
		exon-level p vs a Dirichlet-multinomial LRT), so a file that does not name the engine
		cannot be compared with another. */
		parts.push(`method: ${response.method || s.method}`)
		// the cluster filters decide what was TESTED, so two exports are not comparable without them
		parts.push(`min samples per intron: ${s.minSamplesPerIntron}; min samples per group: ${s.minSamplesPerGroup}`)
		parts.push(`min counts per cluster: ${s.minCountsPerCluster}`)
		return parts
	},

	preAnalysis: {
		getMethodOptions: () => getSpliceMethodOptions(),
		/* the splicing filters scale with the samples that will actually be tested, which only the
		pre-analysis counts know: the raw groups include samples absent from the splicing h5 */
		getLaunchSettings: numSamples => scaleDsFilters(numSamples)
	}
}

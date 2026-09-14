import type { DMRSettings } from './Settings.ts'

// direction colours are shared with the server-rendered scan Manhattan
export { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	/* A dataset with no CpG-level matrix runs the region analysis on its element matrix, where one
	row is a cCRE, not a CpG. Those sit ~10kb apart against a CpG's ~100bp, so the CpG-scale window
	and kernel below would frame one element and smooth nothing. Scaled to element spacing instead.
	ponytail: fixed values, not derived from the matrix's actual spacing — worth deriving only if a
	dataset shows up whose element density is far off this one's. The user can pan/zoom either way. */
	const dm = opts?.app?.vocabApi?.termdbConfig?.queries?.dnaMethylation
	/* Per chromosome, not per dataset: a cohort with some shards built runs CpG resolution where one
	exists and elements everywhere else (server resolveMethylationMatrix), so a dataset-wide flag gave
	the fallback chromosomes a CpG-scale window over rows ~10 kb apart. cpgChroms is sent only for a
	shard-backed dataset without a genome-wide file. */
	const chr = opts?.coordinateOverride?.chr
	const elementScale =
		dm?.regionAnalysis == 'element' || (Array.isArray(dm?.cpgChroms) && !!chr && !dm.cpgChroms.includes(chr))
	const defaults = {
		blockWidth: 800,
		pad: elementScale ? 100_000 : 2000,
		lambda: elementScale ? 50_000 : 1000,
		C: 2,
		fdr_cutoff: 0.05,
		colors: {
			group1: '#3b5ee6',
			group2: '#c04e00',
			hyper: HYPER_COLOR,
			hypo: HYPO_COLOR
		},
		maxLoessRegion: 250_000,
		minProbesForCi: 10,
		backend: 'rust' as const,
		maxRegionSize: 5_000_000
	}

	// Deep-merge colors so hyper/hypo defaults are preserved
	// when only group colors are overridden
	if (overrides.colors) {
		Object.assign(defaults.colors, overrides.colors)
		delete overrides.colors
	}

	return Object.assign(defaults, overrides)
}

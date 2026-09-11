import type { DMRSettings } from './Settings.ts'

export function getDefaultDMRSettings(opts: any): DMRSettings {
	const overrides = opts.settings || {}
	/* A dataset with no CpG-level matrix runs the region analysis on its element matrix, where one
	row is a cCRE, not a CpG. Those sit ~10kb apart against a CpG's ~100bp, so the CpG-scale window
	and kernel below would frame one element and smooth nothing. Scaled to element spacing instead.
	ponytail: fixed values, not derived from the matrix's actual spacing — worth deriving only if a
	dataset shows up whose element density is far off this one's. The user can pan/zoom either way. */
	const elementScale = opts?.app?.vocabApi?.termdbConfig?.queries?.dnaMethylation?.regionAnalysis == 'element'
	const defaults = {
		blockWidth: 800,
		pad: elementScale ? 100_000 : 2000,
		lambda: elementScale ? 50_000 : 1000,
		C: 2,
		fdr_cutoff: 0.05,
		colors: {
			group1: '#3b5ee6',
			group2: '#c04e00',
			hyper: '#e66101',
			hypo: '#5e81f4'
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

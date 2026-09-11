import type { DMRSettings } from './Settings.ts'

/* The colours that mean DIRECTION, exported so every view encoding hyper/hypo uses the same two.
The genome domain map and the scan's width histogram used a separate orange/green pair, which put
green on "hypomethylated" in one figure and on a sample GROUP in another once group colours were
carried into the region view. Direction is orange/blue everywhere; group colours come from the
picker and are free to be anything. */
export const HYPER_COLOR = '#e66101'
export const HYPO_COLOR = '#5e81f4'

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

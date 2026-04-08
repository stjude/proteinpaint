export function getMockSCApp(overrides: any = {}) {
	const state = getMockSCState(overrides)
	return {
		getState: () => state,
		vocabApi: {
			getterm: async (termid: string) => ({ name: `Label for ${termid}` }),
			...(overrides.vocabApi || {})
		}
	} as any
}

export function getMockSCState(overrides: any = {}) {
	return {
		vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' },
		termfilter: { filter0: null },
		termdbConfig: {
			queries: {
				singleCell: {
					data: {
						plots: [{ name: 'umap' }, { name: 'tsne' }]
					}
				}
			}
		},
		plots: [
			{
				id: 'plot1',
				settings: {
					sc: {
						item: { experiment: 'EXP1', sample: 'S1' }
					}
				}
			}
		],
		...overrides
	}
}

export function getMockSCConfig(overrides: any = {}) {
	return {
		chartType: 'sc',
		settings: {
			sc: {
				columns: { sample: 'Sample' },
				item: undefined
			},
			hierCluster: {}
		},
		...overrides
	} as any
}

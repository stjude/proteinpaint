export function getMockSCApp(overrides: any = {}) {
	const state = getMockSCState(overrides)
	return {
		app: {
			vocabApi: {
				getterm: async (termid: string) => ({ name: `Label for ${termid}` }),
				...(overrides.vocabApi || {})
			},
			getState: () => state
		},
		id: 'testApp'
	} as any
}

export function getMockSCState(overrides: any = {}) {
	// merged, not replaced, so a test can add e.g. urlTemplates without having to restate queries{}
	const { termdbConfig, ...rest } = overrides
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
			},
			...termdbConfig
		},
		plots: [
			{
				id: 'plot1',
				settings: {
					sc: {
						item: { sID: 'S1', eID: 'EXP1' }
					}
				}
			}
		],
		...rest
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

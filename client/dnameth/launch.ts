import { dofetch3 } from '#common/dofetch'

/** Open a genome browser on a gene and its 5 kb flanks, with the dnameth track (./tk.ts) for that gene */
export async function launchMethylationBrowser(app: any, gene: string, groupTw?: any) {
	const data = await dofetch3('genelookup', { body: { deep: 1, input: gene, genome: app.vocabApi.vocab.genome } })
	if (data.error) throw new Error(data.error)
	const gm = data.gmlst?.find((g: any) => g.isdefault) || data.gmlst?.[0]
	if (!gm) throw new Error(`Unknown gene: ${gene}`)
	app.dispatch({
		type: 'plot_create',
		config: {
			chartType: 'genomeBrowser',
			// genomic mode: the CpGs of interest are mostly outside the exons
			blockIsProteinMode: false,
			geneSearchResult: { chr: gm.chr, start: Math.max(0, gm.start - 5000), stop: gm.stop + 5000 },
			// the dataset's mutation and junction tracks start off, so that the heatmap is next to the gene
			snvindel: { shown: false },
			junction: { shown: false },
			tracks: [{ type: 'dnameth', name: 'Methylation', gene, groupTw }]
		}
	})
}

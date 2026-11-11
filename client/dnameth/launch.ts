import { dofetch3 } from '#common/dofetch'

/** Open a genome browser with the dnameth track (./tk.ts): on a gene and its 5 kb flanks, with the gene's
 * expression in the track, or on a region.
 *
 * groupTw: the groups of the track
 * dmrFile: the track file of a scan of those groups, for the track's DMR row
 * filter: the sample filter of the plot this is opened from, when that plot has its own */
export async function launchMethylationBrowser(
	app: any,
	at: { gene: string } | { chr: string; start: number; stop: number },
	groupTw?: any,
	dmrFile?: string,
	filter?: any
) {
	let gene: string | undefined, region: { chr: string; start: number; stop: number }
	if ('gene' in at) {
		gene = at.gene
		const data = await dofetch3('genelookup', { body: { deep: 1, input: gene, genome: app.vocabApi.vocab.genome } })
		if (data.error) throw new Error(data.error)
		const gm = data.gmlst?.find((g: any) => g.isdefault) || data.gmlst?.[0]
		if (!gm) throw new Error(`Unknown gene: ${gene}`)
		region = { chr: gm.chr, start: Math.max(0, gm.start - 5000), stop: gm.stop + 5000 }
	} else {
		// room on each side, as wide as the region itself
		const pad = Math.max(5000, at.stop - at.start)
		region = { chr: at.chr, start: Math.max(0, at.start - pad), stop: at.stop + pad }
	}
	/* the dataset's mutation and junction tracks start off, so that the heatmap is next to the gene. Each is the
	dataset's own config with shown:false, and only when the dataset has it: the genome browser takes these keys
	whole, so a bare {shown:false} would drop the rest of the config, or add a tab for a track the dataset lacks */
	const queries = app.vocabApi.termdbConfig?.queries || {}
	const off: any = {}
	for (const k of ['snvindel', 'junction']) if (queries[k]) off[k] = { ...structuredClone(queries[k]), shown: false }
	app.dispatch({
		type: 'plot_create',
		config: {
			chartType: 'genomeBrowser',
			// genomic mode: the CpGs of interest are mostly outside the exons
			blockIsProteinMode: false,
			geneSearchResult: region,
			filter,
			...off,
			tracks: [{ type: 'dnameth', name: 'Methylation', gene, groupTw, dmrFile }]
		}
	})
}

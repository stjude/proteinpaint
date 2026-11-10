import { mayRenderSampleTypeRow, getTermSampleTypes } from '#dom'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import { first_genetrack_tolist } from '#common/1stGenetk'

/**
 * Embed a genome browser of a gene/region into `holder` with a "Submit Region" button. On submit,
 * builds a region-based dnaMethylation term from the region the user navigated to and the sample types
 * chosen above the browser, as the dnaMethylation search handler does, and passes it to `callback`.
 * Returns the Block instance.
 */
export async function embedMethylationRegionPicker(opts: {
	holder: any
	genomeObj: any
	vocabApi: any
	chr: string
	start: number
	stop: number
	callback: (term: any) => void | Promise<void>
	debug?: boolean
}) {
	const { holder, genomeObj, vocabApi, chr, start, stop, callback } = opts
	if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('unable to retrieve gene coordinate')

	holder.selectAll('*').remove()
	holder.style('display', 'block')
	const query = vocabApi.termdbConfig?.queries.dnaMethylation
	const sampleTypeSelect = mayRenderSampleTypeRow(holder.append('div'), query, vocabApi.termdbConfig)
	holder.append('div').style('opacity', 0.6).text('Navigate genome browser to desired region')

	const arg: any = {
		holder,
		genome: genomeObj,
		chr,
		start,
		stop,
		tklst: [],
		nobox: true,
		width: 500,
		hidegenelegend: true,
		debugmode: opts.debug
	}
	first_genetrack_tolist(genomeObj, arg.tklst)
	const _ = await import('#src/block')
	const blockInstance = new _.Block(arg)

	holder
		.append('div')
		.attr('data-testid', 'sjpp-dnaMethylation-submitDiv')
		.style('margin', '10px 0px')
		.append('button')
		.style('border', 'none')
		.style('border-radius', '20px')
		.style('padding', '10px 15px')
		.text('Submit Region')
		.on('click', async () => {
			const termSampleTypes = getTermSampleTypes(sampleTypeSelect, query, vocabApi.termdbConfig)
			if (!termSampleTypes) return
			const { chr, start, stop } = blockInstance.rglst[0]
			await callback(makeDNAMethRegionTerm({ chr, start, stop }, vocabApi, termSampleTypes))
		})

	return blockInstance
}

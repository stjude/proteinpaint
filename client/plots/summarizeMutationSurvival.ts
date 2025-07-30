import { table2col } from '#dom'
import { dtsnvindel } from '#shared/common.js'
import { termsettingInit, fillTermWrapper } from '#termsetting'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'
import { getGeneTw, launchPlot } from './summarizeMutationDiagnosis'

/*
duplicates code from summarizeMutationDiagnosis, with minute changes
*/

export async function makeChartBtnMenu(holder, chartsInstance) {
	let dictTw // the variable stores a copy of ds-supplied default tw and will be overwriten by pill update
	{
		// always require a default term and does not allow it to be deleted from pill to simplify ui logic
		const t = chartsInstance.app.vocabApi.termdbConfig.defaultTw4correlationPlot?.survival
		if (!t) throw 'defaultTw4correlationPlot missing'
		dictTw = structuredClone(t)
	}

	// 2-col table to organize input ui
	const table = table2col({
		holder: holder.append('div'),
		margin: '10px',
		cellPadding: '10px'
	})

	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene or Region')
		const searchDiv = td2.append('div'),
			waitDiv = td2.append('div').style('font-size', '.7em').text('Hit ENTER to launch plot.')
		const geneSearchInst = new geneSearch() // FIXME allow searching chr17:7666658-7688275
		geneSearchInst.init({
			holder: searchDiv,
			genomeObj: chartsInstance.app.opts.genome!,
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			callback: async term => {
				waitDiv.text('LOADING ...')
				launchPlot({
					tw1: dictTw,
					tw2: await getGeneTw(term, dtsnvindel, chartsInstance.app.vocabApi), // hardcodes dtsnvindel for this chart
					chartsInstance,
					holder
				})
			}
		})
	}

	{
		const [td1, td2] = table.addRow()
		td1.text('Compare Mutations Against')

		// create both pill and wait divs first, then await pill.main(), so the loading text can display while waiting for pill.main()
		const pillDiv = td2.append('div')

		const pill = await termsettingInit({
			menuOptions: '{edit,replace}',
			usecase: { target: 'survival', detail: 'term' }, // limit to survival terms
			vocabApi: chartsInstance.app.vocabApi,
			holder: pillDiv,
			callback: async tw => {
				await pill.main(tw)
				dictTw = tw
			}
		})

		await fillTermWrapper(dictTw, chartsInstance.app.vocabApi) // required before calling pill.main()
		await pill.main(dictTw)
	}
}

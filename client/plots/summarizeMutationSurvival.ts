import { table2col } from '#dom'
import { termsettingInit, fillTermWrapper } from '#termsetting'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'
import { launchPlot } from './summarizeMutationDiagnosis'

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
		await fillTermWrapper(dictTw, chartsInstance.app.vocabApi)
	}

	// 2-col table to organize input ui
	const table = table2col({
		holder: holder.append('div'),
		margin: '0px 10px 10px 10px',
		cellPadding: '10px'
	})

	{
		const [td1, td2] = table.addRow()
		td1.text('Mutation Variable')
		const searchDiv = td2.append('div')
		const geneSearchInst = new geneSearch() // FIXME allow searching chr17:7666658-7688275
		geneSearchInst.init({
			holder: searchDiv,
			genomeObj: chartsInstance.app.opts.genome!,
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			msg: 'Hit ENTER to launch plot.',
			callback: async geneTw => {
				await fillTermWrapper(geneTw, chartsInstance.app.vocabApi)
				launchPlot({
					tw1: dictTw,
					tw2: geneTw,
					chartsInstance,
					holder
				})
			}
		})
		searchDiv.style('padding', '0px 0px 5px 0px')
	}

	{
		const [td1, td2] = table.addRow()
		td1.text('Compare Mutations Against')

		// create both pill and wait divs first, then await pill.main(), so the loading text can display while waiting for pill.main()
		const pillDiv = td2.append('div')

		const pill = await termsettingInit({
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

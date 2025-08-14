import { addGeneSearchbox, Menu, table2col } from '#dom'
import { termsettingInit, fillTermWrapper } from '#termsetting'
import { launchPlot } from './summarizeMutationDiagnosis'

/*
duplicates code from summarizeMutationDiagnosis, with minute changes
*/
const tip = new Menu({ padding: '0px' })

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
		margin: '10px',
		cellPadding: '10px'
	})

	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene For Expression')
		const searchDiv = td2.append('div')
		const result = addGeneSearchbox({
			row: searchDiv,
			tip,
			searchOnly: 'gene',
			genome: chartsInstance.app.opts.genome!,
			callback: async () => {
				launchPlot({
					tw1: dictTw,
					tw2: { term: { gene: result.geneSymbol, type: 'geneExpression' } },
					chartsInstance,
					holder
				})
			}
		})
	}

	{
		const [td1, td2] = table.addRow()
		td1.text('Compare Expression Against')

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

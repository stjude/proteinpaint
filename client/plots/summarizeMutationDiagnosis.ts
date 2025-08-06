import { table2col } from '#dom'
import { termsettingInit, fillTermWrapper } from '#termsetting'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'

/*
this creates the chart button menu to do these:
1. user searches a gene/region to form snvindel mut-wildtype tw
2. use default supplied dictionary term or change to a new dict term
3. hit gene search and launch a summary plot: term1=geneTw, term2=dictTw

this plot is "transient" and does not export componentInit()
because it will not be directly launched from state.
it will also not be kept in state, as it only launches summary plot at the end
*/

export async function makeChartBtnMenu(holder, chartsInstance) {
	let dictTw // the variable stores a copy of ds-supplied default tw and will be overwriten by pill update
	{
		// always require a default term and does not allow it to be deleted from pill to simplify ui logic
		const t = chartsInstance.app.vocabApi.termdbConfig.defaultTw4correlationPlot?.disease
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
		const searchDiv = td2.append('div')
		const geneSearchInst = new geneSearch() // FIXME allow searching chr17:7666658-7688275
		geneSearchInst.init({
			holder: searchDiv,
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			genomeObj: chartsInstance.app.opts.genome!,
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
		const pillDiv = td2.append('div'),
			waitDiv = td2.append('div').style('font-size', '.7em').text('LOADING ...')

		const pill = await termsettingInit({
			menuOptions: '{edit,replace}',
			/** presumably this usecase let it restrict to dictionary term ui, and hide genomic queries
			target="filter" works for gdc since in gdc ds it is overriding filter to dict
			but is not a general fix for non-gdc ds, which Replace menu will launch genomic+dict options
			maybe this is okay for non-gdc ds as the default dictTw is meaningful
			*/
			usecase: { target: 'filter' },
			vocabApi: chartsInstance.app.vocabApi,
			holder: pillDiv,
			callback: async tw => {
				waitDiv.text('LOADING ...')
				try {
					await pill.main(tw)
					dictTw = tw
					waitDiv.text('Click to edit/replace the variable before searching gene.')
				} catch (e: any) {
					waitDiv.text('Error: ' + (e.message || e))
				}
			}
		})

		try {
			await fillTermWrapper(dictTw, chartsInstance.app.vocabApi) // required before calling pill.main()
			await pill.main(dictTw)
			waitDiv.text('Click to edit/replace the variable before searching gene.')
		} catch (e: any) {
			waitDiv.text('Error: ' + (e.message || e))
		}
	}
}

/*
reused helper to:
1. dispatch to launch plot
2. while waiting, display wait message in menu and delay-close menu

assumes that tw1 is dict term, will use its type to set chart type
*/
export function launchPlot({ tw1, tw2, chartsInstance, holder }) {
	const chart = {
		config: {
			chartType: tw1?.term?.type == 'survival' ? 'survival' : 'summary',
			// TODO define sandbox header with gene+term name
			term: tw1,
			term2: tw2
		}
	}
	chartsInstance.plotCreate(chart)
	holder.selectAll('*').remove() // okay to delete; this ui is "single-use" and will be rerendered on clicking chart button again
	holder.append('div').style('margin', '20px').text('LOADING CHART ...') // indicate mass chart is loading
	setTimeout(() => {
		holder.style('display', 'none')
	}, 1000)
}

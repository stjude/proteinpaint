import { getCompInit } from '../rx/index.js'
import { table2col } from '#dom'
import { dtsnvindel } from '#shared/common.js'
import { termsettingInit, fillTermWrapper } from '#termsetting'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'

/*
quick access to:
1. user searches a gene/region to form snvindel mut-wildtype tw
2. use default supplied dictionary term or change to a new dict term
3. hit gene search and launch a summary plot: term1=geneTw, term2=dictTw

state: {
	dictTw
	geneTw
}
*/

class summarizeMutationDiagnosis {
	id: any
	type: string
	opts: { [key: string]: any }
	state: any
	app: any

	constructor(opts) {
		this.opts = opts
		this.type = 'summarizeMutationDiagnosis'
	}

	async init() {
		// todo: call plot.app.js to launch summary plot with geneTw and dictTw
	}

	async main() {}
}

export async function getPlotConfig(opts) {
	return opts
}

export const summarizeMutationDiagnosisInit = getCompInit(summarizeMutationDiagnosis)
// this alias will allow abstracted dynamic imports
export const componentInit = summarizeMutationDiagnosisInit

export async function makeChartBtnMenu(holder, chartsInstance) {
	// TODO do not hardcode; duplicate dictTw from a required tdbcfg setting, and let it modified by pill update
	let dictTw = { term: { id: 'case.disease_type', name: 'Disease type', type: 'categorical' }, q: {} }
	if (!dictTw) throw 'dictTw missing'

	const table = table2col({
		holder: holder.append('div'),
		margin: '10px',
		cellPadding: '10px'
	})

	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene or Region')
		const geneSearchInst = new geneSearch()
		geneSearchInst.init({
			holder: td2.append('div'),
			genomeObj: chartsInstance.app.opts.genome!,
			callback: async term => {
				const geneTw = await getGeneTw(term, dtsnvindel, chartsInstance.app.vocabApi)
				const chart = {
					config: {
						chartType: 'summary',
						term: dictTw,
						term2: geneTw
					}
				}
				chartsInstance.plotCreate(chart)
			}
		})
		td2.append('div').style('font-size', '.7em').text('Hit ENTER to launch plot.')
	}

	{
		const [td1, td2] = table.addRow()
		td1.text('Compare Mutations Against')
		const pill = await termsettingInit({
			menuOptions: '{edit,replace}',
			/** this usecase should hardcode to only dictionary term, but disable genomic queries
			use filter works for gdc since in gdc ds it is overriding filter to dict
			but is not a general fix for non-gdc ds, which Replace menu will launch genomic+dict options
			maybe this is okay for non-gdc ds as the default dictTw is meaningful
			*/
			usecase: { target: 'filter' },
			vocabApi: chartsInstance.app.vocabApi,
			holder: td2.append('div'),
			callback: async tw => {
				await pill.main(tw)
				dictTw = tw
			}
		})

		await fillTermWrapper(dictTw, chartsInstance.app.vocabApi)

		// show wait while waiting for gdc /categories/ query to finish, could be long for big cohort
		const wait = td2.append('div').text('Loading...')
		await pill.main(dictTw)
		wait.remove()

		td2
			.append('div')
			.style('font-size', '.7em')
			.text(`Click to replace with a different dictionary variable before searching gene.`)
	}
}

/*
formulate gene variant tw from gene search
function is reused for other similar plots
*/
export async function getGeneTw(term, dt, vocabApi) {
	const tw: any = { term, q: { type: 'predefined-groupset' } }
	await fillTermWrapper(tw, vocabApi)
	if (!tw.term.groupsetting?.lst?.length) throw 'term.groupsetting.lst[] is empty'
	if (!Number.isFinite(dt)) throw 'invalid dt'
	// get index of groupset corresponding to dt
	const i = tw.term.groupsetting.lst.findIndex(groupset => groupset.dt == dt)
	if (i == -1) throw 'dt not found in groupsets'
	tw.q.predefined_groupset_idx = i
	return tw
}

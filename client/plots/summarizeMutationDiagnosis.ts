import { getCompInit } from '../rx/index.js'
import { addGeneSearchbox, Menu, table2col } from '#dom'
import { termsettingInit, fillTermWrapper } from '#termsetting'

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

const tip = new Menu({ padding: '0px' })

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
		const result = addGeneSearchbox({
			tip,
			row: td2.append('div'),
			genome: chartsInstance.app.opts.genome!,
			callback: () => {
				const chart = {
					config: {
						chartType: 'summarizeMutationDiagnosis',
						geneTw: getGeneTw(result, 'snvindel'),
						dictTw
					}
				}
				chartsInstance.prepPlot(chart)
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
choice is dtterm value
function is reused for other similar plots
*/
export function getGeneTw(result, choice) {
	if (choice == 'snvindel') {
		// make genetw for mutated vs wildtype
	} else if (choice == 'cnv') {
		// make genetw for gain vs loss vs wildtype
	} else {
		throw 'unknown choice'
	}
}

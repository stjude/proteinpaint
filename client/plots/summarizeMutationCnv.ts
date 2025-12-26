import { table2col } from '#dom'
import { fillTermWrapper } from '#termsetting'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'
import { dtsnvindel, dtcnv } from '#shared/common.js'
import { launchPlot } from './summarizeMutationDiagnosis'

/*
same design as summarizeMutationDiagnosis.ts
*/

export async function makeChartBtnMenu(holder, chartsInstance) {
	let mutTw, cnvTw

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
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			genomeObj: chartsInstance.app.opts.genome!,
			dt: dtsnvindel,
			callback: async geneTw => {
				await fillTermWrapper(geneTw, chartsInstance.app.vocabApi)
				mutTw = geneTw
				mayEnableSubmit()
			}
		})
		searchDiv.style('padding', '0px 0px 5px 0px')
	}

	{
		const [td1, td2] = table.addRow()
		td1.text('CNV Variable')
		const searchDiv = td2.append('div')
		const geneSearchInst = new geneSearch() // FIXME allow searching chr17:7666658-7688275
		geneSearchInst.init({
			holder: searchDiv,
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			genomeObj: chartsInstance.app.opts.genome!,
			dt: dtcnv,
			callback: async geneTw => {
				await fillTermWrapper(geneTw, chartsInstance.app.vocabApi)
				cnvTw = geneTw
				mayEnableSubmit()
			}
		})
		searchDiv.style('padding', '0px 0px 5px 0px')
	}

	const submitBtn = holder
		.append('button')
		.text('Launch Plot')
		.style('margin', '0px 15px 15px 15px')
		.property('disabled', true) // enable when both mut and cnv tws are set
		.on('click', () => {
			launchPlot({
				tw1: mutTw,
				tw2: cnvTw,
				chartsInstance,
				holder
			})
		})

	function mayEnableSubmit() {
		submitBtn.property('disabled', !mutTw || !cnvTw)
	}
}

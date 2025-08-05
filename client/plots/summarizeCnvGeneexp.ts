import { table2col, addGeneSearchbox, make_one_checkbox, Menu } from '#dom'
import { dtcnv } from '#shared/common.js'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'
import { select } from 'd3-selection'
import { launchPlot } from './summarizeMutationDiagnosis'
import { fillTermWrapper } from '#termsetting'

/*
same design as summarizeMutationDiagnosis.ts
*/

const tip = new Menu({ padding: '0px' })

export async function makeChartBtnMenu(holder, chartsInstance) {
	//////////////////// modifiable variables ////////////////////

	let expTw, // stores geneexp tw. overwritten by gene search
		cnvTw, // stores cnv tw
		/* important flag, true/false is set by toggling checkbox
		- true
			cnvTw uses same gene as expTw
			no submit btn needed. on exp gene search will create plot
		- false
			show geneVariant search box
			show submit btn. btn only enabled when both exp and cnv tws are set
		*/
		cnvGeneSameAsExp = true,
		expSearchPrompt, // <div> under exp gene search to show prompt
		cnvTableRow // <tr> of cnv selector. hidden when cnvGeneSameAsExp is true

	////////////////////        make ui        ////////////////////

	make_one_checkbox({
		holder: holder.append('div').style('margin', '20px 10px 5px 15px'),
		labeltext: 'Use Same Gene For CNV',
		checked: true,
		callback: async checked => {
			cnvGeneSameAsExp = checked
			await updateUi()
		}
	})

	const table = table2col({
		holder: holder.append('div'),
		margin: '10px',
		cellPadding: '10px'
	})

	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene For Expression')
		const searchDiv = td2.append('div') // must create both before calling add box
		expSearchPrompt = td2.append('div').style('font-size', '.7em')
		const result = addGeneSearchbox({
			row: searchDiv,
			tip,
			searchOnly: 'gene',
			genome: chartsInstance.app.opts.genome!,
			callback: async () => {
				expSearchPrompt.text('LOADING ...')
				try {
					expTw = { term: { gene: result.geneSymbol, type: 'geneExpression' }, q: {} }
					await updateUi()
					if (cnvGeneSameAsExp) launch()
					expSearchPrompt.text('')
				} catch (e: any) {
					expSearchPrompt.text('Error: ' + (e.message || e))
				}
			}
		})
	}

	{
		const [td1, td2] = table.addRow()
		cnvTableRow = select(td1.node().parentNode)
		td1.text('Search Gene/Region For CNV')
		const searchDiv = td2.append('div'),
			waitDiv = td2.append('div').style('font-size', '.7em')
		const geneSearchInst = new geneSearch() // FIXME allow searching chr17:7666658-7688275
		// TODO set focusOff on it so focus is auto set on exp gene search
		geneSearchInst.init({
			holder: searchDiv,
			genomeObj: chartsInstance.app.opts.genome!,
			app: chartsInstance.app, // required to supply "opts.app.vocabApi" for the search ui
			callback: async tw => {
				waitDiv.text('LOADING ...')
				try {
					await fillTermWrapper(tw, chartsInstance.app.vocabApi)
					cnvTw = tw
					waitDiv.text('')
					await updateUi()
				} catch (e: any) {
					waitDiv.text('Error: ' + (e.message || e))
				}
			}
		})
	}

	const submitBtn = holder
		.append('button')
		.text('Launch Plot')
		.style('margin', '0px 15px 15px 15px')
		.property('disable', true) // enable when both exp and cnv tws are set
		.on('click', launch)

	////////////////////        helpers        ////////////////////

	async function updateUi() {
		if (cnvGeneSameAsExp) {
			if (expTw) {
				cnvTw = {
					term: { gene: expTw.term.gene, type: 'geneVariant', kind: 'gene' },
					q: { type: 'predefined-groupset' }
				}
				await fillTermWrapper(cnvTw, chartsInstance.app.vocabApi)
				// get index of groupset corresponding to dtcnv
				const i = cnvTw.term.groupsetting.lst.findIndex(groupset => groupset.dt == dtcnv)
				if (i == -1) throw 'dtcnv not found in groupsets'
				cnvTw.q.predefined_groupset_idx = i
			}
		}
		cnvTableRow.style('display', cnvGeneSameAsExp ? 'none' : '')
		expSearchPrompt.text(cnvGeneSameAsExp ? 'Hit ENTER to launch plot.' : '')
		submitBtn.style('display', cnvGeneSameAsExp ? 'none' : '').property('disabled', !expTw || !cnvTw)
	}

	updateUi()

	function launch() {
		if (!expTw || !cnvTw) throw 'either tw is missing'
		launchPlot({
			tw1: expTw,
			tw2: cnvTw,
			chartsInstance,
			holder
		})
	}
}

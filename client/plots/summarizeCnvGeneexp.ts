import { table2col, addGeneSearchbox, make_one_checkbox, Menu } from '#dom'
import { dtcnv } from '#shared/common.js'
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

	// gene expression variable
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
					console.log(e.stack)
				}
			}
		})
	}

	// cnv variable
	{
		const [td1, td2] = table.addRow()
		cnvTableRow = select(td1.node().parentNode)
		td1.text('Search Gene for CNV')
		const searchDiv = td2.append('div') // must create both before calling add box
		const cnvSearchPrompt = td2.append('div').style('font-size', '.7em')
		const result = addGeneSearchbox({
			row: searchDiv,
			tip,
			searchOnly: 'gene',
			genome: chartsInstance.app.opts.genome!,
			callback: async () => {
				cnvSearchPrompt.text('LOADING ...')
				try {
					cnvTw = await fillGvTw(result.geneSymbol, dtcnv)
					await updateUi()
					cnvSearchPrompt.text('')
				} catch (e: any) {
					cnvSearchPrompt.text('Error: ' + (e.message || e))
					if (e.stack) console.log(e.stack)
				}
			}
		})
	}

	const submitBtn = holder
		.append('button')
		.text('Launch Plot')
		.style('margin', '0px 15px 15px 15px')
		.property('disabled', true) // enable when both exp and cnv tws are set
		.on('click', launch)

	////////////////////        helpers        ////////////////////

	async function updateUi() {
		if (cnvGeneSameAsExp) {
			if (expTw) {
				cnvTw = await fillGvTw(expTw.term.gene, dtcnv)
			}
		}
		cnvTableRow.style('display', cnvGeneSameAsExp ? 'none' : '')
		expSearchPrompt.text(cnvGeneSameAsExp ? 'Hit ENTER to launch plot.' : '')
		submitBtn.style('display', cnvGeneSameAsExp ? 'none' : '').property('disabled', !expTw || !cnvTw)
	}

	updateUi()

	async function fillGvTw(geneSymbol, dt) {
		const name = geneSymbol
		const tw: any = {
			term: {
				id: name,
				name,
				genes: [
					{
						kind: 'gene',
						id: name,
						gene: name,
						name,
						type: 'geneVariant'
					}
				],
				type: 'geneVariant'
			},
			q: { type: 'predefined-groupset', dtLst: [dt] }
		}
		await fillTermWrapper(tw, chartsInstance.app.vocabApi)
		return tw
	}

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

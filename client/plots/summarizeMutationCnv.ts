import { table2col, addGeneSearchbox, make_one_checkbox, Menu } from '#dom'
import { dtsnvindel, dtcnv } from '#shared/common.js'
import { select } from 'd3-selection'
import { launchPlot } from './summarizeMutationDiagnosis'
import { fillTermWrapper } from '#termsetting'

/*
similar design as summarizeCnvGeneexp.ts
*/

const tip = new Menu({ padding: '0px' })

export async function makeChartBtnMenu(holder, chartsInstance) {
	//////////////////// modifiable variables ////////////////////

	let mutTw, // stores mutation tw. overwritten by gene search
		cnvTw, // stores cnv tw
		/* important flag, true/false is set by toggling checkbox
		- true
			cnvTw uses same gene as mutTw
			no submit btn needed. on mutation gene search will create plot
		- false
			show both mutation gene search and cnv gene search
			show submit btn. btn only enabled when both exp and cnv tws are set
		*/
		cnvGeneSameAsMut = true,
		mutSearchPrompt, // <div> under mutation gene search to show prompt
		cnvTableRow // <tr> of cnv selector. hidden when cnvGeneSameAsMut is true

	////////////////////        make ui        ////////////////////

	make_one_checkbox({
		holder: holder.append('div').style('margin', '20px 10px 5px 15px'),
		labeltext: 'Use Same Gene For CNV',
		checked: true,
		callback: async checked => {
			cnvGeneSameAsMut = checked
			await updateUi()
		}
	})

	const table = table2col({
		holder: holder.append('div'),
		margin: '10px',
		cellPadding: '10px'
	})

	// mutation variable
	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene for Mutation')
		const searchDiv = td2.append('div') // must create both before calling add box
		mutSearchPrompt = td2.append('div').style('font-size', '.7em')
		const result = addGeneSearchbox({
			row: searchDiv,
			tip,
			searchOnly: 'gene',
			genome: chartsInstance.app.opts.genome!,
			callback: async () => {
				mutSearchPrompt.text('LOADING ...')
				try {
					mutTw = await fillGvTw(result.geneSymbol, dtsnvindel)
					await updateUi()
					if (cnvGeneSameAsMut) launch()
					mutSearchPrompt.text('')
				} catch (e: any) {
					mutSearchPrompt.text('Error: ' + (e.message || e))
					if (e.stack) console.log(e.stack)
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
		if (cnvGeneSameAsMut) {
			if (mutTw) {
				cnvTw = await fillGvTw(mutTw.term.id, dtcnv)
			}
		}
		cnvTableRow.style('display', cnvGeneSameAsMut ? 'none' : '')
		mutSearchPrompt.text(cnvGeneSameAsMut ? 'Hit ENTER to launch plot.' : '')
		submitBtn.style('display', cnvGeneSameAsMut ? 'none' : '').property('disabled', !mutTw || !cnvTw)
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
		if (!mutTw || !cnvTw) throw 'either tw is missing'
		launchPlot({
			tw1: mutTw,
			tw2: cnvTw,
			chartsInstance,
			holder
		})
	}
}

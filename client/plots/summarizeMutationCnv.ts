import { table2col, addGeneSearchbox, make_one_checkbox, Menu } from '#dom'
import { dtsnvindel, dtcnv } from '#shared/common.js'
import { SearchHandler as geneSearch } from '../termdb/handlers/geneVariant.ts'
import { select } from 'd3-selection'
import { launchPlot } from './summarizeMutationDiagnosis'
import { fillTermWrapper, get$id } from '#termsetting'

/*
same design as summarizeMutationDiagnosis.ts
*/

const tip = new Menu({ padding: '0px' })

export async function makeChartBtnMenu(holder, chartsInstance) {
	//////////////////// modifiable variables ////////////////////

	let mutTw, // stores geneexp tw. overwritten by gene search
		cnvTw, // stores cnv tw
		/* important flag, true/false is set by toggling checkbox
		- true
			cnvTw uses same gene as expTw
			no submit btn needed. on exp gene search will create plot
		- false
			show geneVariant search box
			show submit btn. btn only enabled when both exp and cnv tws are set
		*/
		cnvGeneSameAsMut = true,
		geneSearchPrompt, // <div> under exp gene search to show prompt
		cnvTableRow // <tr> of cnv selector. hidden when cnvGeneSameAsExp is true

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

	{
		const [td1, td2] = table.addRow()
		td1.text('Search Gene')
		const searchDiv = td2.append('div') // must create both before calling add box
		geneSearchPrompt = td2.append('div').style('font-size', '.7em')
		const result = addGeneSearchbox({
			row: searchDiv,
			tip,
			searchOnly: 'gene',
			genome: chartsInstance.app.opts.genome!,
			callback: async () => {
				geneSearchPrompt.text('LOADING ...')
				try {
					//expTw = { term: { gene: result.geneSymbol, type: 'geneExpression' }, q: {} }
					const name = result.geneSymbol
					mutTw = {
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
						q: { type: 'predefined-groupset' }
					}
					await fillTermWrapper(mutTw, chartsInstance.app.vocabApi)
					// get index of groupset corresponding to dtsnvindel
					const i = mutTw.term.groupsetting.lst.findIndex(groupset => groupset.dt == dtsnvindel)
					if (i == -1) throw 'dtsnvindel not found in groupsets'
					mutTw.q.predefined_groupset_idx = i
					// update $id after setting q.predefined_groupset_idx (to distinguish from cnvTw)
					mutTw.$id = await get$id(chartsInstance.app.vocabApi.getTwMinCopy(mutTw))

					await updateUi()
					if (cnvGeneSameAsMut) launch()
					geneSearchPrompt.text('')
				} catch (e: any) {
					geneSearchPrompt.text('Error: ' + (e.message || e))
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
			//dt: dtcnv,
			callback: async tw => {
				try {
					await fillTermWrapper(tw, chartsInstance.app.vocabApi)
					cnvTw = tw
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
		.property('disabled', true) // enable when both exp and cnv tws are set
		.on('click', launch)

	////////////////////        helpers        ////////////////////

	async function updateUi() {
		if (cnvGeneSameAsMut) {
			if (mutTw) {
				cnvTw = structuredClone(mutTw)
				// get index of groupset corresponding to dtcnv
				const i = cnvTw.term.groupsetting.lst.findIndex(groupset => groupset.dt == dtcnv)
				if (i == -1) throw 'dtcnv not found in groupsets'
				cnvTw.q.predefined_groupset_idx = i
				// update $id after setting q.predefined_groupset_idx (to distinguish from mutTw)
				cnvTw.$id = await get$id(chartsInstance.app.vocabApi.getTwMinCopy(cnvTw))
			}
		}
		cnvTableRow.style('display', cnvGeneSameAsMut ? 'none' : '')
		geneSearchPrompt.text(cnvGeneSameAsMut ? 'Hit ENTER to launch plot.' : '')
		submitBtn.style('display', cnvGeneSameAsMut ? 'none' : '').property('disabled', !mutTw || !cnvTw)
	}

	updateUi()

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

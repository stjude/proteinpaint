import { table2col, addGeneSearchbox, make_one_checkbox, Menu } from '#dom'
import { dtsnvindel, dtcnv } from '#shared/common.js'
import { select } from 'd3-selection'
import { launchPlot } from './summarizeMutationDiagnosis'
import { fillTermWrapper, get$id } from '#termsetting'

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
			q: { type: 'predefined-groupset' }
		}
		await fillTermWrapper(tw, chartsInstance.app.vocabApi)
		// get index of groupset corresponding to dt
		const i = tw.term.groupsetting.lst.findIndex(groupset => groupset.dt == dt)
		if (i == -1) throw 'dt not found in groupsets'
		tw.q.predefined_groupset_idx = i
		// update $id after setting predefined_groupset_idx (to distinguish from other gene tw)
		tw.$id = await get$id(chartsInstance.app.vocabApi.getTwMinCopy(tw))
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

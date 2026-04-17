import { fillTermWrapper } from '#termsetting'
import { Menu } from '#dom'
import type { MatrixControls } from './matrix.controls'

const tip = new Menu({ padding: '' })

export function setVariablesBtn(self: MatrixControls, s: any) {
	self.opts.holder
		.append('button')
		.datum({
			label: s.controlLabels.Terms || `Variables`,
			//getCount: () => self.parent.termOrder.filter(t => t.tw.term.type != 'geneVariant').length.length,
			rows: [
				{
					label: `Row Group Label Max Length`,
					title: `Truncate the row group label if it exceeds this maximum number of characters`,
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'termGrpLabelMaxChars'
				},
				{
					label: `Row Label Max Length`,
					title: `Truncate the row label if it exceeds this maximum number of characters`,
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowlabelmaxchars'
				}
			],
			customInputs: appendDictInputs
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}

export function appendDictInputs(self: MatrixControls, app: any, parent: any) {
	tip.clear()
	if (!parent.selectedGroup) parent.selectedGroup = parent.chartType == 'hierCluster' ? 1 : 0
	app.tip.d.append('hr')
	addDictMenu(self, app, parent, app.tip.d.append('div'))
}

export async function addDictMenu(self: MatrixControls, app: any, parent: any, holder: any = undefined) {
	//app.tip.clear()

	const termdb = await import('#termdb/app')
	termdb.appInit({
		holder: holder || app.tip.d,
		vocabApi: self.parent.app.vocabApi,
		focus: 'off',
		state: {
			vocab: self.parent.state.vocab,
			activeCohort: self.parent.activeCohort,
			nav: {
				header_mode: 'search_only'
			},
			tree: {
				usecase: { target: 'matrix', detail: 'termgroups' }
			}
		},
		tree: {
			submit_lst: (termlst: any) => {
				submitLst(self, termlst)
				app.tip.hide()
			}
		},
		search: {
			focus: 'off'
		}
	})
}

export async function submitLst(self: MatrixControls, termlst: any) {
	const newterms = await Promise.all(
		termlst.map(async (_term: any) => {
			const term = structuredClone(_term)
			const tw = 'id' in term ? { id: term.id, term } : { term }
			await fillTermWrapper(tw, self.opts.app.vocabApi)
			return tw
		})
	)

	const termgroups = structuredClone(self.parent.config.termgroups)

	const i = termgroups.findIndex((g: any) => g.name == 'Variables')
	if (i !== -1) {
		const grp = termgroups[i]
		grp.lst.push(...newterms)
		self.parent.app.dispatch({
			type: 'plot_nestedEdits',
			id: self.parent.id,
			edits: [
				{
					nestedKeys: ['termgroups', i, 'lst'],
					value: grp.lst
				}
			]
		})
	} else {
		const grp = { name: 'Variables', lst: newterms }
		termgroups.push(grp)
		self.parent.app.dispatch({
			type: 'plot_edit',
			id: self.parent.id,
			config: { termgroups }
		})
	}
}

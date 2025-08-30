import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom'
import type { SampleLstTermSettingInstance, PillData, SampleLstTW } from '#types'

export function getHandler(self: SampleLstTermSettingInstance) {
	return {
		showEditMenu(div: any) {
			div.selectAll('*').remove()
			if (self.vocabApi.termdbConfig?.displaySampleIds && self.vocabApi.hasVerifiedToken()) {
				const groups = self.q.groups
				for (const group of groups) {
					const groupDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')
					const noButtonCallback = (i: number, node: any) => {
						group.values[i].checked = node.checked
					}
					const name = group.in ? group.name : `${group.name} will exclude these samples`
					addTable(groupDiv, name, group, noButtonCallback)
				}
				div
					.append('div')
					.append('div')
					.style('display', 'inline-block')
					.style('float', 'right')
					.style('padding', '6px 20px')
					.append('button')
					.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
					.text('Apply')
					.on('click', () => {
						for (const group of groups)
							group.values = group.values.filter(value => !('checked' in value) || value.checked)
						self.runCallback!()
					})
			} else {
				const e = self.vocabApi.tokenVerificationPayload
				const missingAccess =
					e?.error == 'Missing access' && self.vocabApi.termdbConfig.dataDownloadCatch?.missingAccess
				const message =
					e && missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e.linkKey || ''])
				const helpLink = self.vocabApi.termdbConfig?.dataDownloadCatch?.helpLink
				div
					.append('div')
					.style('color', '#e44')
					.style('padding', '10px')
					.html(
						message ||
							(self.vocabApi.tokenVerificationMessage || 'Requires sign-in') +
								(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
					)
			}
		},
		getPillStatus() {
			//ignore
		},
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		}
	}
}

function addTable(div: any, name: any, group: any, noButtonCallback: any) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${name}</b>.`)
	const rows: any = []
	for (const value of group.values) rows.push([{ value: value.sample }])
	const columns: any = [{ label: 'Sample' }]

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: false,
		selectAll: true,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})
}

export function fillTW(tw: SampleLstTW) {
	/* type = custom-samplelst is not used anywhere else.
	Code still under development. Delete if never used. */
	if (!tw.q.groups) tw.q.groups = []
	if (tw.q.groups.length == 0) {
		for (const k in tw.term.values) {
			const v = tw.term.values[k]
			tw.q.groups.push({
				name: k,
				inuse: v.inuse,
				values: v.list
			})
		}
	}
}

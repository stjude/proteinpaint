import { getPillNameDefault, get$id } from '#termsetting'
import { renderTable } from '../../dom/table'
import { SampleLstTermSettingInstance, PillData, SampleLstTW } from '#shared/types/index'
import { rgb } from 'd3'

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
	// quick fix!!
	if (!tw.q.type) tw.q.type = 'custom-samplelst'
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

export function getSamplelstTW(groups: any, name = 'groups', notIn = true) {
	let disabled = true
	const values = {}
	const qgroups: any = []
	let samples: any
	for (const group of groups) {
		values[group.name] = { key: group.name, label: group.name, color: group.color }
		samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
	}
	if (groups.length == 1 && notIn) {
		const name2 = 'Not in ' + groups[0].name
		values[name2] = { key: name2, label: name2, color: '#aaa' }
		qgroups.push({
			name: name2,
			in: false,
			values: samples
		})
	}
	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values },
		q: {
			groups: qgroups,
			groupsetting: { disabled }
		}
	}
	return tw

	function getGroupSamples(group: any) {
		const values: any = []
		for (const item of group.items) {
			const value: { sampleId: string; sample?: string } = { sampleId: item.sampleId }
			if ('sample' in item) {
				disabled = false
				value.sample = item.sample
			}
			values.push(value)
		}
		return values
	}
}

export function getSamplelstTWFromIds(ids: number[]) {
	const qgroups: any = []
	let samples: any
	const name = 'group'
	const values = ids.map(id => {
		return { sampleId: id }
	})
	const qgroup = {
		name: name,
		in: true,
		values
	}

	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values: { [name]: { key: name, list: values } } },
		q: {
			groups: [qgroup]
		}
	}
	return tw
}

export function getSampleFilter(sampleId: number) {
	const group = { name: '', index: 0, items: [{ sampleId }] }
	const samplelst = getSamplelstTW([group], '', false)
	const filter = getFilter(samplelst)
	return filter
}

export function getFilter(samplelstTW: any) {
	let i = 0
	let noEdit = true
	for (const field in samplelstTW.term.values) {
		const values = samplelstTW.q.groups[i].values
		samplelstTW.term.values[field].list = values
		if (values[0] && 'sample' in values[0]) noEdit = false
		i++
	}
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: samplelstTW.term },
				noEdit
			}
		]
	}
	return filter
}

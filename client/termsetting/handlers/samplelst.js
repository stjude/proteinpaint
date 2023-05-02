import { getPillNameDefault, get$id } from '#termsetting'
import { renderTable } from '#dom/table'
import { Menu } from '#dom/menu'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			div.selectAll('*').remove()
			const groups = self.q.groups
			for (const group of groups) {
				const groupDiv = div
					.append('div')
					.style('display', 'inline-block')
					.style('vertical-align', 'top')
				const noButtonCallback = (i, node) => {
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
					self.runCallback()
				})
		},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

function addTable(div, name, group, noButtonCallback) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${name}</b>.`)
	const rows = []
	for (const value of group.values) rows.push([{ value: value.sample }])
	const columns = [{ label: 'Sample' }]

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: false,
		selectAll: true
	})
}

export function fillTW(tw, vocabApi) {
	// quick fix!!
	if (!tw.q.type) tw.q.type = 'custom-groupsetting'
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

export function getSamplelstTW(groups, name = 'groups') {
	let disabled = true
	const values = {}
	const qgroups = []
	let samples
	for (const group of groups) {
		values[group.name] = { key: group.name, label: group.name }
		samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
	}
	if (groups.length == 1) {
		const name2 = 'Not in ' + groups[0].name
		values[name2] = { key: name2, label: name2 }
		qgroups.push({
			name: name2,
			in: false,
			values: samples
		})
	}
	const $id = get$id()
	const tw = {
		$id,
		isAtomic: true,
		term: { $id, name, type: 'samplelst', values },
		q: {
			mode: 'custom-groupsetting',
			groups: qgroups,
			groupsetting: { disabled }
		}
	}
	return tw

	function getGroupSamples(group) {
		const values = []
		for (const item of group.items) {
			const value = { sampleId: item.sampleId }
			if ('sample' in item) {
				disabled = false
				value.sample = item.sample
			}
			values.push(value)
		}
		return values
	}
}

export function showGroupsMenu(event, tw, allowedTermTypes, deleteCallback, app) {
	const parentMenu = new Menu({ padding: '5px' })

	const menuDiv = parentMenu.d.append('div')

	let row = menuDiv.append('div')

	//addMatrixMenuItems(menuDiv, groups)
	if (allowedTermTypes.includes('survival')) {
		const survivalDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Compare survival&nbsp;&nbsp;›')

		survivalDiv.on('click', async e => {
			const state = {
				nav: { header_mode: 'hide_search' },
				tree: { usecase: { target: 'survival', detail: 'term' } }
			}
			showTermsTree(
				survivalDiv,
				term => {
					openSurvivalPlot(term, tw, app)
				},
				state,
				app,
				parentMenu
			)
		})
	}
	// const summarizeDiv = menuDiv
	// 	.append('div')
	// 	.attr('class', 'sja_menuoption sja_sharp_border')
	// 	.html('Summarize')
	// summarizeDiv
	// 	.insert('div')
	// 	.html('›')
	// 	.style('float', 'right')

	// summarizeDiv.on('click', async e => {
	// 	showTermsTree(summarizeDiv, term => {
	// 		openSummaryPlot(term, groups)
	// 	})
	// })
	row = menuDiv
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Delete variable')
		.on('click', event => {
			deleteCallback()
		})

	parentMenu.show(event.clientX, event.clientY)
}

export async function openSurvivalPlot(term, tw, app, id) {
	let config = {
		chartType: 'survival',
		term,
		term2: JSON.parse(JSON.stringify(tw))
	}
	if (id) config.insertBefore = id
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

async function showTermsTree(div, callback, state = { tree: { usecase: { detail: 'term' } } }, app, parentMenu) {
	const menu = new Menu({ padding: '5px', offsetX: 170, offsetY: -34 })
	menu.showunderoffset(div.node())
	const termdb = await import('../../termdb/app')
	termdb.appInit({
		holder: menu.d,
		vocabApi: app.vocabApi,
		state,
		tree: {
			click_term: term => {
				callback(term)
				menu.hide()
				parentMenu.hide()
			}
		}
	})
}

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

export async function openSurvivalPlot(term, term2, app, id, getNewId) {
	let config = {
		chartType: 'survival',
		term,
		term2
	}
	if (id) config.insertBefore = id
	if (getNewId) config.id = getNewId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

export async function openSummaryPlot(term, samplelstTW, app, id, getNewId) {
	const newId = get$id()
	// barchart config.term{} name is confusing, as it is actually a termsetting object, not term
	// thus convert the given term into a termwrapper
	// tw.q can be missing and will be filled in with default setting
	const tw = { id: term.id, term }
	let config = {
		chartType: 'summary',
		childType: 'barchart',
		term: tw,
		term2: samplelstTW,
		id: getNewId()
	}
	if (id) config.insertBefore = id
	if (getNewId) config.id = getNewId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

export async function showTermsTree(div, callback, app, parentMenu, state = { tree: { usecase: { detail: 'term' } } }) {
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

export function addMatrixMenuItems(menu, menuDiv, tw, app, id, state, getNewId) {
	if (state.matrixplots) {
		for (const plot of state.matrixplots) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', async () => {
					const config = await app.vocabApi.getMatrixByName(plot.name)
					config.divideBy = tw
					config.insertBefore = id
					config.settings.matrix.colw = 0
					if (getNewId) config.id = getNewId()

					app.dispatch({
						type: 'plot_create',
						config
					})
					menu.hide()
				})
		}
	}
}

import { event as d3event } from 'd3-selection'
import { makelabel } from './leftlabel'

export function makeSampleLabel(data, tk, block, laby) {
	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.samples) {
		tk.leftlabels.doms.samples = makelabel(tk, block, laby)
	}
	tk.leftlabels.doms.samples
		.text(`${data.sampleTotalNumber} case${data.sampleTotalNumber > 1 ? 's' : ''}`)
		.on('click', () => {
			tk.menutip.clear().showunder(d3event.target)
			menu_samples(data, tk, block)
		})
}

function menu_samples(data, tk, block) {
	// subject to change

	if (tk.mds.variant2samples.termidlst) {
		// list terms for selecting one and summarize
	}

	tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption')
		.on('click', async () => {
			tk.menutip.clear()
			const wait = tk.menutip.d
				.append('div')
				.text('Loading...')
				.style('margin', '15px')
			try {
				const samples = await tk.mds.getSamples()
				renderTable({
					columns: await samples2columns(samples, tk),
					rows: samples2rows(samples, tk),
					div: tk.menutip.d
				})
				wait.remove()
			} catch (e) {
				wait.text(e.message || e)
				console.log(e)
			}
		})
}

async function samples2columns(samples, tk) {
	const columns = [{ label: 'Sample' }]
	if (tk.mds.variant2samples.termidlst) {
		for (const id of tk.mds.variant2samples.termidlst) {
			const t = await tk.mds.termdb.vocabApi.getterm(id)
			if (t) {
				columns.push({ label: t.name })
			} else {
				columns.push({ isinvalid: true })
			}
		}
	}
	columns.push({ label: 'Mutations', isSsm: true })
	return columns
}
function samples2rows(samples, tk) {
	const rows = []
	for (const sample of samples) {
		const row = [{ value: sample.sample_id }]

		if (tk.mds.variant2samples.url) {
			row[0].url = tk.mds.variant2samples.url.base + sample[tk.mds.variant2samples.url.namekey]
		}

		if (tk.mds.variant2samples.termidlst) {
			for (const id of tk.mds.variant2samples.termidlst) {
				row.push({ value: sample[id] })
			}
		}

		const ssmCell = { values: [] }
		for (const ssm_id of sample.ssm_id_lst) {
			const m = (tk.skewer.rawmlst || tk.custom_variants).find(i => i.ssm_id == ssm_id)
			const ssm = {}
			if (m) {
				ssm.value = m.mname
				if (tk.mds.queries && tk.mds.queries.snvindel && tk.mds.queries.snvindel.url) {
					ssm.url = tk.mds.queries.snvindel.url.base + m.ssm_id
				}
			} else {
				ssm.value = ssm_id
			}
			ssmCell.values.push(ssm)
		}

		row.push(ssmCell)
		rows.push(row)
	}
	return rows
}
function renderTable({ columns, rows, div }) {
	const table = div.append('table')
	const tr = table.append('tr')
	for (const c of columns) {
		tr.append('td').text(c.label)
	}
	for (const row of rows) {
		const tr = table.append('tr')
		for (const [colIdx, cell] of row.entries()) {
			const column = columns[colIdx]

			const td = tr.append('td')
			if (cell.values) {
				for (const v of cell.values) {
					const d = td.append('div')
					if (v.url) {
						d.append('a')
							.text(v.value)
							.attr('href', v.url)
							.attr('target', '_blank')
					} else {
						d.text(v.value)
					}
				}
			} else if (cell.url) {
				td.append('a')
					.text(cell.value)
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else {
				td.text(cell.value)
			}
		}
	}
}

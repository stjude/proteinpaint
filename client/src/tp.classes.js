import * as common from '#shared/common'

/*
list mutation classes
*/

export default function (cohort, button, folder) {
	let nothing = true
	for (const k in cohort.dsset) {
		nothing = false
	}
	if (nothing) {
		button.remove()
		folder.remove()
		return null
	}

	const cbreakdown = new Map()
	/*
	mclass breakdown per ds
	k: dskey
	v: map
	   k: mclass key
	   v: case count
	*/

	let totalcount = 0
	// sum of variants from all ds, to show on button

	for (const dskey in cohort.dsset) {
		const data = cohort.dsset[dskey].bulkdata
		if (!data) continue

		const class2count = new Map()
		// class 2 count in this ds
		// k: class, v: count

		// need to count sv/fusion separately to avoid duplicating
		const svstr = new Set()
		const fusionstr = new Set()

		for (const n in data) {
			for (const m of data[n]) {
				const c = m.class
				if (c == common.mclasssv) {
					svstr.add((m.sample ? m.sample : '') + '.' + (m.sampletype ? m.sampletype : '') + JSON.stringify(m.pairlst))
					continue
				}
				if (c == common.mclassfusionrna) {
					fusionstr.add(
						(m.sample ? m.sample : '') + '.' + (m.sampletype ? m.sampletype : '') + JSON.stringify(m.pairlst)
					)
					continue
				}

				// not sv/fusion, add to total
				totalcount++

				if (!class2count.has(c)) {
					class2count.set(c, 0)
				}
				class2count.set(c, class2count.get(c) + 1)
			}
		}

		if (svstr.size) {
			class2count.set(common.mclasssv, svstr.size)
			totalcount += svstr.size
		}
		if (fusionstr.size) {
			class2count.set(common.mclassfusionrna, fusionstr.size)
			totalcount += fusionstr.size
		}
		cbreakdown.set(dskey, class2count)
	}

	button
		.html(totalcount + ' <span style="font-size:.8em">VARIANTS</span>')
		.attr('aria-label', 'A summary of variant hits from all genes, in descending order.')
	const table = folder.append('table').style('margin-right', '20px')
	const trup = table.append('tr')
	const trdown = table.append('tr')
	const showclst = (lst, holder, number) => {
		holder.selectAll('*').remove()
		for (const i of lst) {
			const d = holder.append('div').style('margin', '10px')
			d.append('span')
				.attr('class', 'sja_mcdot')
				.style('background-color', i.color)
				.style('padding', '2px 5px')
				.style('margin-right', '5px')
				.html(number ? i.count : '&nbsp;&nbsp;')
			d.append('span').style('color', i.color).text(i.label)
		}
	}

	const ds2clst = {}
	for (const [dskey, class2count] of cbreakdown) {
		const lst = []
		for (const [k, count] of class2count) {
			const mc = common.mclass[k]
			if (
				mc.dt == common.dtsnvindel ||
				mc.dt == common.dtitd ||
				mc.dt == common.dtdel ||
				mc.dt == common.dtnloss ||
				mc.dt == common.dtcloss
			) {
				lst.push({
					key: k,
					label: mc.label,
					color: mc.color,
					count: count
				})
			}
		}
		lst.sort((a, b) => b.count - a.count)

		// hardcoded order for the following classes
		for (const thisclass of [common.mclasscnvloss, common.mclasscnvgain, common.mclasssv, common.mclassfusionrna]) {
			if (class2count.has(thisclass)) {
				const c = common.mclass[thisclass]
				lst.push({
					key: thisclass,
					label: c.label,
					color: c.color,
					count: class2count.get(thisclass)
				})
			}
		}

		ds2clst[dskey] = lst

		const cholder = trdown.append('td').attr('valign', 'top').attr('shownumber', 0)
		showclst(lst, cholder, true)
		const td = trup
			.append('td')
			.style('border-bottom', 'solid 1px #ccc')
			.style('padding', '5px 10px')
			.style('color', '#858585')
			.style('font-size', '.8em')
			.text(cohort.dsset[dskey].label)
		td.append('button')
			.style('margin', '5px')
			.text('Hide number')
			.on('click', event => {
				const number = cholder.attr('shownumber') == '1'
				showclst(lst, cholder, number)
				cholder.attr('shownumber', number ? '0' : '1')
				event.target.innerHTML = number ? 'Hide number' : 'Show number'
			})
	}
	return totalcount ? ds2clst : null
}

export function setInteractivity(self) {
	self.mouseover = function(event) {
		if (event.target.tagName == 'path' && event.target.__data__) {
			const s2 = event.target.__data__
			const displaySample = 'sample' in s2
			const shrink = self.opts.parent?.type == 'summary' && !displaySample
			const include = shrink ? dist => dist > 0 && dist < 0.2 : dist => dist < 0.2
			const overlapSamples = []
			const samples = self.data.samples.filter(s => {
				const dist = distance(s.x, s.y, s2.x, s2.y)
				if (dist == 0) overlapSamples.push(s)
				return self.getOpacity(s) > 0 && include(dist)
			})
			if (shrink)
				//filtered out s2, dist = 0
				samples.push(s2)
			if (samples.length == 0) return
			samples.sort((a, b) => {
				if (a.category < b.category) return -1
				if (a.category > b.category) return 1
				return 0
			})

			self.dom.tooltip.clear()
			if (shrink)
				self.dom.tooltip.d
					.append('div')
					.html(`<b> ${overlapSamples.length} ${overlapSamples.length == 1 ? 'sample' : 'samples'}</b>`)

			for (const [i, d] of samples.entries()) {
				if (i > 5) break
				if (!('sampleId' in d) && (!self.settings.showRef || self.settings.refSize == 0)) continue
				const div = self.dom.tooltip.d.append('div').style('padding-top', '2px')
				const table = div.append('table').style('width', '100%')
				const row = table.append('tr')
				if (displaySample) {
					if (d.sample == s2.sample) {
						let title = ''
						for (const os of overlapSamples) title += os.sample + ' '
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${title}</b>`)
					} else
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${d.sample}</b>`)
				}

				if (self.config.colorTW) addCategoryInfo(self.config.colorTW?.term, 'category', d, table)
				if (self.config.shapeTW) addCategoryInfo(self.config.shapeTW.term, 'shape', d, table)
				if (self.config.term) addCategoryInfo(self.config.term.term, 'x', d, table)
				if (self.config.term2) addCategoryInfo(self.config.term2?.term, 'y', d, table)

				if ('info' in d)
					for (const [k, v] of Object.entries(d.info)) {
						const row = table.append('tr')
						row.append('td').text(k)
						row.append('td').text(v)
					}
			}
			if (samples.length > 5) self.dom.tooltip.d.append('div').html(`<b>...(${samples.length - 5} more)</b>`)

			self.dom.tooltip.show(event.clientX, event.clientY, true, false)
		} else self.dom.tooltip.hide()

		function addCategoryInfo(term, category, d, table) {
			if (!term) return
			if (d[category] == 'Ref') return
			let row = table.append('tr')
			const ctd = row.append('td').text(term.name)

			if ('cat_info' in d && d.cat_info[category]) {
				const mutations = d.cat_info[category]
				ctd.attr('rowspan', mutations.length + 1)
				// row.append('td').text('Mutation')
				for (const mutation of mutations) {
					const dt = mutation.dt
					row = table.append('tr')
					const class_info = mclass[mutation.class]
					const clabel = 'mname' in mutation ? `${mutation.mname} ${class_info.label}` : class_info.label
					const tdclass = row.append('td').text(clabel)
					if (mutation.class != 'Blank') tdclass.style('color', class_info.color)
					else tdclass.style('color', mclass['WT'].color)
					const origin = morigin[mutation.origin]?.label
					const dtlabel = origin ? `${origin} ${dt2label[dt]}` : dt2label[dt]
					row.append('td').text(dtlabel)
				}
			} else {
				let value = d[category]
				if (typeof value == 'number') value = value.toFixed(2)
				row.append('td').text(value)
			}
		}
	}

	self.mouseclick = function() {
		if (!self.lassoOn) self.dom.tip.hide()
		self.dom.termstip.hide()
	}
}

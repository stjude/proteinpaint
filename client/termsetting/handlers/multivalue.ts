import { getPillNameDefault, set_hiddenvalues } from '#termsetting'
import type { TermWrapper, VocabApi, PillData } from '#types'

/*
handler for term type 'multivalue'

a membership multivalue term behaves like a categorical term whose sample can
belong to multiple categories at once; each key of the {key: number} annotation
is a category. the edit menu lists the categories with sample counts and lets
the user hide/show them in charts via q.hiddenValues. no groupsetting/bins yet.
*/

export function getHandler(self) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},
		getPillStatus() {
			const hidden = Object.keys(self.q?.hiddenValues || {}).length
			if (hidden) return { text: `${hidden} hidden` }
		},
		async showEditMenu(div: any) {
			await makeCategoryMenu(self, div)
		}
	}
}

async function makeCategoryMenu(self, div: any) {
	const data = await self.vocabApi.getCategories(self.term, self.filter)
	const lst = (data.lst || []).sort((a, b) => b.samplecount - a.samplecount)
	const holder = div.append('div').style('padding', '10px')

	if (!lst.length) {
		holder.append('div').style('opacity', 0.6).text('No categories')
		return
	}

	holder
		.append('div')
		.style('opacity', 0.6)
		.style('font-size', '.8em')
		.style('padding-bottom', '5px')
		.text('CHECK TO SHOW CATEGORY')

	const checkboxes = new Map() // k: category key, v: checkbox elem
	for (const c of lst) {
		const row = holder.append('div')
		const label = row.append('label')
		const checkbox = label.append('input').attr('type', 'checkbox').property('checked', !self.q.hiddenValues?.[c.key])
		checkboxes.set(c.key, checkbox)
		label.append('span').text(` ${c.label || c.key} `)
		label
			.append('span')
			.style('opacity', 0.6)
			.style('font-size', '.8em')
			.text(`n=${c.samplecount}`)
	}

	holder
		.append('button')
		.style('margin-top', '10px')
		.text('Apply')
		.on('click', () => {
			const hiddenValues: { [key: string]: number } = {}
			for (const [key, checkbox] of checkboxes) {
				if (!checkbox.property('checked')) hiddenValues[key] = 1
			}
			self.q.hiddenValues = hiddenValues
			self.dom.tip.hide()
			self.api.runCallback()
		})
}

export function fillTW(tw: TermWrapper, _vocabApi: VocabApi) {
	const q = tw.q as any
	if (!q.type) q.type = 'values'
	set_hiddenvalues(q, tw.term)
}

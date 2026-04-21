import { table2col, type Menu } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { SvgCircle } from '../../../types/d3'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { DataPointEntry } from '../VolcanoTypes'
import { DNA_METHYLATION, GENE_EXPRESSION } from '#shared/terms.js'

export class DataPointMouseEvents {
	termType: string

	constructor(d: DataPointEntry, circle: SvgCircle, tip: Menu, interactions: VolcanoInteractions, termType: string) {
		this.termType = termType

		const menuOpts = [
			{
				label: 'Violin plot',
				isVisible: () => {
					const enabledTermTypes = new Set([DNA_METHYLATION, GENE_EXPRESSION])
					return enabledTermTypes.has(termType)
				},
				onClick: async () => {
					if (termType === DNA_METHYLATION) interactions.launchDNAMethViolin(d as any)
					if (termType === GENE_EXPRESSION) interactions.launchViolinGeneExp(d.gene_name)
				}
			},
			{
				label: 'DMR analysis',
				isVisible: () => termType === DNA_METHYLATION,
				onClick: async () => {
					const dm = d as DataPointEntry & {
						chr: string
						start: number
						stop: number
						promoter_id?: string
						gene_name?: string
					}
					await interactions.launchDmr({
						chr: dm.chr,
						start: dm.start,
						stop: dm.stop,
						promoterId: dm.promoter_id
					})
				}
			},
			{
				label: 'Box plot',
				isVisible: () => termType === GENE_EXPRESSION,
				onClick: async () => {
					interactions.launchBoxPlot(d.gene_name)
				}
			}
		]

		// Use a throwaway clone to visualize the hover highlight instead of mutating
		// the original circle + raising it. Rearranging DOM mid-hover can leave the
		// original stuck at full fill-opacity when rapid enter/leave events race
		// against the DOM move. Same pattern as the p-value table hover preview.
		let clone: SVGCircleElement | null = null
		const showHighlight = () => {
			if (clone) return
			const node = circle.node() as SVGCircleElement | null
			if (!node) return
			const c = node.cloneNode(true) as SVGCircleElement
			c.setAttribute('fill-opacity', '0.9')
			// Don't intercept subsequent enter/leave events destined for siblings.
			c.setAttribute('pointer-events', 'none')
			node.parentNode?.appendChild(c)
			clone = c
		}
		const hideHighlight = () => {
			if (!clone) return
			clone.remove()
			clone = null
		}

		circle.on('mouseenter', () => {
			// Skip the clone for already-highlighted points; their fill handles the visual.
			if (!d.highlighted) showHighlight()
			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })
			this.addTooltipRows(d, table)
		})

		let menuOpen = false
		circle.on('mouseleave', () => {
			if (menuOpen) return
			tip.hide()
			hideHighlight()
		})

		const visibleMenuOpts = menuOpts.filter(opt => opt.isVisible())
		if (visibleMenuOpts.length === 0) return

		circle.on('click', () => {
			menuOpen = true
			if (!d.highlighted) showHighlight()
			tip.onHide = () => {
				menuOpen = false
				hideHighlight()
			}
			tip.clear().showunder(circle.node())
			for (const opt of visibleMenuOpts) {
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(opt.label)
					.on('click', async () => {
						tip.hide()
						hideHighlight()
						await opt.onClick()
					})
			}
		})
	}

	addTooltipRows(d: DataPointEntry, table: any) {
		if (this.termType === DNA_METHYLATION) {
			if ('promoter_id' in d) this.addTooltipRow(table, 'Promoter', d.promoter_id)
			if (d.gene_name) this.addTooltipRow(table, 'Gene(s)', d.gene_name)
		} else {
			this.addTooltipRow(table, 'Gene name', d.gene_name)
		}
		this.addTooltipRow(table, 'log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
		this.addTooltipRow(table, 'Original p-value', roundValueAuto(d.original_p_value))
		this.addTooltipRow(table, 'Adjusted p-value', roundValueAuto(d.adjusted_p_value))
	}

	addTooltipRow(table: any, text: string, value: number | string) {
		const [td1, td2] = table.addRow()
		td1.html(text)
		td2.text(value)
	}
}

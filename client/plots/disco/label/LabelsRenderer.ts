import type IRenderer from '#plots/disco/IRenderer.ts'
import { select } from 'd3-selection'
import { line } from 'd3-shape'
import type Label from './Label.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import type MutationTooltip from '#plots/disco/label/MutationTooltip.ts'
import type FusionTooltip from '#plots/disco/fusion/FusionTooltip.ts'
import { table2col } from '#dom/table2col'
import type CnvTooltip from '#plots/disco/cnv/CnvTooltip.ts'
import { appendVafBars, hasAnyValidVafEntry } from '#plots/disco/snv/vafTooltip.ts'
import { dtitd, dtloh } from '#shared/common.js'
import { dofetch3 } from '#common/dofetch'

type GeneCoordinates = {
	chr: string
	start: number
	stop: number
}

type GeneLookup = (gene: string, genome: string) => Promise<any>

export default class LabelsRenderer implements IRenderer {
	private animationDuration: number
	private fontSize: number
	private geneClickListener: (gene: string, mnames: Array<string>) => void
	private genomeName?: string
	private intervalEvents: Array<CnvTooltip>
	private geneLookup: GeneLookup
	private geneCoordinatesCache = new Map<string, Promise<GeneCoordinates | undefined>>()
	private hoverRequestId = 0

	constructor(
		animationDuration: number,
		fontSize: number,
		geneClickListener: (gene: string, mnames: Array<string>) => void,
		genomeName?: string,
		intervalEvents: Array<CnvTooltip> = [],
		geneLookup: GeneLookup = async (gene, genome) =>
			await dofetch3('genelookup', { body: { deep: 1, input: gene, genome } })
	) {
		this.animationDuration = animationDuration
		this.fontSize = fontSize
		this.geneClickListener = geneClickListener
		this.genomeName = genomeName
		this.intervalEvents = intervalEvents
		this.geneLookup = geneLookup
	}

	render(holder: any, elements: Array<Label>, collisions?: Array<Label>) {
		const labelsG = holder.append('g')

		const lineFunction = line<{ x: number; y: number }>()
			.x(point => point.x)
			.y(point => point.y)

		const menu = MenuProvider.create()

		labelsG
			.selectAll('.group')
			.data(elements)
			.enter()
			.append('g')
			.attr('class', 'group')
			.each((label: Label, i: number, nodes: HTMLDivElement[]) => {
				const g = select(nodes[i])
				g.append('text')
					.attr('class', 'chord-text')
					.attr('data-testid', 'sjpp-disco-genelabel')
					.attr('dy', '.35em')
					.attr('transform', label.transform)
					.style('text-anchor', label.textAnchor)
					.style('font-size', `${this.fontSize}px`)
					.style('fill', label.color)
					.style('cursor', 'pointer')
					.text(label.text)
					.on('click', () => {
						if (label.mutationsTooltip) {
							this.geneClickListener(
								label.text,
								label.mutationsTooltip.map(value => value.mname)
							)
						}
					})
					.on('mouseover', async (mouseEvent: MouseEvent) => {
						const requestId = ++this.hoverRequestId
						this.renderTooltip(menu, label)
						menu.show(mouseEvent.x, mouseEvent.y)

						const coordinates = await this.getGeneCoordinates(label)
						if (requestId != this.hoverRequestId || !coordinates) return

						const overlappingEvents = this.intervalEvents.filter(
							event =>
								this.sameChromosome(event.chr, coordinates.chr) &&
								coordinates.stop >= event.start &&
								event.stop >= coordinates.start
						)
						this.renderTooltip(menu, label, overlappingEvents)
					})
					.on('mouseout', () => {
						this.hoverRequestId++
						menu.clear()
						menu.hide()
					})

				g.append('path')
					.attr('class', 'chord-tick')
					.datum(label.line.points)
					.style('stroke', label.color)
					.style('fill', 'none')
					.attr('d', lineFunction)
			})

		labelsG.selectAll('.group').each((label: Label, i: number, nodes: HTMLDivElement[]) => {
			const collision = collisions ? collisions.find(l => l.text === label.text) : undefined
			if (collision) {
				const g = select(nodes[i])
				g.selectAll('.chord-text')
					.datum(collision)
					.transition()
					.duration(this.animationDuration)
					.attr('transform', collision.transform)
					.style('text-anchor', collision.textAnchor)

				g.selectAll('.chord-tick')
					.datum(collision.line.points)
					.transition()
					.duration(this.animationDuration)
					.style('fill', 'none')
					.attr('d', lineFunction)
			}
		})
	}

	private renderTooltip(menu: any, label: Label, intervalEvents = label.cnvTooltip) {
		menu.clear()
		const table = table2col({ holder: menu.d })
		this.createTooltip(table, label, intervalEvents)
	}

	private async getGeneCoordinates(label: Label): Promise<GeneCoordinates | undefined> {
		if (!this.genomeName || !this.intervalEvents.length) return

		const cacheKey = `${this.genomeName}:${label.text}:${label.chr}`
		let lookup = this.geneCoordinatesCache.get(cacheKey)
		if (!lookup) {
			lookup = this.lookupGeneCoordinates(label)
			this.geneCoordinatesCache.set(cacheKey, lookup)
		}
		return await lookup
	}

	private async lookupGeneCoordinates(label: Label): Promise<GeneCoordinates | undefined> {
		try {
			const response = await this.geneLookup(label.text, this.genomeName!)
			if (response?.error || !Array.isArray(response?.gmlst)) return

			const models = response.gmlst.filter(
				model =>
					this.sameChromosome(model.chr, label.chr) && Number.isFinite(model.start) && Number.isFinite(model.stop)
			)
			if (!models.length) return

			return {
				chr: models[0].chr,
				start: Math.min(...models.map(model => model.start)),
				stop: Math.max(...models.map(model => model.stop))
			}
		} catch {
			return
		}
	}

	private sameChromosome(a: string, b: string) {
		return a?.replace(/^chr/i, '').toLowerCase() == b?.replace(/^chr/i, '').toLowerCase()
	}

	createTooltip(table: any, label: Label, intervalEvents = label.cnvTooltip) {
		if (label.mutationsTooltip) {
			const [td1, td2] = table.addRow()
			td1.text('Gene')
			td2.append('span').style('margin-left', '5px').text(label.text)

			label.mutationsTooltip.forEach((mutation: MutationTooltip) => {
				{
					const [td1, td2] = table.addRow()

					td1.text('Mutation')
					td2
						.append('span')
						.style('margin-left', '5px')
						.text(mutation.mname)
						.append('span')
						.style('margin-left', '5px')
						.style('color', mutation.color)
						.text(`${mutation.dataClass}`)
						.append('span')
						.style('margin-left', '5px')
						.style('color', 'black')
						.style('font-size', '0.8em')
						.text(` ${mutation.chr}:${mutation.position}`)
					if (hasAnyValidVafEntry(mutation.vafs)) {
						appendVafBars(td2, mutation.vafs)
					}
				}
			})
		}

		if (label.fusionTooltip) {
			const [td1, td2] = table.addRow()

			td1.text('Data type')
			td2.append('span').text('Fusion transcript')
			label.fusionTooltip.forEach((fusionTooltip: FusionTooltip) => {
				const [td1, td2] = table.addRow()

				td1.text('Position')
				td2.append('span').text(
					` ${fusionTooltip.geneA ? fusionTooltip.geneA : '?'} ${fusionTooltip.chrA}:${fusionTooltip.posA}
						${fusionTooltip.strandA == '+' ? 'forward' : 'reverse'} > ` +
						`${fusionTooltip.geneB ? fusionTooltip.geneB : '?'} ${fusionTooltip.chrB}:${fusionTooltip.posB} ${
							fusionTooltip.strandB == '+' ? 'forward' : 'reverse'
						} `
				)
			})
		}

		if (intervalEvents) {
			intervalEvents.forEach((cnv: CnvTooltip) => {
				const [td1, td2] = table.addRow()
				td1.text(cnv.dt == dtitd ? 'ITD' : cnv.dt == dtloh ? 'LOH' : 'CNV')
				td2.append('span').style('margin-left', '5px').style('background-color', cnv.color).html('&nbsp;&nbsp;')

				if (cnv.dt != dtitd && cnv.dt != dtloh) td2.append('span').style('margin-left', '7.5px').text(cnv.value)
				td2
					.append('span')
					.style('margin-left', '7.5px')
					.style('font-size', '0.8em')
					.text(`${cnv.chr}:${cnv.start}-${cnv.stop}`)
			})
		}
	}
}

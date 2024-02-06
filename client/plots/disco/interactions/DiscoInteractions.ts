export class DiscoInteractions {
	cappingClickCallback: (d: any, t: any) => void
	downloadClickListener: (d: any) => void
	geneClickListener: (gene: string, mnames: Array<string>) => void
	prioritizeGenesCheckboxListener: (checked: boolean) => void
	downloadImgName: string

	constructor(disco: any) {
		// note! only call this constructor then disco.state{} is created
		this.downloadImgName = disco.state.settings.downloadImgName || 'disco.plot'

		this.cappingClickCallback = (d: any, t: any) => {
			const tip = disco.app.tip
			tip.clear()
			const body = disco.app.tip.d
			const input = body
				.append('span')
				.html('Capping:')
				.append('input')
				.attr('type', 'number')
				.on('change', () => {
					disco.app.dispatch({
						type: 'plot_edit',
						id: disco.opts.id,
						config: {
							settings: {
								cnv: {
									capping: Number(input.property('value'))
								}
							}
						}
					})
					tip.hide()
				})
			const rect = t.node().getBoundingClientRect()
			const x = rect.left - 20
			const y = rect.top - 40

			tip.show(x, y)
		}

		this.downloadClickListener = (svg: any) => {
			const a = document.createElement('a')
			document.body.appendChild(a)

			a.addEventListener(
				'click',
				() => {
					// must use arrow function but not "function()", so this.downloadImgName is accessible
					const serializer = new XMLSerializer()
					const svg_blob = new Blob([serializer.serializeToString(svg)], {
						type: 'image/svg+xml'
					})
					a.download = this.downloadImgName + '.svg'
					a.href = URL.createObjectURL(svg_blob)
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		}

		this.geneClickListener = async (gene: string, mnames: Array<string>) => {
			const { filter, filter0 } = disco.app.getState().termfilter
			const arg = {
				holder: disco.app.opts.holder,
				genome: disco.app.opts.state.args.genome,
				nobox: true,
				query: gene,
				tklst: [
					{
						type: 'mds3',
						dslabel: disco.app.opts.state.dslabel,
						hlaachange: mnames.join(','),
						filter0,
						filterObj: filter
					}
				]
			}
			const _ = await import('#src/block.init')
			await _.default(arg)
		}

		this.prioritizeGenesCheckboxListener = (checked: boolean) => {
			disco.app.dispatch({
				type: 'plot_edit',
				id: disco.opts.id,
				config: {
					settings: {
						label: {
							prioritizeGeneLabelsByGeneSets: checked
						}
					}
				}
			})
		}
	}
}

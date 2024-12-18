export class DiscoInteractions {
	discoApp: any

	downloadClickListener: (d: any) => void
	geneClickListener: (gene: string, mnames: Array<string>) => void
	colorScaleNumericInputsCallback: (obj: {
		cutoffMode: string
		min?: number
		max?: number
		percentile?: number
	}) => void

	constructor(discoApp: any) {
		// note: discoApp will be set when discoApp.state{} is created
		this.discoApp = discoApp

		this.downloadClickListener = (svg: any) => {
			const downloadImgName = this.discoApp.state.settings.downloadImgName || 'disco.plot'
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
					a.download = downloadImgName + '.svg'
					a.href = URL.createObjectURL(svg_blob)
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		}

		this.geneClickListener = async (gene: string, mnames: Array<string>) => {
			const { filter, filter0 } = this.discoApp.app.getState().termfilter
			const arg = {
				holder: this.discoApp.app.opts.holder,
				genome: this.discoApp.app.opts.state.args.genome,
				nobox: true,
				query: gene,
				tklst: [
					{
						type: 'mds3',
						dslabel: this.discoApp.app.opts.state.dslabel,
						hlaachange: mnames.join(','),
						filter0,
						filterObj: structuredClone(filter) // must not pass filter as frozen. duplicate to pass unfrozen copy so mds3 code will work
					}
				]
			}
			const _ = await import('#src/block.init')
			await _.default(arg)
		}
		/** Corresponds to the numericInputs callback in dom/ColorScale.ts
		 * Used for CNV legend items only. */
		this.colorScaleNumericInputsCallback = async (obj: {
			cutoffMode: string
			min?: number
			max?: number
			percentile?: number
		}) => {
			if (obj.cutoffMode == 'auto') {
				if (!obj.min || !obj.max) throw new Error('min and max must be defined for cutoffMode auto')
				this.discoApp.app.dispatch({
					type: 'plot_edit',
					id: this.discoApp.id,
					config: {
						settings: {
							Disco: {
								cnvCapping: this.discoApp.state.settings.cnv.capping,
								cnvPercentile: this.discoApp.state.settings.cnv.percentile,
								cnvCutoffMode: obj.cutoffMode
							}
						}
					}
				})
			} else if (obj.cutoffMode == 'fixed') {
				if (!obj.min || !obj.max) throw new Error('min and max must be defined for cutoffMode fixed')
				this.discoApp.app.dispatch({
					type: 'plot_edit',
					id: this.discoApp.id,
					config: {
						settings: {
							Disco: {
								cnvCapping: Math.max(Math.abs(obj.min), obj.max),
								cnvCutoffMode: obj.cutoffMode
							}
						}
					}
				})
			} else if (obj.cutoffMode == 'percentile') {
				this.discoApp.app.dispatch({
					type: 'plot_edit',
					id: this.discoApp.id,
					config: {
						settings: {
							Disco: {
								cnvPercentile: obj.percentile,
								cnvCutoffMode: obj.cutoffMode
							}
						}
					}
				})
			} else throw new Error('Unknown cutoff mode')
		}
	}
}

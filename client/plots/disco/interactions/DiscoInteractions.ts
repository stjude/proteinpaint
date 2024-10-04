export class DiscoInteractions {
	discoApp: any

	downloadClickListener: (d: any) => void
	geneClickListener: (gene: string, mnames: Array<string>) => void

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
	}
}

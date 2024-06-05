export default async function (dslabel, holder, genomeObj, sample_id, dzimages) {
	const loadingDiv = holder.append('div').style('margin', '20px').text('Loading...')

	try {
		const opts = {
			holder: holder,

			state: {
				genome: genomeObj.name,
				dslabel: dslabel,
				sample_id: sample_id,
				dzimages: dzimages,

				plots: [
					{
						chartType: 'DziViewer',
						subfolder: 'dziviewer',
						extension: 'ts'
					}
				]
			}
		}
		const plot = await import('#plots/plot.app.js')
		const plotAppApi = await plot.appInit(opts)
		loadingDiv.remove()
	} catch (e) {
		loadingDiv.text('Error: ' + (e.message || e))
	}
}

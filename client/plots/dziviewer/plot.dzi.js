/* A plot for the displaying Deep Zoom Images.
"DZI" or "Deep Zoom Image" is a file format developed by Microsoft for efficiently displaying large images by dividing them into smaller segments,
allowing users to pan and zoom with high performance and minimal loading time.


dslabel=str
	as on vocab.dslabel

holder
	holder div

genomeObj={}
	client side genome obj

sample_id

dzimages = Array<str>
	list of paths to DZI files

*/
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

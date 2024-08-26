import wsiViewerImageFiles from './wsimagesloaded.ts'
/* A plot for the displaying Whole Slide Images.

dslabel=str
	as on vocab.dslabel

holder
	holder div

genomeObj={}
	client side genome obj

sample_id

throwError
	optional, instead of showing error to the user, throw

*/
export default async function (dslabel, holder, genomeObj, sample_id, throwError) {
	const loadingDiv = holder.append('div').style('margin', '20px').text('Loading...')

	try {
		const opts = {
			holder: holder,

			state: {
				genome: genomeObj.name,
				dslabel: dslabel,
				sample_id: sample_id,

				plots: [
					{
						chartType: 'WSIViewer',
						subfolder: 'wsiviewer',
						extension: 'ts',
						wsimages: await wsiViewerImageFiles({ dslabel, sample_id, genomeObj })
					}
				]
			}
		}
		const plot = await import('#plots/plot.app.js')
		const plotAppApi = await plot.appInit(opts)
		loadingDiv.remove()
	} catch (e) {
		if (throwError) {
			loadingDiv.remove()
		} else loadingDiv.text('Error: ' + (e.message || e))
	}
}

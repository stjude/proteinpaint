/* A plot for the displaying Whole Slide Images.

dslabel=str
	as on vocab.dslabel

holder
	holder div

genomeObj={}
	client side genome obj

sample_id

*/
export default async function (dslabel, holder, genomeObj, sample_id, aiProjectID, aiWSIMageFiles) {
	const loadingDiv = holder.append('div').style('margin', '20px').text('Loading...')

	try {
		const opts = {
			holder: holder,
			state: {
				genome: genomeObj.name,
				dslabel: dslabel,
				sample_id: sample_id,
				// TODO - quick fix, remove before merging
				aiProjectID: aiProjectID,
				aiWSIMageFiles: aiWSIMageFiles,
				plots: [
					{
						chartType: 'WSIViewer',
						subfolder: 'wsiviewer',
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

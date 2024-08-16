import { dofetch3 } from '#common/dofetch'

export default async function wsiViewerImageFiles(o) {
	const data = await dofetch3('samplewsimages', {
		body: {
			genome: o.app.opts.state.genome,
			dslabel: o.app.opts.state.dslabel,
			sample_id: o.app.opts.state.sample_id
		}
	})
	return data.sampleWSImages
}

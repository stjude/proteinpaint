import type { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'

export class ModelTrainerRenderer {
	private wsiinteractions: WSIViewerInteractions

	constructor(wsiinteractions: WSIViewerInteractions) {
		this.wsiinteractions = wsiinteractions
	}

	render(holder, projectId: string, genome: string, dslabel: string) {
		//TODO: Add logic to check if there is an annotation to retrain the model
		//Or look for a treshhold of annotations
		//Maybe use a buffer??
		holder
			.append('div')
			.style('margin', '20px 0 0 0')
			.append('button')
			.attr('type', 'submit')
			.style('font-size', '1.25em')
			.style('padding', '10px 25px')
			.style('border-radius', '20px')
			.style('border', '1px solid black')
			.style('background-color', 'transparent')
			.style('margin', '0 10px')
			.style('cursor', 'pointer')
			.text('Retrain Model')
			.on('click', async () => {
				this.wsiinteractions.onRetrainModelClicked(genome, dslabel, projectId)
				//temp implementation to call route
			})
	}
}

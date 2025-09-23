import { dofetch3 } from '#common/dofetch'

export class ModelTrainerRenderer {
	render(holder) {
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
				//temp implementation to call route
				await dofetch3('/aiProjectTrainModel', {
					body: {
						genome: 'hg38',
						dslabel: 'GDC'
					}
				})
			})
	}
}

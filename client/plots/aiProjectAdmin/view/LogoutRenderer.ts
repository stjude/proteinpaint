import type { AIProjectAdminInteractions } from '#plots/aiProjectAdmin/interactions/AIProjectAdminInteractions.ts'

export class LogoutRenderer {
	private interactions: AIProjectAdminInteractions

	constructor(interactions: AIProjectAdminInteractions) {
		this.interactions = interactions
	}

	render(holder, genome: string, dslabel: string) {
		holder
			.append('div')
			.style('position', 'absolute')
			.style('top', '10px')
			.attr('data-testid', 'logout-button')
			.style('right', '20px')
			.style('z-index', '1000')
			.append('button')
			.attr('type', 'submit')
			.style('font-size', '1.25em')
			.style('padding', '10px 25px')
			.style('border-radius', '20px')
			.style('border', '1px solid black')
			.style('background-color', 'white')
			.style('cursor', 'pointer')
			.text('Finish Annotating')
			.on('click', async () => {
				await this.interactions.onLogOut(genome, dslabel, holder)
			})
	}
}

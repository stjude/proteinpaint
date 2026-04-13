export class SpinnerRenderer {
	renderSpinner(holder: any) {
		holder.selectAll('*').style('cursor', 'wait')
	}
	renderDefaultCursor(holder: any) {
		holder.selectAll('*').style('cursor', 'default')
	}
}

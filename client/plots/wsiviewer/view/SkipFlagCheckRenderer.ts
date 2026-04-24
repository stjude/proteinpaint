export class SkipFlagCheckRenderer {
	render(holder: any, wsiApp: any, flagChecked: boolean, skipChecked: boolean) {
		const skipFlagFieldSet = holder.append('div').append('fieldset').attr('id', 'SFField')
		console.log()
		const flagCheck = skipFlagFieldSet
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', 'flaganno')
			.attr('name', 'skipflag')
			.attr('value', 'flagging')
			.property('checked', flagChecked)
		skipFlagFieldSet.append('label').text('Show Only Flagged').attr('for', 'flaganno')
		const skipCheck = skipFlagFieldSet
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', 'skipanno')
			.attr('name', 'skipflag')
			.attr('value', 'notskipping')
			.property('checked', skipChecked)
		skipFlagFieldSet.append('label').text('Show Skipped').attr('for', 'skipanno')

		// Adding listener that will uncheck each other, even though I'm using a checkbox
		//These options aren't compatible but radio buttons cant be completely unselected
		flagCheck.on('change', (event: Event) => {
			const target = event.target as HTMLInputElement
			if (target.checked) {
				skipCheck.property('checked', false)
				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderOnlyFlagged: true,
							renderSkipped: false,
							changeTrigger: Date.now()
						}
					}
				})
				console.log('Checkbox is checked')
			} else {
				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderOnlyFlagged: false,
							changeTrigger: Date.now()
						}
					}
				})
				console.log('Checkbox is unchecked')
			}
		})

		skipCheck.on('change', (event: Event) => {
			const target = event.target as HTMLInputElement
			if (target.checked) {
				flagCheck.property('checked', false)
				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderOnlyFlagged: false,
							renderSkipped: true,
							changeTrigger: Date.now()
						}
					}
				})
				console.log('Checkbox is checked')
			} else {
				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderSkipped: false,
							changeTrigger: Date.now()
						}
					}
				})
				console.log('Checkbox is unchecked')
			}
		})
	}
}

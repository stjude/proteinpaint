import type { TileSelection } from '@sjcrh/proteinpaint-types'
import type Settings from '../Settings'
import { SessionWSImage } from '../viewModel/SessionWSImage'

export class SkipFlagCheckRenderer {
	render(
		holder: any,
		wsiApp: any,
		flagChecked: boolean,
		skipChecked: boolean,
		sessionWSImage: SessionWSImage,
		settings: Settings
	) {
		function calculateNewIndex(currentIndex: number, newSettings: Settings) {
			const oldTileSelections: TileSelection[] = SessionWSImage.getTileSelections(sessionWSImage, settings) || []
			const currentID = oldTileSelections[currentIndex]?.id
			const newTileSelections: TileSelection[] = SessionWSImage.getTileSelections(sessionWSImage, newSettings) || []
			const newIndex = newTileSelections.findIndex(tileSelection => tileSelection.id === currentID)
			return newIndex != -1 ? newIndex : 0
		}

		const skipFlagFieldSet = holder.append('div').append('fieldset').attr('id', 'SFField')
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
			let newSettings: Settings = {
				...settings,
				renderWSIViewer: false,
				renderAnnotationTable: true,
				changeTrigger: Date.now()
			}
			const skipCheckBool = target.checked ? false : settings.renderSkipped
			skipCheck.property('checked', skipCheckBool)
			newSettings = {
				...newSettings,
				renderOnlyFlagged: target.checked,
				renderSkipped: skipCheckBool
			}
			newSettings.activeAnnotation = calculateNewIndex(settings.activeAnnotation, newSettings)
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: newSettings
				}
			})
		})
		skipCheck.on('change', (event: Event) => {
			const target = event.target as HTMLInputElement
			let newSettings: Settings = {
				...settings,
				renderWSIViewer: false,
				renderAnnotationTable: true,
				changeTrigger: Date.now()
			}
			const flagCheckBool = target.checked ? false : settings.renderOnlyFlagged
			flagCheck.property('checked', flagCheckBool)
			newSettings = {
				...newSettings,
				renderOnlyFlagged: flagCheckBool,
				renderSkipped: target.checked
			}
			newSettings.activeAnnotation = calculateNewIndex(settings.activeAnnotation, newSettings)
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: newSettings
				}
			})
		})
	}
}

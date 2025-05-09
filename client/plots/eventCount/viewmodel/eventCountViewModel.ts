import type { EventCount } from '../eventCount.ts'
import { RunchartViewModel } from '../../runchart/viewmodel/runchartViewModel.ts'

export class EventCountViewModel extends RunchartViewModel {
	eventCount: EventCount

	constructor(eventCount: EventCount) {
		super(eventCount)
		this.eventCount = eventCount
	}
}

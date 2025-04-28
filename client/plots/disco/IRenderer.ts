import type Arc from './arc/Arc.ts'

export default interface IRenderer {
	render(holder: any, elements: Array<Arc>, collisions?: Array<Arc>): any
}

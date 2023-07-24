import Arc from './arc/Arc'

export default interface IRenderer {
	render(holder: any, elements: Array<Arc>, collisions?: Array<Arc>)
}

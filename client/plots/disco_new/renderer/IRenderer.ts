import Arc from "#plots/disco_new/viewmodel/Arc";

export default interface IRenderer {
    render(holder: any,  elements: Array<Arc>, collisions?: Array<Arc>)
}
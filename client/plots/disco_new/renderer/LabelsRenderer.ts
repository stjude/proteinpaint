import IRenderer from "#plots/disco_new/renderer/IRenderer";

export default class LabelsRenderer implements IRenderer {
    render(holder: any, viewModel: any) {
        const labels = holder.append("g")
    }
}
import IRenderer from "#plots/disco_new/renderer/IRenderer";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import ArcRenderer from "#plots/disco_new/renderer/ArcRenderer";
import LabelsRenderer from "#plots/disco_new/renderer/LabelsRenderer";

export class DiscoRenderer implements IRenderer {
    private arcRenderer: ArcRenderer;
    private labelsRenderer: LabelsRenderer;

    constructor() {
        this.arcRenderer = new ArcRenderer()
        this.labelsRenderer = new LabelsRenderer()
    }

    render(holder: any, viewModel: ViewModel) {
        const svg = holder.append('svg')
            .attr('width', viewModel.width)
            .attr('height', viewModel.height)

        const mainG = svg.append('g')
            .attr('class', "mainG")
            .attr('transform', `translate(${viewModel.width / 2},${viewModel.height / 2})`);


        this.arcRenderer.render(mainG, viewModel)

        this.labelsRenderer.render(mainG, viewModel)
    }
}

// TODO remove to other file
function degrees_to_radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}
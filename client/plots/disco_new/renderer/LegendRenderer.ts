import Legend from "../viewmodel/Legend";

export default class LegendRenderer {
    constructor() {
    }
    render(holder: any, legend: Legend) {
        const legendDiv = holder.append("div")
            .style("text-align", "center")

        this.renderSnvLegend(legendDiv, legend);

        this.renderCnvLegend(legendDiv, legend);
    }

    private renderSnvLegend(legendDiv: any, legend: Legend) {

        const elementDiv = legendDiv.append("div")
            .style("font-size", "10px")

        const innerDiv = elementDiv.append("div")
            .style("font-weight", "700")
            .text(legend.snvTitle)

        const snv = innerDiv.append("div")

        for (const snvLegend of legend.snvClassMap.values()) {
            const currentSnv = snv.append("div")
                .style("display", "inline-block")

            currentSnv.append("div")
                .style("background-color", snvLegend.color)
                .style("display", "inline-block")
                .style("width", "8px")
                .style("height", "8px")
                .style("margin-right", "2px")

            currentSnv.append("span")
                .style("margin-right", "10px")
                .text(snvLegend.snvType)
        }
    }

    private renderCnvLegend(legendDiv: any, legend: Legend) {

        // TODO extract gain and loss
        const gain = legend.cnvClassMap.get("gain")
        const loss = legend.cnvClassMap.get("loss")

        const elementDiv = legendDiv.append("div")
            .style("font-size", "10px")

        elementDiv.append("div")
            .style("font-weight", "700")
            .text(legend.cnvTitle)

        const holderDiv = elementDiv.append("div")
            .style("padding", "3px")


        const svg = holderDiv.append("svg")
            .attr("width", "2")
            .attr("height", "20")
            .style("overflow", "visible")
            .style("z-index", "1")
            .style("shape-rendering", "crispedges")

        svg.append("line")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("x1", 1)
            .attr("y1", 0)
            .attr("x2", 1)
            .attr("y2", 20)

        svg.append("line")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("x1", 1)
            .attr("y1", 1)
            .attr("x2", -4)
            .attr("y2", 1)

        svg.append("text")
            .attr("x", -5)
            .attr("y", 5)
            .attr("text-anchor", "end")
            .style("font-size", "8px")
            .text(gain ? gain.value : "Not defined")

        svg.append("line")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("x1", 1)
            .attr("y1", 20)
            .attr("x2", -4)
            .attr("y2", 20)

        svg.append("text")
            .attr("x", -5)
            .attr("y", 21)
            .attr("text-anchor", "end")
            .style("font-size", "8px")
            .text(loss ? loss.value : "Not defined")

        svg.append("line")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .attr("x1", 1)
            .attr("y1", 10)
            .attr("x2", -4)
            .attr("y2", 10)

        svg.append("text")
            .attr("x", -5)
            .attr("y", 13)
            .attr("text-anchor", "end")
            .style("font-size", "8px")
            .text(0)

        const cnvTextDiv = holderDiv.append("div")
            .style("display", "inline-block")
            .style("vertical-align", "top")

        cnvTextDiv.append("div")
            .style("width", "50px")
            .style("height", "8px")
            .style("vertical-align","top")
            .style("background-color", gain? gain.color: "#000")
            .style("text-align", "left")
            .style("font-size", "8px")
            .style("color", "#FFF")
            .style("padding", "0px 0px 3px 5px")
            .text(gain? gain.cnvType: "Not defined")

        cnvTextDiv.append("div")
            .style("width", "50px")
            .style("height", "8px")
            .style("vertical-align", "bottom")
            .style("background-color", loss? loss.color: "#000")
            .style("text-align", "left")
            .style("font-size", "8px")
            .style("color", "#FFF")
            .style("padding", "0px 0px 3px 5px")
            .text(loss? loss.cnvType: "Not defined")
    }
}
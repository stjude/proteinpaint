import * as d3 from "d3";
import Arc from "../viewmodel/Arc";

export default class FullArcRenderer {

    private svnInnerRadius: number;
    private svnWidth: number;
    private color: string;
    constructor(svnInnerRadius: number, svnWidth: number, color: string) {
        this.svnInnerRadius = svnInnerRadius
        this.svnWidth = svnWidth
        this.color = color
    }
    render(holder: any) {
        const donutGenerator = d3.arc<Arc>()
        const arc = new Arc(0,
            Math.PI * 2, this.svnInnerRadius,
            this.svnInnerRadius + this.svnWidth,
    // TODO extract color
    "#6464641A",
            "No label")

        const array: Array<Arc> = []
        array.push(arc)
        const donutArc = holder.append("g")
        donutArc.selectAll("path")
            .data(array)
            .enter()
            .append("path")
            .attr('d', (d: Arc) => donutGenerator(d))
            .attr("fill", (d: Arc) => d.color)
    }
}
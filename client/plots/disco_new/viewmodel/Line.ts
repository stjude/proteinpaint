import Label from "#plots/disco_new/viewmodel/Label";
import Point from "#plots/disco_new/viewmodel/Point";

export default class Line {

    color: string
    points = new Array<Point>

    constructor(label: Label, tickGap: number) {

        const r0 = label.outerRadius
        const r1 = label.labelRadius - tickGap
        this.color = label.labelFill

        this.points.push( new Point(r0 * Math.cos(label.ccAngle), r0 * Math.sin(label.ccAngle)))
        this.points.push(new Point(r1 * Math.cos(label.ccAngle), r1 * Math.sin(label.ccAngle)))
    }
}
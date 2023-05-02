import Arc from "#plots/disco_new/viewmodel/Arc";
import Line from "#plots/disco_new/viewmodel/Line";
import Point from "#plots/disco_new/viewmodel/Point";

export default class Label extends Arc {

    readonly transform: string;
    readonly textAnchor: string;
    readonly ccAngle: number;

    line: Line

    constructor(
        startAngle: number,
        endAngle: number,
        innerRadius: number,
        outerRadius: number,
        readonly labelRadius: number,
        readonly value: number,
        readonly label: any,
        readonly gene: any,
        readonly layerNum: number,
        readonly chromosome: any,
        readonly cssClass: any,
        readonly aachange: string,
        readonly d: any,
        readonly sample: any,
        readonly hits: number,
        readonly labelFill: string) {
        super()
        this.startAngle = startAngle
        this.endAngle = endAngle
        this.innerRadius = innerRadius
        this.outerRadius = outerRadius
        this.angle = (this.startAngle + this.endAngle) / 2
        this.ccAngle = this.angle - Math.PI / 2
        this.transform = `rotate(${(this.angle * 180) / Math.PI - 90}) translate(${this.labelRadius})${this.angle > Math.PI ? 'rotate(180)' : ''}`
        this.textAnchor = this.angle > Math.PI ? 'end' : ''
        const r0 = this.outerRadius
        //  tickGap = - 2; pass tickGap from defaults
        const r1 = this.labelRadius - 2
        // this.color = label.labelFill

        const points = []

        console.log("r0 * Math.cos(this.ccAngle)", r0 * Math.cos(this.ccAngle))

        points.push(new Point(r0 * Math.cos(this.ccAngle), r0 * Math.sin(this.ccAngle)))
        points.push(new Point(r1 * Math.cos(this.ccAngle), r1 * Math.sin(this.ccAngle)))

        this.line = new Line(points, this.labelFill)
    }
}
import Arc from "#plots/disco_new/viewmodel/Arc";
import Line from "#plots/disco_new/viewmodel/Line";

export default class Label extends Arc {

    readonly angle: number;

    readonly transform: string;
    readonly textAnchor: string;
    readonly ccAngle: number;

    readonly line: Line

    constructor(
        readonly startAngle: number,
        readonly endAngle: number,
        readonly innerRadius: number,
        readonly outerRadius: number,
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
        this.angle = (this.startAngle + this.endAngle) / 2
        this.ccAngle = this.angle - Math.PI / 2
        this.transform = `rotate(${(this.angle * 180) / Math.PI - 90}) translate(${this.labelRadius})${this.angle > Math.PI ? 'rotate(180)' : ''}`
        this.textAnchor = this.angle > Math.PI ? 'end' : ''
        // todo pass tickGap from defaults
        this.line = new Line(this, 2)
    }
}
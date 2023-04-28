import Arc from "#plots/disco_new/viewmodel/Arc";

export default class Label extends Arc {

    readonly angle: number;

    readonly transform: string;
    readonly textAnchor: string;

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
        this.angle = (startAngle + endAngle) / 2
        this.transform = `rotate(${(this.angle * 180) / Math.PI - 90}) translate(${this.labelRadius})${this.angle > Math.PI ? 'rotate(180)' : ''}`
        this.textAnchor = this.angle > Math.PI ? 'end' : ''
    }
}
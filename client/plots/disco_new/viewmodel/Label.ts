export default class Label {
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
    }
}
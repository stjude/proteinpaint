import Arc from "./Arc";

export default class Chromosome extends Arc {

    angle: number;
    ccAngle: number;

    posbins: Array<any> = []

    constructor(readonly start: number,
                readonly size: number,
                readonly factor: number,
                startAngle: number,
                endAngle: number,
                innerRadius: number,
                outerRadius: number,
                cssClass: string,
                label: string,
                padAngle = undefined,
                width: number = -1,) {

        super(startAngle, endAngle, innerRadius, outerRadius, cssClass, width, label, padAngle = undefined);

        this.angle = (startAngle + endAngle) / 2
        this.ccAngle = this.angle - Math.PI / 2
    }
}
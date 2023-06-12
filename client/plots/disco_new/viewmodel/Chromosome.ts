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
                color: string,
                label: string) {

        super(startAngle, endAngle, innerRadius, outerRadius, color, label);

        this.angle = (startAngle + endAngle) / 2
        this.ccAngle = this.angle - Math.PI / 2
    }
}
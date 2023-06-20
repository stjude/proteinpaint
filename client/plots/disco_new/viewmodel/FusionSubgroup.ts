import {RibbonSubgroup} from "d3";

export default class FusionSubgroup implements RibbonSubgroup{

    startAngle: number;
    endAngle: number;
    radius: number;

    gene: string;
    value: number;
    genes: Set<string>;
    chromosomes: Set<string>
    constructor(startAngle: number, endAngle: number, radius: number, gene: string, value: number, genes: Set<string>, chromosomes: Set<string>) {
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.radius = radius;
        this.gene = gene;
        this.value = value;
        this.genes = genes;
        this.chromosomes = chromosomes;
    }
}
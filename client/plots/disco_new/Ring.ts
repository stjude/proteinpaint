export default class Ring {
    radius: number
    width: number

    innerRadius: number
    outerRadius: number


    ribbons?: Array<Ribbon>
    elements : Array<any>

    constructor(radius: number, width: number, chromosomes : {}) {
        this.radius = radius
        this.elements = []

        for (const chromosomesKey in chromosomes) {
            this.elements.push(chromosomes[chromosomesKey].size)
        }

        const halfOfWidth = width / 2;
        this.innerRadius = radius - halfOfWidth
        this.outerRadius = radius + halfOfWidth
    }
}
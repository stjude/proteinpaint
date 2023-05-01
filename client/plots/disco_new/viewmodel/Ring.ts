import Arc from "#plots/disco_new/viewmodel/Arc";
import Ribbon from "#plots/disco_new/viewmodel/Ribbon";

export default class Ring<T extends Arc> {
    width: number

    innerRadius: number
    outerRadius: number

    elements: Array<T>
    ribbons?: Array<Ribbon>

    collisions?: Array<T>
    fontSize: number;

    constructor(innerRadius: number, width: number, elements: Array<T>, calculateCollisions = false) {
        this.innerRadius = innerRadius
        this.outerRadius = innerRadius + width

        this.elements = elements

        //TODO pass font size
        this.fontSize = 12
        if (calculateCollisions) {
            this.calculateCollisions();
        }
    }

    private calculateCollisions() {
        this.collisions = []
        console.log("this.innerRadius", this.innerRadius)
        const circumference = 2 * Math.PI * this.innerRadius
        const h = (3.5 * this.fontSize) / circumference
        let prev = {endAngle: 0}
        this.elements.sort((a, b) => {
            return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
        }).forEach((element, index) => {
            if (index != 0) {
                const overlap = prev.endAngle - element.startAngle + h
                if (overlap > 0) {
                    element.startAngle += overlap
                    element.endAngle += overlap
                    element.angle = (element.startAngle + element.endAngle) / 2

                    this.collisions.push(element)
                }
                prev = element
            }
        })
    }
}
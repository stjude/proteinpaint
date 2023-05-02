import Ring from "#plots/disco_new/viewmodel/Ring";
import Label from "#plots/disco_new/viewmodel/Label";
import Point from "#plots/disco_new/viewmodel/Point";
import Line from "#plots/disco_new/viewmodel/Line";

export default class Labels extends Ring<Label> {

    collisions?: Array<Label>
    fontSize: number;

    constructor(innerRadius: number, width: number, elements: Array<Label>) {
        super(innerRadius, width, elements.sort((a, b) => {
            return a.startAngle < b.startAngle ? -1 : a.startAngle > b.startAngle ? 1 : 0
        }));

        //TODO pass font size
        this.fontSize = 12
        this.calculateCollisions();

    }

    private calculateCollisions() {
        this.collisions = []
        const circumference = 2 * Math.PI * this.innerRadius
        const h = (3.5 * this.fontSize) / circumference
        let prev = {endAngle: 0}


        this.elements.forEach((element, index) => {
            if (index != 0) {

                const overlap = prev.endAngle - element.startAngle + h


                if (overlap > 0) {
                    element.startAngle += overlap
                    element.endAngle += overlap
                    element.angle = (element.startAngle + element.endAngle) / 2

                    const r0 = element.outerRadius
                    const r1 = element.labelRadius - 2
                    const dr = (r1 - r0) / 3
                    const cos0 = Math.cos(element.ccAngle)
                    const sin0 = Math.sin(element.ccAngle)
                    const cos1 = Math.cos(element.ccAngle + overlap)
                    const sin1 = Math.sin(element.ccAngle + overlap)

                    const points: Array<Point> = []

                    points.push(new Point(r0 * cos0, r0 * sin0))
                    points.push(new Point((r0 + dr) * cos0, (r0 + dr) * sin0))
                    points.push(new Point((r0 + 2 * dr) * cos1, (r0 + 2 * dr) * sin1))
                    points.push(new Point((r0 + 3 * dr) * cos1, (r0 + 3 * dr) * sin1))

                    element.line = new Line(points, element.labelFill)


                    this.collisions.push(element)
                }

                prev = element
            }
        })
    }
}
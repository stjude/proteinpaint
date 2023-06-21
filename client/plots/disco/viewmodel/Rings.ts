import Label from "./Label";
import Ring from "./Ring";
import Chromosome from "./Chromosome";
import Labels from "./Labels";
import SnvArc from "./SnvArc";
import CnvArc from "./CnvArc";
import LohArc from "./LohArc";

export default class Rings {

    labelsRing: Labels<Label>
    chromosomesRing: Ring<Chromosome>
    nonExonicArcRing: Ring<SnvArc>
    snvArcRing: Ring<SnvArc>;
    cnvArcRing: Ring<CnvArc>;
    lohArcRing: Ring<LohArc>;

    constructor(labelsRing: Labels<Label>,
                chromosomesRing: Ring<Chromosome>,
                nonExonicArcRing: Ring<SnvArc>,
                snvArcRing: Ring<SnvArc>,
                cnvArcRing: Ring<CnvArc>,
                lohArcRing: Ring<LohArc>) {
        this.labelsRing = labelsRing;
        this.chromosomesRing = chromosomesRing;
        this.nonExonicArcRing = nonExonicArcRing
        this.snvArcRing = snvArcRing
        this.cnvArcRing = cnvArcRing
        this.lohArcRing = lohArcRing
    }
}
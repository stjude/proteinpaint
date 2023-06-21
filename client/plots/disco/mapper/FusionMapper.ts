import Reference from "./Reference";
import Data from "./Data";
import Fusion from "#plots/disco/viewmodel/Fusion";
import FusionSubgroup from "#plots/disco/viewmodel/FusionSubgroup";
import Settings from "#plots/disco/viewmodel/Settings";

export default class FusionMapper {
    private settings: Settings;
    private sampleName: string;
    private reference: Reference;

    constructor(settings: any, sampleName: string, reference: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference
    }

    map(fusionData: Array<Data>): Array<Fusion> {
        const radius = this.settings.rings.fusionRadius
        const fusions: Array<Fusion> = []


        fusionData.forEach(data => {

            const genes = new Set<string>()
            genes.add(data.geneA)
            genes.add(data.geneB)

            const chromosomes = new Set<string>()
            chromosomes.add(data.chrA)
            chromosomes.add(data.chrB)

            const source = new FusionSubgroup(this.calculateStartAngle(data.chrA, data.posA),
                this.calculateEndAngle(data.chrA, data.posA),
                radius,
                data.geneA,
                data.value,
                genes,
                chromosomes)

            const target = new FusionSubgroup(this.calculateStartAngle(data.chrB, data.posB),
                this.calculateEndAngle(data.chrB, data.posB),
                radius,
                data.geneB,
                data.value,
                genes,
                chromosomes)

            const fusion = new Fusion(source, target, "genes", -1, "Endpoints")

            fusions.push(fusion)
        })

        return fusions
    }

    calculateStartAngle(chr: string, pos: number) {
        const index = this.reference.chromosomesOrder.indexOf(chr)
        const chromosome = this.reference.chromosomes[index]
        // TODO calculate 0.01 base on BPs
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size)) - 0.01;
    }

    private calculateEndAngle(chr: string, pos: number) {
        const index = this.reference.chromosomesOrder.indexOf(chr)
        const chromosome = this.reference.chromosomes[index]
        // TODO calculate 0.01 base on BPs
        return 0.01 + chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size));
    }
}
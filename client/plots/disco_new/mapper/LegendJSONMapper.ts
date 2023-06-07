import Legend from "../viewmodel/Legend";

export default class LegendJSONMapper {

    map(legend: Legend) {

        const legendJSON: Array<any> = [];

        let order = 0

        const snvItems: Array<any> = []

        let snvOrder = 0

        for (const [snvKey, snvLegendElement] of legend.snvClassMap) {
            snvItems.push(
                {
                    termid: legend.snvTitle,
                    key: snvKey,
                    text: snvLegendElement.snvType,
                    color: snvLegendElement.color,
                    order: snvOrder++,
                    border: "1px solid #ccc"
                }
            )
        }

        legendJSON.push({
            name: legend.snvTitle,
            order: order++,
            items: snvItems
        })

        const gain = legend.cnvClassMap.get("gain")
        const loss = legend.cnvClassMap.get("loss")

        if (gain && loss) {
            let cnvOrder = 0
            const cnvItems: Array<any> = []
            cnvItems.push(
                {
                    termid: legend.cnvTitle,
                    key: "gain",
                    text: `${gain.cnvType}: ${gain.value}`,
                    color: gain.color,
                    order: cnvOrder++,
                    border: "1px solid #ccc"
                }
            )

            cnvItems.push(
                {
                    termid: legend.cnvTitle,
                    key: "loss",
                    text: `${loss.cnvType}: ${loss.value}`,
                    color: loss.color,
                    order: cnvOrder++,
                    border: "1px solid #ccc"
                }
            )


            legendJSON.push({
                name: legend.cnvTitle,
                order: order++,
                items: cnvItems
            })
        }


        // TODO add other legend elements

        return legendJSON

    }
}
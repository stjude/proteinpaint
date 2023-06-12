import Settings from "./Settings";

export default function discoDefaults(overrides = {}): Settings {
    return Object.assign(
        {
            rings: {
                fusionRadius: 80,

                cnvInnerRadius: 100,
                cnvWidth: 20,

                lohInnerRadius: 120,
                lohWidth: 20,

                svnInnerRadius: 140,
                svnWidth: 20,

                nonExonicInnerRadius: 160,
                nonExonicWidht: 30,

                chromosomeInnerRadius: 190,
                chromosomeWidth: 20,

                labelLinesInnerRadius: 210,
                labelsToLinesDistance: 30,
                labelsToLinesGap: 2,

            },

            verticalPadding: 70,
            horizontalPadding: 200,

            layerScaler: 1,
            padAngle: 0.002, //0.01, //0.04,

            label: {
                fontSize: 12,
                maxDeltaAngle: 0.05,
                animationDuration: 1000,
                overlapAngleFactor: 5 // 7 is set by testing, because label height is not known before rendering
            },

            cnv: {
                lossCapped: -5,
                ampCapped: 5,
                ampColor: '#D6683C',
                lossColor: '#67a9cf',
                cappedAmpColor: '#8B0000',
                cappedLossColor: '#00008B'
            },

            menu: {
                padding: 5

            }
        },
        overrides
    )
}

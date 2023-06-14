export class DiscoInteractions {
    cappingClickCallback: (d: any, t: any) => void;

    constructor(app: any) {
        this.cappingClickCallback = (d: any, t: any) => {
            const tip = app.app.tip
            tip.clear()
            const body = app.app.tip.d
            const input = body.append('span').html("Capping:").append("input").attr("type", "number").on("change", () => {
                app.app.dispatch({
                    type: 'plot_edit',
                    id: app.opts.id,
                    config: {
                        settings: {
                            cnv: {
                                capping: Number(input.property("value"))
                            }
                        }
                    }
                })
                tip.hide()
            })
            const rect = t.node().getBoundingClientRect();
            const x = rect.left - 20;
            const y = rect.top - 40;

            tip.show(x, y)
        }
    }
}
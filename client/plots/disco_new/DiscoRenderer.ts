import IRenderer from "./IRenderer";

export class DiscoRenderer implements IRenderer{
    constructor() {
    }
    render(appState: any): Element {
        const div = document.createElement('div');
        div.innerHTML = 'Hello World';
        return div
    }
}
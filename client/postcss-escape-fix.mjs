// postcss-escape-fix.mjs
import postcss from 'postcss';

export default postcss.plugin('postcss-escape-fix', () => {
    return (root) => {
        root.walkDecls((decl) => {
            decl.value = decl.value.replace(/\\([0-7]{1,3})/g, (match, octal) => {
                return String.fromCharCode(parseInt(octal, 8));
            });
        });
    };
});

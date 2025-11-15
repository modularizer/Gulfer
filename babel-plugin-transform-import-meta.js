/**
 * Babel plugin to transform import.meta.url to a format Metro can handle
 * This allows packages like @electric-sql/pglite to be bundled
 */
module.exports = function({ types: t, template }) {
  return {
    name: 'transform-import-meta',
    visitor: {
      MemberExpression(path) {
        // Handle import.meta.url
        if (
          t.isMetaProperty(path.node.object) &&
          path.node.object.meta.name === 'import' &&
          path.node.object.property.name === 'meta' &&
          t.isIdentifier(path.node.property) &&
          path.node.property.name === 'url'
        ) {
          // Replace import.meta.url with a runtime value
          // For web, use window.location.href, for Node use __filename or process.cwd()
          const replacement = template.expression.ast`
            (typeof window !== 'undefined' 
              ? window.location.href 
              : typeof __filename !== 'undefined' 
                ? __filename 
                : typeof process !== 'undefined' && process.cwd 
                  ? process.cwd() + '/index.js'
                  : '')
          `;
          path.replaceWith(replacement);
        }
      },
    },
  };
};


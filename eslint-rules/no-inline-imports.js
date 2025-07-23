export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow dynamic import() calls within functions - use static imports at the top of the file instead",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noInlineImports: "Dynamic import() calls should be avoided. Use static imports at the top of the file instead.",
    },
  },
  create(context) {
    return {
      ImportExpression(node) {
        context.report({
          node,
          messageId: "noInlineImports",
        });
      },
    };
  },
};

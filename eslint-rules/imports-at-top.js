export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure static imports are always at the top of the file",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      importNotAtTop:
        "Static imports must be at the top of the file (after directives like 'use client'). Found import after {{nodeType}}.",
    },
  },
  create(context) {
    let hasSeenNonImportStatement = false;
    let lastNonImportNodeType = null;

    return {
      Program() {
        hasSeenNonImportStatement = false;
        lastNonImportNodeType = null;
      },

      ImportDeclaration(node) {
        if (hasSeenNonImportStatement) {
          context.report({
            node,
            messageId: "importNotAtTop",
            data: {
              nodeType: lastNonImportNodeType || "statement",
            },
          });
        }
      },

      "Program > *"(node) {
        if (node.type === "ImportDeclaration") {
          return;
        }

        if (
          node.type === "ExpressionStatement" &&
          node.expression?.type === "Literal" &&
          typeof node.expression.value === "string" &&
          (node.expression.value === "use client" ||
            node.expression.value === "use server") &&
          !hasSeenNonImportStatement
        ) {
          return;
        }

        hasSeenNonImportStatement = true;
        lastNonImportNodeType =
          node.type === "VariableDeclaration"
            ? "variable declaration"
            : node.type === "FunctionDeclaration"
            ? "function declaration"
            : node.type === "ExportNamedDeclaration"
            ? "export statement"
            : node.type === "ExportDefaultDeclaration"
            ? "export statement"
            : "statement";
      },
    };
  },
};

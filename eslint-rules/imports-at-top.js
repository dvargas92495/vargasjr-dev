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
      importNotAtTop: "Static imports must be at the top of the file (after directives like 'use client'). Found import after {{nodeType}}.",
    },
  },
  create(context) {
    let hasSeenNonImportStatement = false;
    let lastNonImportNode = null;
    
    return {
      Program(node) {
        hasSeenNonImportStatement = false;
        lastNonImportNode = null;
      },
      
      ImportDeclaration(node) {
        if (hasSeenNonImportStatement && lastNonImportNode) {
          context.report({
            node,
            messageId: "importNotAtTop",
            data: {
              nodeType: lastNonImportNode.type === "ExpressionStatement" && 
                       lastNonImportNode.expression?.type === "Literal" &&
                       typeof lastNonImportNode.expression.value === "string" &&
                       (lastNonImportNode.expression.value === "use client" || 
                        lastNonImportNode.expression.value === "use server")
                ? "directive" 
                : lastNonImportNode.type.toLowerCase().replace(/([A-Z])/g, ' $1').trim()
            },
          });
        }
      },
      
      "Program > *"(node) {
        if (node.type === "ImportDeclaration") {
          return;
        }
        
        if (node.type === "ExpressionStatement" && 
            node.expression?.type === "Literal" &&
            typeof node.expression.value === "string" &&
            (node.expression.value === "use client" || 
             node.expression.value === "use server") &&
            !hasSeenNonImportStatement) {
          return;
        }
        
        hasSeenNonImportStatement = true;
        lastNonImportNode = node;
      },
    };
  },
};

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow mocking internal source code modules",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noMockInternal:
        "Do not mock internal source code. Mock external dependencies instead. Found mock of '{{modulePath}}'",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee &&
          node.callee.type === "MemberExpression" &&
          node.callee.object &&
          node.callee.object.name === "vi" &&
          node.callee.property &&
          node.callee.property.name === "mock"
        ) {
          if (
            node.arguments.length > 0 &&
            node.arguments[0].type === "Literal"
          ) {
            const modulePath = node.arguments[0].value;

            if (
              typeof modulePath === "string" &&
              (modulePath.startsWith("@/") ||
                modulePath.startsWith("./") ||
                modulePath.startsWith("../"))
            ) {
              context.report({
                node: node.arguments[0],
                messageId: "noMockInternal",
                data: {
                  modulePath: modulePath,
                },
              });
            }
          }
        }
      },
    };
  },
};

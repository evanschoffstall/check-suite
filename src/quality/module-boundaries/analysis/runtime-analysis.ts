import ts from "typescript";

export function countTopLevelRuntimeOperations(
  sourceFile: ts.SourceFile,
): number {
  return sourceFile.statements.reduce(
    (count, statement) => count + countRuntimeOperationsInNode(statement),
    0,
  );
}

function countRuntimeOperationsInNode(node: ts.Node): number {
  if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
    return 0;
  }

  let count = isRuntimeOperationNode(node) ? 1 : 0;
  node.forEachChild((child) => {
    count += countRuntimeOperationsInNode(child);
  });
  return count;
}

function isProcessCwdCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process" &&
    node.expression.name.text === "cwd"
  );
}

function isProcessEnvAccess(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process" &&
    node.expression.name.text === "env"
  );
}

function isRuntimeOperationNode(node: ts.Node): boolean {
  return (
    ts.isAwaitExpression(node) ||
    isProcessEnvAccess(node) ||
    isProcessCwdCall(node) ||
    (ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword)
  );
}

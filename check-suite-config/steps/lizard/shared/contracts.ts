import ts from "typescript";

export interface ComplexityThresholds {
  fileCcn: number;
  fileFunctionCount: number;
  fileNloc: number;
  fileTokenCount: number;
  functionCcn: number;
  functionLength: number;
  functionNestingDepth: number;
  functionNloc: number;
  functionParameterCount: number;
  functionTokenCount: number;
}

export interface ComplexityViolation {
  metrics: string[];
  target: string;
}

export interface FileMetrics {
  ccn: number;
  functionCount: number;
  nloc: number;
  path: string;
  tokenCount: number;
}

export type FunctionMetrics = TypeScriptFunctionMetrics;

export type TopLevelDeclaration =
  | ts.ArrowFunction
  | ts.ConstructorDeclaration
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.MethodDeclaration;

export interface TopLevelFunctionNode {
  declaration:
    | ts.ArrowFunction
    | ts.ConstructorDeclaration
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.MethodDeclaration;
  functionName: string;
  startNode: ts.Node;
}

export interface TypeScriptFunctionMetrics {
  ccn: number;
  endLine: number;
  functionName: string;
  length: number;
  location: string;
  nestingDepth: number;
  nloc: number;
  parameterCount: number;
  path: string;
  startLine: number;
  tokenCount: number;
}

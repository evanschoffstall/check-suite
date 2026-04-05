import type {
  ArchitectureDependencyPolicy,
  ArchitectureProject,
  ArchitectureViolation,
  SourceFileFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import { inferDependencyPolicy } from "@/quality/module-boundaries/import/rule/index.ts";

export function buildDependencyPolicyCycleViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (!project.config.requireAcyclicDependencyPolicies) {
    return [];
  }

  const adjacency = buildPolicyAdjacency(project);
  return [...findPolicyCycles(adjacency)].map((cycle) => ({
    code: "dependency-policy-cycle",
    message: `dependency policy cycle detected: ${cycle.join(" -> ")}`,
  }));
}

export function buildPolicyFanOutViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (project.config.maxPolicyFanOut === Number.MAX_SAFE_INTEGER) {
    return [];
  }

  return [...buildPolicyAdjacency(project).entries()].flatMap(
    ([policyName, dependencies]) =>
      dependencies.size > project.config.maxPolicyFanOut &&
      !isHighFanOutPolicy(project, policyName)
        ? [
            {
              code: "dependency-policy-fan-out",
              message: `${policyName} depends on ${dependencies.size} architectural owners; keep owners focused or explicitly allow broad orchestration`,
            },
          ]
        : [],
  );
}

export function buildPublicSurfaceTierViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return getPublicSurfaceFacts(project).flatMap((sourceFact) => {
    const policy = inferDependencyPolicy(
      sourceFact.path,
      project.config.dependencyPolicies,
    );

    return [
      ...buildExplicitSurfaceTierViolations(project, sourceFact, policy),
      ...buildPrivateRuntimeSurfaceViolations(sourceFact, policy),
    ];
  });
}

function buildExplicitSurfaceTierViolations(
  project: ArchitectureProject,
  sourceFact: SourceFileFacts,
  policy: ArchitectureDependencyPolicy | null,
): ArchitectureViolation[] {
  if (!project.config.explicitPublicSurfacePaths.includes(sourceFact.path)) {
    return [];
  }

  return policy?.surfaceTier === "public"
    ? []
    : [
        {
          code: "public-surface-tier",
          message: `${sourceFact.path} is an explicit public surface but is not owned by a public-tier dependency policy`,
        },
      ];
}

function buildPolicyAdjacency(
  project: ArchitectureProject,
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const policy of project.config.dependencyPolicies) {
    adjacency.set(policy.name, new Set<string>());
  }

  for (const entry of project.imports) {
    if (!entry.resolvedPath) {
      continue;
    }

    const sourcePolicy = inferDependencyPolicy(
      entry.sourcePath,
      project.config.dependencyPolicies,
    );
    const targetPolicy = inferDependencyPolicy(
      entry.resolvedPath,
      project.config.dependencyPolicies,
    );

    if (
      !sourcePolicy ||
      !targetPolicy ||
      sourcePolicy.name === targetPolicy.name
    ) {
      continue;
    }

    const dependencies = adjacency.get(sourcePolicy.name) ?? new Set<string>();
    dependencies.add(targetPolicy.name);
    adjacency.set(sourcePolicy.name, dependencies);
  }

  return adjacency;
}

function buildPrivateRuntimeSurfaceViolations(
  sourceFact: SourceFileFacts,
  policy: ArchitectureDependencyPolicy | null,
): ArchitectureViolation[] {
  return policy?.surfaceTier === "private-runtime"
    ? [
        {
          code: "private-runtime-public-surface",
          message: `${sourceFact.path} is exposed as a public surface, but ${policy.name} is marked private-runtime`,
        },
      ]
    : [];
}

function depthFirstSearch(
  policyName: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
  visiting: Set<string>,
  stack: string[],
  cycles: Set<string>,
): void {
  if (visited.has(policyName)) {
    return;
  }

  visiting.add(policyName);
  stack.push(policyName);

  for (const dependency of adjacency.get(policyName) ?? []) {
    if (visiting.has(dependency)) {
      cycles.add(serializeCycle(stack, dependency));
      continue;
    }

    depthFirstSearch(dependency, adjacency, visited, visiting, stack, cycles);
  }

  stack.pop();
  visiting.delete(policyName);
  visited.add(policyName);
}

function findPolicyCycles(adjacency: Map<string, Set<string>>): Set<string[]> {
  const cycles = new Set<string>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  for (const policyName of adjacency.keys()) {
    depthFirstSearch(policyName, adjacency, visited, visiting, stack, cycles);
  }

  return new Set(
    [...cycles].map((serializedCycle) => serializedCycle.split(" -> ")),
  );
}

function getPublicSurfaceFacts(
  project: ArchitectureProject,
): SourceFileFacts[] {
  return project.sourceFacts.filter(
    (sourceFact) =>
      (sourceFact.isEntrypoint &&
        inferDependencyPolicy(
          sourceFact.path,
          project.config.dependencyPolicies,
        )?.surfaceTier !== "private-runtime") ||
      project.config.explicitPublicSurfacePaths.includes(sourceFact.path),
  );
}

function isHighFanOutPolicy(
  project: ArchitectureProject,
  policyName: string,
): boolean {
  return (
    project.config.dependencyPolicies.find((policy) => policy.name === policyName)
      ?.role === "orchestration"
  );
}

function rotateCycleToLowestName(cycle: string[]): string[] {
  const body = cycle.slice(0, -1);
  const lowestIndex = body.reduce(
    (bestIndex, name, index) =>
      name.localeCompare(body[bestIndex] ?? name) < 0 ? index : bestIndex,
    0,
  );
  const rotated = [...body.slice(lowestIndex), ...body.slice(0, lowestIndex)];
  return [...rotated, rotated[0] ?? ""];
}

function serializeCycle(stack: string[], cycleStart: string): string {
  const cycleStartIndex = stack.indexOf(cycleStart);
  const cycle = [...stack.slice(cycleStartIndex), cycleStart];
  const canonicalCycle = rotateCycleToLowestName(cycle);
  return canonicalCycle.join(" -> ");
}

export function getBunxCommandTarget(args: string[]): null | string {
  const target = args.find((arg) => !arg.startsWith("-"));
  return target && target.length > 0 ? target : null;
}

export function hasExplicitPackageVersion(specifier: string): boolean {
  if (!specifier.startsWith("@")) return specifier.includes("@");

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return false;
  return specifier.includes("@", slashIndex + 1);
}

export function isBunxCommandAvailable(
  args: string[],
  declaredBunxTargets: ReadonlySet<string>,
): boolean {
  const target = getBunxCommandTarget(args);
  if (!target || hasExplicitPackageVersion(target)) return true;

  const packageName = stripPackageVersion(target);
  return (
    declaredBunxTargets.has(target) || declaredBunxTargets.has(packageName)
  );
}

function stripPackageVersion(specifier: string): string {
  if (!specifier.startsWith("@")) {
    return specifier.split("@", 2)[0] ?? specifier;
  }

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return specifier;

  const versionIndex = specifier.indexOf("@", slashIndex + 1);
  return versionIndex < 0 ? specifier : specifier.slice(0, versionIndex);
}

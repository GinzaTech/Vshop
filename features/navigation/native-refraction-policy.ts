export function canUseNativeRefraction(os: string, version: string | number, apiVersion: unknown): boolean {
  return os === "android" && Number.isFinite(Number(version)) && Number(version) >= 33 && apiVersion === 1;
}

export function validRefractionTarget(tag: unknown): tag is number {
  return typeof tag === "number" && Number.isSafeInteger(tag) && tag > 0;
}

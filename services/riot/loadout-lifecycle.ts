const retirementListeners = new Set<() => void>();
export function subscribeLoadoutRetirement(listener: () => void) {
  retirementListeners.add(listener);
  return () => { retirementListeners.delete(listener); };
}
export function retireLoadoutOwners() {
  retirementListeners.forEach((listener) => listener());
}

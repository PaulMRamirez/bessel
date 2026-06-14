// Pure multi-object selection helpers. Selection is a set distinct from the camera
// focus: many objects can be selected while the camera centers on one.

/** Toggle an id in the selection, preserving insertion order. */
export function toggleSelection(
  selection: readonly string[],
  id: string,
): readonly string[] {
  return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
}

export function isSelected(selection: readonly string[], id: string): boolean {
  return selection.includes(id);
}

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_ROOTS = ["app", "components", "features", "hooks"] as const;
const APP_ICON_BOUNDARY = "components/ui/AppIcon.tsx";
const MATERIAL_COMMUNITY_MODULE =
  "@expo/vector-icons/MaterialCommunityIcons";
const MORPHICONS_MODULE = "morphicons/react-native";

const remainingLegacyImports = new Set([
  "app/(authenticated)/combat.tsx",
  "app/(authenticated)/friends.tsx",
  "app/(authenticated)/settings.tsx",
  "app/chat/[friendId].tsx",
  "features/combat/CombatSessionScreen.tsx",
]);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function toWorkspacePath(filePath: string): string {
  return relative(process.cwd(), filePath).replaceAll("\\", "/");
}

const sourceFiles = SOURCE_ROOTS.flatMap((root) => listSourceFiles(root));

function findFiles(pattern: RegExp): string[] {
  return sourceFiles
    .filter((filePath) => pattern.test(readFileSync(filePath, "utf8")))
    .map(toWorkspacePath)
    .sort();
}

describe("AppIcon source boundary", () => {
  it("keeps direct MaterialCommunityIcons imports at the boundary and exact remaining allowlist", () => {
    const directMaterialCommunityImports = findFiles(
      new RegExp(
        `(?:from\\s+|import\\s+)["']${MATERIAL_COMMUNITY_MODULE}["']`,
      ),
    );

    expect(directMaterialCommunityImports).toContain(APP_ICON_BOUNDARY);
    expect(
      directMaterialCommunityImports.filter(
        (filePath) => filePath !== APP_ICON_BOUNDARY,
      ),
    ).toEqual([...remainingLegacyImports].sort());
  });

  it("keeps direct MorphIcon imports inside the AppIcon boundary", () => {
    const directMorphIconImports = findFiles(
      new RegExp(`(?:from\\s+|import\\s+)["']${MORPHICONS_MODULE}["']`),
    );

    expect(directMorphIconImports).toEqual([APP_ICON_BOUNDARY]);
  });

  it("does not use namespace or deep Lucide imports", () => {
    expect(
      findFiles(/import\s+\*\s+as\s+\w+\s+from\s+["']lucide["']/),
    ).toEqual([]);
    expect(findFiles(/from\s+["']lucide\//)).toEqual([]);
  });
});

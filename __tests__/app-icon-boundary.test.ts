import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_ROOTS = ["app", "components", "features", "hooks"] as const;
const APP_ICON_BOUNDARY = "components/ui/AppIcon.tsx";
const MATERIAL_COMMUNITY_MODULE =
  "@expo/vector-icons/MaterialCommunityIcons";
const MORPHICONS_MODULE = "morphicons/react-native";

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

function moduleImportPattern(moduleName: string): RegExp {
  return new RegExp(
    `(?:from\\s+|import\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)["']${moduleName}["']`,
  );
}

describe("AppIcon source boundary", () => {
  it("keeps MaterialCommunityIcons exclusively inside the AppIcon boundary", () => {
    const directMaterialCommunityImports = findFiles(
      moduleImportPattern(MATERIAL_COMMUNITY_MODULE),
    );

    expect(directMaterialCommunityImports).toEqual([APP_ICON_BOUNDARY]);
  });

  it("keeps direct MorphIcon imports inside the AppIcon boundary", () => {
    const directMorphIconImports = findFiles(
      moduleImportPattern(MORPHICONS_MODULE),
    );

    expect(directMorphIconImports).toEqual([APP_ICON_BOUNDARY]);
  });

  it("does not use namespace or deep Lucide imports", () => {
    const namespaceLucideImports = findFiles(
      /import\s+\*\s+as\s+\w+\s+from\s+["']lucide["']/,
    );
    const deepLucideImports = findFiles(
      /(?:from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)["']lucide\//,
    );

    expect(namespaceLucideImports).toEqual([]);
    expect(deepLucideImports).toEqual([]);
  });
});

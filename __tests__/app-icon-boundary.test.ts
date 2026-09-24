import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_ROOTS = ["app", "components", "features", "hooks"] as const;
const APP_ICON_BOUNDARY = "components/ui/AppIcon.tsx";
const APP_ICON_DATA_BOUNDARY = "components/ui/app-icon-lucide.ts";
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
  it("does not ship the legacy MaterialCommunityIcons runtime", () => {
    const directMaterialCommunityImports = findFiles(
      moduleImportPattern(MATERIAL_COMMUNITY_MODULE),
    );

    expect(directMaterialCommunityImports).toEqual([]);
  });

  it("keeps direct MorphIcon imports inside the AppIcon boundary", () => {
    const directMorphIconImports = findFiles(
      moduleImportPattern(MORPHICONS_MODULE),
    );

    expect(directMorphIconImports).toEqual([APP_ICON_BOUNDARY]);
  });

  it("keeps runtime Lucide imports tree-shakeable and isolated", () => {
    const namespaceLucideImports = findFiles(
      /import\s+\*\s+as\s+\w+\s+from\s+["']lucide["']/,
    );
    const runtimeBarrelImports = findFiles(
      /(?:^|\n)\s*import\s+(?!type\s)[^;]*?\sfrom\s+["']lucide["']|(?:require\s*\(\s*|import\s*\(\s*)["']lucide["']/,
    );
    const deepLucideImports = findFiles(
      /(?:from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)["']lucide\//,
    );

    expect(namespaceLucideImports).toEqual([]);
    expect(runtimeBarrelImports).toEqual([]);
    expect(deepLucideImports).toEqual([APP_ICON_DATA_BOUNDARY]);
  });

  it("does not retain unused vendor glyph names in application source", () => {
    expect(
      findFiles(/["'](?:target-account|sword-cross|speedometer)["']/),
    ).toEqual([]);
  });
});

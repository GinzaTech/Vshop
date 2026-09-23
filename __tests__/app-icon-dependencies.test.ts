import packageJson from "~/package.json";

describe("AppIcon runtime dependencies", () => {
  it("pins the Morphicons native stack approved by the design", () => {
    expect(packageJson.dependencies).toMatchObject({
      morphicons: "1.7.1",
      lucide: "1.47.0",
      "react-native-svg": "15.15.4",
    });
    expect(() => require.resolve("morphicons/react-native")).not.toThrow();
    expect(() => require.resolve("lucide")).not.toThrow();
    expect(() => require.resolve("react-native-svg")).not.toThrow();
  });
});

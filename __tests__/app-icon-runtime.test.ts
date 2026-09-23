import { Search } from "lucide";
import { MorphIcon } from "morphicons/react-native";

it("resolves ESM package exports through Jest like Metro", () => {
  expect(Search).toBeDefined();
  expect(MorphIcon).toBeDefined();
});

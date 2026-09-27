import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Android primary-tab performance harness", () => {
  const readHarness = () =>
    readFileSync(
      join(process.cwd(), "scripts", "measure-android-primary-tabs.ps1"),
      "utf8",
    );

  it("passes switch-like adb arguments through array splatting", () => {
    const script = readHarness();

    expect(script).not.toMatch(
      /Invoke-PinnedAdb[^\r\n]*\s-(?:W|s|d|v|n)(?:\s|=)/,
    );
    expect(script).toContain("Invoke-PinnedAdb @startArguments");
    expect(script).toContain("Invoke-PinnedAdb @pidArguments");
    expect(script).toContain("Invoke-PinnedAdb @logcatArguments");
  });

  it("uses the active override display size before the physical panel size", () => {
    const script = readHarness();

    expect(script).toContain("$overrideSizeMatch = [regex]::Match");
    expect(script).toContain("$physicalSizeMatch = [regex]::Match");
    expect(script).toContain(
      "$resolvedSizeMatch = if ($overrideSizeMatch.Success)",
    );
    expect(script).not.toContain('"(?:Override|Physical) size:');
  });

  it("does not mix progress text into measurement objects", () => {
    const script = readHarness();

    expect(script).toContain('Write-Host ("{0}->{1} run {2}');
    expect(script).not.toContain('Write-Output ("{0}->{1} run {2}');
  });

  it("rejects samples that rendered no frames", () => {
    const script = readHarness();

    expect(script).toContain("if ($result.totalFrames -le 0)");
    expect(script).toContain('throw "No frames were rendered for');
  });

  it("records memory after each warm navigation cycle", () => {
    const script = readHarness();

    expect(script).toContain("$preMeasurementMemory = Read-Memory");
    expect(script).toContain("$postMeasurementMemory = Read-Memory");
    expect(script).toContain(
      "$memoryCycles = [Collections.Generic.List[object]]::new()",
    );
    expect(script).toContain("$memoryCycles.Add");
    expect(script).toContain("cycles = $memoryCycles");
    expect(script).toContain("pssDeltaKb = $afterMemory.pssKb - $beforeMemory.pssKb");
  });
});

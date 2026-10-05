import { MORE_GLASS_SCENE_SHADER } from "../more-glass/more-glass-scene-shader";

// The material math is the exact More shader; only visible capacity and clips differ.
export const REFRACTIVE_GLASS_SHADER = MORE_GLASS_SCENE_SHADER
  .replace("cards[14]", "cards[32]")
  .replace("uniform float cornerRadius;", `uniform float4 clips[32];
uniform float4 roundedClips[96];
uniform float4 clipRadii[32];
uniform float cardCount;
uniform float cornerRadius;`)
  .replace("i < 14", "i < 32")
  .replace("    float4 box = cards[i];", `    if (float(i) >= cardCount) break;
    float4 mask = clips[i];
    if (p.x < mask.x || p.y < mask.y || p.x > mask.x + mask.z || p.y > mask.y + mask.w) continue;
    bool clipped = false;
    for (int j = 0; j < 3; j++) {
      float4 parent = roundedClips[i * 3 + j];
      if (clipRadii[i][j] > 0.0) {
        float r = min(clipRadii[i][j], min(parent.z, parent.w) * 0.5);
        float2 pc = p - parent.xy - parent.zw * 0.5;
        float2 pq = abs(pc) - parent.zw * 0.5 + r;
        float pd = length(max(pq, float2(0.0))) + min(max(pq.x, pq.y), 0.0) - r;
        if (pd > 0.0) clipped = true;
      }
    }
    if (clipped) continue;
    float4 box = cards[i];`);

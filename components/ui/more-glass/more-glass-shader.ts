/** Samples the same continuous silver plane at bent coordinates inside each lens.
 * All coordinates are measured grid-local DIP; glyphs are separate native views.
 * No time uniform: the renderer paints only when geometry/material changes.
 */
export const MORE_GLASS_SHADER = `
uniform float2 resolution;
uniform float4 cards[10];
uniform float3 baseColor;
uniform float3 silverColor;
uniform float cornerRadius;
uniform float whiteVeil;
uniform float refraction;
uniform float bevelWidth;
uniform float zoom;

float3 field(float2 p) {
  float2 uv = p / resolution;
  float phase = uv.y * 8.0 - uv.x * 3.8 + 0.35 * sin(uv.x * 6.0 + uv.y * 1.5);
  float wave = sin(phase);
  float ribbon = wave * 0.5 + 0.5;
  float highlight = exp(-wave * wave * 36.0);
  float shoulder = exp(-pow((wave - 0.35) * 5.0, 2.0));
  float side = exp(-pow((uv.x - 0.76 + 0.16 * sin(uv.y * 5.0)) * 4.0, 2.0));
  float shade = 0.05 + 0.10 * ribbon + 0.04 * side + 0.10 * shoulder;
  float3 color = mix(baseColor, silverColor, clamp(shade, 0.0, 0.30));
  color = mix(color, float3(1.0), highlight * 0.45);
  float edge = min(min(p.x, resolution.x - p.x), min(p.y, resolution.y - p.y));
  return mix(baseColor, color, smoothstep(0.0, 24.0, edge));
}

half4 main(float2 p) {
  float3 backing = field(p);
  for (int i = 0; i < 10; i++) {
    float4 rect = cards[i];
    if (rect.z <= 0.0 || rect.w <= 0.0) continue;
    float2 center = rect.xy + rect.zw * 0.5;
    float2 local = p - center;
    if (abs(local.x) > rect.z * 0.5 + 1.0 || abs(local.y) > rect.w * 0.5 + 1.0) continue;
    float radius = min(cornerRadius, min(rect.z, rect.w) * 0.5);
    float2 q = abs(local) - rect.zw * 0.5 + radius;
    float2 outside = max(q, float2(0.0));
    float distance = length(outside) + min(max(q.x, q.y), 0.0) - radius;
    if (distance > 0.8) continue;
    float2 normal = length(outside) > 0.001
      ? normalize(outside) * sign(local)
      : (q.x > q.y ? float2(sign(local.x), 0.0) : float2(0.0, sign(local.y)));
    float bend = pow(1.0 - clamp(-distance / bevelWidth, 0.0, 1.0), 2.0);
    float2 sampleAt = center + local / zoom - normal * bend * refraction;
    // A five-tap soft transmission keeps the silver ribbon visible through glass.
    float3 transmission = field(sampleAt) * 0.52;
    transmission += (field(sampleAt + float2(2.0, 0.0)) + field(sampleAt - float2(2.0, 0.0))
      + field(sampleAt + float2(0.0, 2.0)) + field(sampleAt - float2(0.0, 2.0))) * 0.12;
    float3 lens = mix(transmission, float3(1.0), whiteVeil);
    float facing = dot(normal, normalize(float2(-0.6, -0.8)));
    float underside = smoothstep(-2.2, -0.3, distance) * max(-facing, 0.0) * 0.10;
    lens = mix(lens, silverColor, underside);
    float rim = smoothstep(-2.4, -0.15, distance);
    lens = mix(lens, float3(1.0), rim * (0.22 + 0.68 * max(facing, 0.0)));
    float diagonal = local.x / rect.z + local.y / rect.w;
    float sheen = exp(-pow((diagonal + 0.36) * 5.0, 2.0)) * 0.10;
    lens = mix(lens, float3(1.0), sheen);
    return half4(mix(backing, lens, 1.0 - smoothstep(-0.3, 0.8, distance)), 1.0);
  }
  return half4(backing, 1.0);
}
`;

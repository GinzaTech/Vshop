/** Lenses sample the generated wallpaper at refracted coordinates. No content capture. */
export const MORE_GLASS_SCENE_SHADER = `
uniform shader wallpaper;
uniform float2 resolution;
uniform float4 cards[14];
uniform float cornerRadius;
uniform float refraction;
uniform float bevelWidth;
uniform float zoom;
uniform float whiteVeil;
uniform float wallpaperStrength;
uniform float3 silverColor;
uniform float3 pageColor;
float3 field(float2 p) {
  float2 sampleAt = clamp(p, float2(0.5), resolution - float2(0.5));
  half4 image = wallpaper.eval(sampleAt);
  float3 pageBacking = image.rgb + pageColor * (1.0 - image.a);
  return mix(pageColor, pageBacking, wallpaperStrength);
}
half4 main(float2 p) {
  float3 backing = field(p);
  for (int i = 0; i < 14; i++) {
    float4 box = cards[i];
    if (box.z <= 0.0 || box.w <= 0.0) continue;
    float2 center = box.xy + box.zw * 0.5;
    float2 local = p - center;
    if (abs(local.x) > box.z * 0.5 + 1.0 || abs(local.y) > box.w * 0.5 + 1.0) continue;
    float radius = min(cornerRadius, min(box.z, box.w) * 0.5);
    float2 q = abs(local) - box.zw * 0.5 + radius;
    float2 outside = max(q, float2(0.0));
    float distance = length(outside) + min(max(q.x, q.y), 0.0) - radius;
    if (distance > 0.8) continue;
    float2 normal = length(outside) > 0.001 ? normalize(outside) * sign(local)
      : (q.x > q.y ? float2(sign(local.x), 0.0) : float2(0.0, sign(local.y)));
    float bend = pow(1.0 - clamp(-distance / bevelWidth, 0.0, 1.0), 2.0);
    float2 sampleAt = center + local / zoom - normal * bend * refraction;
    float3 transmission = field(sampleAt) * 0.52;
    transmission += (field(sampleAt + float2(2.0, 0.0)) + field(sampleAt - float2(2.0, 0.0))
      + field(sampleAt + float2(0.0, 2.0)) + field(sampleAt - float2(0.0, 2.0))) * 0.12;
    float3 lens = mix(transmission, float3(1.0), whiteVeil);
    float facing = dot(normal, normalize(float2(-0.6, -0.8)));
    lens = mix(lens, silverColor, smoothstep(-2.2, -0.3, distance) * max(-facing, 0.0) * 0.10);
    lens = mix(lens, float3(1.0), smoothstep(-2.4, -0.15, distance) * (0.22 + 0.68 * max(facing, 0.0)));
    float diagonal = local.x / box.z + local.y / box.w;
    lens = mix(lens, float3(1.0), exp(-pow((diagonal + 0.36) * 5.0, 2.0)) * 0.10);
    return half4(mix(backing, lens, 1.0 - smoothstep(-0.3, 0.8, distance)), 1.0);
  }
  return half4(backing, 1.0);
}
`;

var P=`#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`,O=`#version 300 es
in vec2 aPos;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uPad;
out vec2 vUV;
void main() {
  vec2 half2 = uHalf + uPad;
  vec2 px = uCenter + (aPos * 2.0 - 1.0) * half2;
  vUV = px / uRes;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}`,Y=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 outColor;
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             12.92 * c,
             lessThanEqual(c, vec3(0.0031308)));
}
void main() { outColor = vec4(linearToSrgb(texture(uTex, vUV).rgb), 1.0); }`,j=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;   // texel size of the SOURCE level
out vec4 outColor;
void main() {
  vec2 t = uTexel;
  vec4 a = texture(uTex, vUV) * 0.125;
  vec4 b = (texture(uTex, vUV + vec2(-t.x, -t.y)) +
            texture(uTex, vUV + vec2( t.x, -t.y)) +
            texture(uTex, vUV + vec2(-t.x,  t.y)) +
            texture(uTex, vUV + vec2( t.x,  t.y))) * 0.125;
  vec4 c = (texture(uTex, vUV + vec2(-2.0 * t.x, 0.0)) +
            texture(uTex, vUV + vec2( 2.0 * t.x, 0.0)) +
            texture(uTex, vUV + vec2(0.0, -2.0 * t.y)) +
            texture(uTex, vUV + vec2(0.0,  2.0 * t.y))) * 0.0625;
  vec4 d = (texture(uTex, vUV + vec2(-2.0 * t.x, -2.0 * t.y)) +
            texture(uTex, vUV + vec2( 2.0 * t.x, -2.0 * t.y)) +
            texture(uTex, vUV + vec2(-2.0 * t.x,  2.0 * t.y)) +
            texture(uTex, vUV + vec2( 2.0 * t.x,  2.0 * t.y))) * 0.03125;
  // RGB stores radiance. Alpha stores normalized optical density, so the mip
  // chain can blur both representations with exactly the same footprint.
  outColor = a + b + c + d;
}`,$=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uLow;
uniform sampler2D uHigh;
uniform vec2 uLowTexel;
out vec4 outColor;
void main() {
  vec2 t = uLowTexel;
  vec4 low = texture(uLow, vUV) * 4.0;
  low += (texture(uLow, vUV + vec2( t.x, 0.0)) +
          texture(uLow, vUV + vec2(-t.x, 0.0)) +
          texture(uLow, vUV + vec2(0.0,  t.y)) +
          texture(uLow, vUV + vec2(0.0, -t.y))) * 2.0;
  low += texture(uLow, vUV + vec2( t.x,  t.y)) +
         texture(uLow, vUV + vec2(-t.x,  t.y)) +
         texture(uLow, vUV + vec2( t.x, -t.y)) +
         texture(uLow, vUV + vec2(-t.x, -t.y));
  low *= 1.0 / 16.0;
  vec4 high = texture(uHigh, vUV);
  outColor = mix(high, low, 0.65);
}`,Q=`#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uRes;
uniform int uScene;
uniform float uZoom;
uniform sampler2D uWallpaper;
uniform int uUseImage;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 srgbToLinear(vec3 c) {
  bvec3 cutoff = lessThanEqual(c, vec3(0.04045));
  vec3 low = c / 12.92;
  vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, cutoff);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; }
  return s;
}
// distance to a quadratic bezier (iterative, good enough for a backdrop)
float sdBezier(vec2 p, vec2 a, vec2 b, vec2 c) {
  float best = 1e9;
  vec2 prev = a;
  for (int i = 1; i <= 40; i++) {
    float t = float(i) / 40.0;
    vec2 q = mix(mix(a, b, t), mix(b, c, t), t);
    vec2 pa = p - prev, ba = q - prev;
    float u = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    best = min(best, length(pa - ba * u));
    prev = q;
  }
  return best;
}

vec3 sunsetBranches(vec2 uv) {
  // dusk gradient: cool grey-mauve at the top, warm amber near the horizon
  vec3 top = vec3(0.62, 0.55, 0.55);
  vec3 mid = vec3(0.85, 0.63, 0.53);
  vec3 low = vec3(0.94, 0.70, 0.52);
  vec3 col = mix(mid, top, smoothstep(0.45, 1.0, uv.y));
  col = mix(col, low, smoothstep(0.45, 0.0, uv.y));
  col += (fbm(uv * 3.0) - 0.5) * 0.05;

  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  float sc = uRes.x / uRes.y;
  vec3 bark = vec3(0.17, 0.10, 0.09);
  // main trunk + a few branches, thick and dark like the reference photo
  float d = sdBezier(p, vec2(0.42 * sc, -0.1), vec2(0.52 * sc, 0.45), vec2(0.36 * sc, 1.1));
  float m = smoothstep(0.060, 0.040, d);
  d = sdBezier(p, vec2(0.40 * sc, 0.30), vec2(0.62 * sc, 0.44), vec2(0.95 * sc, 0.26));
  m = max(m, smoothstep(0.034, 0.020, d));
  d = sdBezier(p, vec2(0.44 * sc, 0.62), vec2(0.25 * sc, 0.80), vec2(0.05 * sc, 0.72));
  m = max(m, smoothstep(0.022, 0.010, d));
  d = sdBezier(p, vec2(0.46 * sc, 0.80), vec2(0.72 * sc, 0.95), vec2(1.05 * sc, 0.78));
  m = max(m, smoothstep(0.016, 0.007, d));
  d = sdBezier(p, vec2(0.12 * sc, -0.05), vec2(0.18 * sc, 0.5), vec2(0.06 * sc, 1.05));
  m = max(m, smoothstep(0.038, 0.022, d));
  // seed pods
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2((0.14 + 0.02 * fi) * sc, 0.30 + 0.26 * fi);
    m = max(m, smoothstep(0.035, 0.022, length((p - c) * vec2(1.0, 0.8))));
  }
  return mix(col, bark, m * 0.94);
}

vec3 deepBlueCity(vec2 uv) {
  vec3 col = mix(vec3(0.06, 0.14, 0.55), vec3(0.02, 0.06, 0.34), smoothstep(0.0, 1.0, uv.y));
  col += (fbm(uv * vec2(90.0, 90.0)) - 0.5) * 0.05;   // fabric-like dither
  // bright vertical tower strip
  float x = abs(uv.x - 0.5);
  float tower = smoothstep(0.035, 0.012, x) * smoothstep(0.02, 0.25, uv.y);
  col = mix(col, vec3(0.72, 0.58, 0.52), tower * 0.85);
  float glow = smoothstep(0.16, 0.0, x) * smoothstep(0.0, 0.5, uv.y) * 0.18;
  col += vec3(0.5, 0.42, 0.36) * glow;
  col = mix(col, vec3(0.10, 0.14, 0.26), smoothstep(0.16, 0.02, uv.y));
  return col;
}

vec3 islandOcean(vec2 uv) {
  float ar = uRes.x / uRes.y;
  vec3 deep = vec3(0.03, 0.26, 0.52);
  vec3 shallow = vec3(0.20, 0.74, 0.82);
  float waves = fbm(vec2(uv.x * ar * 6.0, uv.y * 22.0) + 3.0);
  vec3 col = mix(deep, shallow, smoothstep(0.30, 0.78, waves * 0.7 + uv.y * 0.5));

  vec2 p = (uv - vec2(0.5, 0.40)) * vec2(ar, 1.0);
  float isl = (fbm(p * 2.2 + 11.0) - 0.5) * 0.34;
  float d = length(p * vec2(0.62, 1.25)) - (0.42 + isl);
  // shallow reef ring around the land
  col = mix(col, vec3(0.42, 0.86, 0.86), smoothstep(0.14, 0.03, d) * 0.75);
  col = mix(col, vec3(0.94, 0.90, 0.72), smoothstep(0.035, 0.0, d));        // beach
  vec3 jungle = mix(vec3(0.04, 0.26, 0.09), vec3(0.24, 0.55, 0.20),
                    fbm(p * 9.0 + 5.0));
  col = mix(col, jungle, smoothstep(0.005, -0.02, d));                      // jungle
  return col;
}

vec2 coverUV(vec2 uv) {
  vec2 imageSize = vec2(textureSize(uWallpaper, 0));
  float imageAspect = imageSize.x / max(imageSize.y, 1.0);
  float viewportAspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = uv;
  if (imageAspect > viewportAspect) {
    float crop = (imageAspect / viewportAspect - 1.0) * 0.5;
    p.x = p.x * (1.0 - 2.0 * crop) + crop;
  } else {
    float crop = (viewportAspect / imageAspect - 1.0) * 0.5;
    p.y = p.y * (1.0 - 2.0 * crop) + crop;
  }
  return clamp(p, vec2(0.001), vec2(0.999));
}

void main() {
  vec2 uv = (vUV - 0.5) / max(uZoom, 0.01) + 0.5;
  vec3 col;
  if (uUseImage == 1) {
    // Wallpaper textures are plain RGBA8 holding display/sRGB values; decode
    // to linear radiance here. They are uploaded top row first (no
    // UNPACK_FLIP_Y_WEBGL), so the lookup flips instead.
    vec2 wallpaperUV = coverUV(uv);
    wallpaperUV.y = 1.0 - wallpaperUV.y;
    col = srgbToLinear(texture(uWallpaper, wallpaperUV).rgb);
  } else {
    // Procedural palette constants are authored as display/sRGB colours. The
    // SRGB render target expects linear shader output and encodes it on write.
    col = srgbToLinear(uScene == 0 ? sunsetBranches(uv)
                       : uScene == 1 ? deepBlueCity(uv)
                                     : islandOcean(uv));
  }
  // Beer-Lambert representation of backdrop darkness. A value of 4 optical
  // density units already corresponds to ~1.8% transmission, enough for the
  // near-black branches while retaining useful precision in RGBA8.
  float lum = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.018);
  float density = clamp(-log(lum) / 4.0, 0.0, 1.0);
  outColor = vec4(col, density);
}`,K=`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;      // blurred mip chain of the backdrop
uniform sampler2D uBlurSrc;  // tent-upsampled reconstruction chain
uniform vec2  uRes;
uniform vec2  uCenter;       // draw-group bounds centre, px (vertex quad only)
uniform vec2  uHalf;         // element half size, px
const int MAX_SHAPES = 16;
uniform int   uShapeCount;
uniform vec2  uShapeCenters[MAX_SHAPES];
uniform vec2  uShapeHalves[MAX_SHAPES];
uniform int   uShapeTypes[MAX_SHAPES]; // 0 square/rect, 1 capsule, 2 circle
uniform float uShapeRadii[MAX_SHAPES];
uniform float uMergeRadius;  // smooth-union reach, px
uniform float uSquircle;     // superellipse exponent (2 = circular corners)
uniform float uBevel;        // max width of the refracting rim, px
uniform float uHeight;       // max glass height / optical thickness, px
uniform float uSizeAdaptation;// 0 = absolute material lengths, 1 = fit small UI
uniform float uIOR;
uniform float uDispersion;
uniform float uBlurPlateau;  // blur radius in the middle, px
uniform float uBlurRim;      // blur radius at the rim, px
uniform float uOpticalDensity;// dark-detail preservation; 0 = linear radiance
uniform float uMips;         // number of levels in the blurred chain
uniform float uSpecular;
uniform float uSpecPower;
uniform float uHighlightAdapt;
uniform float uHighlightWidth;
uniform float uHighlightSharpness;
uniform float uHighlightBase;
uniform float uFresnel;
uniform float uSat;
uniform float uBright;
uniform float uTintAmount;
uniform vec3  uTintColor;
uniform float uTintAdapt;    // content-aware light/dark material polarity
uniform float uShadow;
uniform float uShadowSize;
uniform float uShadowOffset;
uniform vec2  uLightDir;
uniform float uEdgeLine;
uniform float uEdgeWidth;
uniform float uEdgeDark;
uniform float uRefractScale;
uniform float uMeniscus;     // 1 = concave meniscus rim, 0 = convex lens rim
uniform int   uDebug;        // 0 final, 1 thickness, 2 normals, 3 displacement

float sdSquircle(vec2 p, vec2 b, float r, float n) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0) + 1e-5;
  float e = pow(pow(m.x, n) + pow(m.y, n), 1.0 / n);
  return min(max(q.x, q.y), 0.0) + e - r;
}

float sdPrimitive(vec2 p, vec2 halfSize, int shapeType, float radius) {
  if (shapeType == 2) {
    // Circle is invariant: layout cannot turn it into an ellipse.
    return length(p) - min(halfSize.x, halfSize.y);
  }
  if (shapeType == 1) {
    // Apple's capsule rule: end-cap radius is exactly half the short side.
    return sdSquircle(p, halfSize, min(halfSize.x, halfSize.y), 2.0);
  }
  // Square and rectangular folders share the same fixed-radius corner model;
  // only their bounding boxes differ. The default exponent is 2 per reference.
  return sdSquircle(p, halfSize, radius, max(uSquircle, 2.0));
}

// One distance field represents the complete component group. Because the
// normal is derived from this same field below, the meniscus, refraction and
// highlight bend continuously through the bridge instead of exposing two
// composited glass layers.
float sdAppleShape(vec2 px) {
  float nearest = 1e8;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    nearest = min(nearest, next);
  }

  if (uMergeRadius < 0.01) return nearest;

  // Global exponential smooth-min is associative and C-infinity. Pairwise
  // polynomial unions are only C1 and become order-dependent with 3+ shapes;
  // their curvature boundaries show up as diagonal tears under sharp glass
  // highlights. 0.36 matches the polynomial union's depth at equal distances.
  float scale = max(uMergeRadius * 0.36, 0.01);
  float sum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    sum += exp(-(next - nearest) / scale);
  }
  return nearest - scale * log(max(sum, 1e-6));
}

// Quintic tangent transition. Besides value and slope, its second derivative
// matches at both ends: f(0/1)=0/1, f'(0/1)=0/1, f''(0/1)=0. This lets a
// circular corner leave a straight side with zero curvature instead of the
// rounded-box SDF's abrupt 0 -> 1/r curvature jump.
float tangentTransition(float u) {
  return u * u * u * (6.0 - 8.0 * u + 3.0 * u * u);
}

vec2 primitiveOpticalGradient(vec2 p, vec2 halfSize,
                              int shapeType, float radius) {
  if (shapeType == 2) return normalize(p + 1e-6);

  float exponent = shapeType == 1 ? 2.0 : max(uSquircle, 2.0);
  float resolvedRadius = shapeType == 1
                       ? min(halfSize.x, halfSize.y) : radius;
  vec2 q = abs(p) - halfSize + resolvedRadius;
  vec2 direction;

  if (q.x > 0.0 && q.y > 0.0) {
    // Analytic Lp-corner normal. Exponents above 2 already approach the side
    // with zero curvature; blend out the circular-corner correction by n=3.
    vec2 lp = normalize(pow(q, vec2(exponent - 1.0)) + 1e-6);
    const float HALF_PI = 1.57079632679;
    const float TRANSITION_ANGLE = 0.43633231299; // 25 degrees at each tangent
    float angle = atan(q.y, q.x);
    float easedAngle = angle;
    if (angle < TRANSITION_ANGLE) {
      easedAngle = TRANSITION_ANGLE *
                   tangentTransition(angle / TRANSITION_ANGLE);
    } else if (angle > HALF_PI - TRANSITION_ANGLE) {
      float fromTop = (HALF_PI - angle) / TRANSITION_ANGLE;
      easedAngle = HALF_PI - TRANSITION_ANGLE *
                   tangentTransition(fromTop);
    }
    vec2 continuousCorner = vec2(cos(easedAngle), sin(easedAngle));
    float circularCorner = 1.0 - smoothstep(2.0, 3.0, exponent);
    direction = normalize(mix(lp, continuousCorner, circularCorner));
  } else if (q.x > q.y) {
    direction = vec2(1.0, 0.0);
  } else {
    direction = vec2(0.0, 1.0);
  }

  return direction * sign(p);
}

vec2 opticalGradient(vec2 px) {
  float nearest = 1e8;
  int nearestIndex = 0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    if (next < nearest) {
      nearest = next;
      nearestIndex = i;
    }
  }

  if (uMergeRadius < 0.01 || uShapeCount == 1) {
    return primitiveOpticalGradient(
      px - uShapeCenters[nearestIndex], uShapeHalves[nearestIndex],
      uShapeTypes[nearestIndex], uShapeRadii[nearestIndex]
    );
  }

  // The derivative of exponential smooth-min is the same weighted average of
  // the primitive derivatives. Reusing those weights keeps fused normals C2
  // through both a primitive's tangent and the union bridge.
  float scale = max(uMergeRadius * 0.36, 0.01);
  vec2 gradientSum = vec2(0.0);
  float weightSum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    vec2 local = px - uShapeCenters[i];
    float next = sdPrimitive(local, uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    float weight = exp(-(next - nearest) / scale);
    gradientSum += primitiveOpticalGradient(
      local, uShapeHalves[i], uShapeTypes[i], uShapeRadii[i]
    ) * weight;
    weightSum += weight;
  }
  return gradientSum / max(weightSum, 1e-6);
}

// Shading adaptation belongs to the primitive under this fragment, not to the
// bounds of the whole draw group. The latter changes whenever any component in
// a connected fusion group moves, making every highlight pulse in sympathy.
//
// Around a genuine smooth-union bridge, use the same exponential influence as
// the distance field so the material centre crosses continuously from one
// primitive to the next. Contributions too weak to affect the visible bridge
// are smoothly discarded; a nearby-but-separate component then has exactly no
// influence on this component's highlight or light/dark tint.
void localComponentMetrics(vec2 px, out vec2 componentCenter,
                           out float componentShortSide) {
  float nearest = 1e8;
  vec2 nearestCenter = uShapeCenters[0];
  float nearestShortSide = 1.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    if (next < nearest) {
      nearest = next;
      nearestCenter = uShapeCenters[i];
      nearestShortSide = 2.0 * min(uShapeHalves[i].x, uShapeHalves[i].y);
    }
  }

  componentCenter = nearestCenter;
  componentShortSide = nearestShortSide;
  if (uMergeRadius < 0.01 || uShapeCount == 1) return;

  float scale = max(uMergeRadius * 0.36, 0.01);
  vec2 centreSum = vec2(0.0);
  float shortSideSum = 0.0;
  float weightSum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    float weight = exp(-(next - nearest) / scale);
    weight *= smoothstep(0.04, 0.20, weight);
    centreSum += uShapeCenters[i] * weight;
    shortSideSum += 2.0 * min(uShapeHalves[i].x, uShapeHalves[i].y) * weight;
    weightSum += weight;
  }
  if (weightSum > 0.0) {
    componentCenter = centreSum / weightSum;
    componentShortSide = shortSideSum / weightSum;
  }
}

vec4 sampleBg(vec2 px, float lod) {
  vec2 uv = clamp(px / uRes, vec2(0.001), vec2(0.999));
  return textureLod(uSrc, uv, lod);
}

vec4 sampleReconstructedBg(vec2 px, float lod) {
  vec2 uv = clamp(px / uRes, vec2(0.001), vec2(0.999));
  return textureLod(uBlurSrc, uv, lod);
}

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             12.92 * c,
             lessThanEqual(c, vec3(0.0031308)));
}

vec2 softLimitOffset(vec2 offset, float limit) {
  float magnitude = length(offset);
  if (magnitude < 1e-4) return offset;
  float limited = tanh(magnitude / max(limit, 1.0)) * limit;
  return offset * (limited / magnitude);
}

// Variable-radius blur, radius in device px.
//
// A single textureLod() tap on the mip chain is not enough. The chain only
// offers radii in powers of two, and on the top levels one texel is tens of
// pixels wide, so a lone bilinear tap (a) averages in a huge slab of the
// screen, which drags the colour toward the frame mean -> washed out, and
// (b) reconstructs as a handful of big diamonds -> the "too few samples" mush.
// Instead take the level whose own radius is about a third of what we want and
// spread TAPS samples over the remainder on a golden-angle spiral. Neighbouring
// taps then land roughly one texel apart at that level, which is exactly the
// spacing at which the level's own filtering makes the disc continuous, so the
// result is a real wide Gaussian that keeps its local colour.
const int TAPS = 12;
const float GOLDEN_ANGLE = 2.39996323;

vec3 blurBg(vec2 px, float radius) {
  if (radius < 1.0) return sampleBg(px, 0.0).rgb;
  float lod = clamp(log2(radius) - 1.585, 0.0, uMips - 1.0);   // 2^lod ~ r/3
  vec3 acc = vec3(0.0);
  float densityAcc = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r  = sqrt(fi / float(TAPS));       // equal-area spacing over the disc
    float a  = fi * GOLDEN_ANGLE;
    float w  = exp(-1.8 * r * r);
    vec2 samplePx = px + vec2(cos(a), sin(a)) * r * radius;
    // Keep narrow blur faithful to the original downsample chain, then lean on
    // the reconstructed chain where coarse mip blocks and temporal breathing
    // become visible. Both samplers return linear radiance from sRGB textures.
    float reconstruction = 0.78 * smoothstep(10.0, 52.0, radius);
    vec4 s = mix(sampleBg(samplePx, lod),
                 sampleReconstructedBg(samplePx, lod), reconstruction);
    acc += s.rgb * w;
    densityAcc += s.a * w;
    wsum += w;
  }
  vec3 linearCol = acc / wsum;

  // A pure radiance average spreads a dark branch but also dilutes it toward
  // the pale sky. The density channel averages -log(luminance), equivalent to
  // geometrically averaging transmission. That preserves the visual weight of
  // dark occluders while keeping uniform light regions unchanged. We retain
  // the linear RGB hue and only restore the missing luminance contrast.
  float linearLum = max(dot(linearCol, vec3(0.2126, 0.7152, 0.0722)), 0.001);
  float densityLum = exp(-4.0 * densityAcc / wsum);
  float densityGap = max(linearLum - densityLum, 0.0);
  float radiusGate = smoothstep(1.0, 8.0, radius);
  float targetLum = max(linearLum * 0.22,
                        linearLum - densityGap * uOpticalDensity * radiusGate);
  return linearCol * (targetLum / linearLum);
}

void main() {
  vec2 px = vUV * uRes;

  float d = sdAppleShape(px);
  float aa = smoothstep(0.8, -0.8, d);
  vec2 adaptCenter;
  float localShortSide;
  localComponentMetrics(px, adaptCenter, localShortSide);
  // Material lengths are authored against the large demo components. Treat
  // them as maxima and fit the complete optical system to 30% of a smaller
  // primitive's short side. The shared metric call above also keeps this scale
  // continuous when differently sized primitives form one fused surface.
  float fittedScale = clamp(0.30 * localShortSide / max(uBevel, 1.0), 0.05, 1.0);
  float opticalScale = mix(1.0, fittedScale,
                           clamp(uSizeAdaptation, 0.0, 1.0));
  float bevel = max(uBevel * opticalScale, 1.0);
  float opticalHeight = uHeight * opticalScale;

  // ---- gradient of the SDF = outward direction of the surface -------------
  vec2 g = normalize(opticalGradient(px) + 1e-6);

  // ---- thickness field / bevel profile -----------------------------------
  float t  = clamp(-d / bevel, 0.0, 1.0);    // 0 at the edge, 1 on the plateau
  float ct = 1.0 - t;
  float h  = sqrt(max(1.0 - ct * ct, 0.0));  // convex (circular) bevel
  float dhdt = ct / max(h, 0.10);            // slope, clamped at the silhouette
  float slope = (opticalHeight / bevel) * dhdt;

  // 0 = convex lens, 1 = the default Apple-like concave rim. Values above 1
  // deliberately exaggerate the inward normal for exploratory tuning.
  float curveSign = 1.0 - 2.0 * uMeniscus;
  vec3 n = normalize(vec3(curveSign * g * slope, 1.0));
  vec3 I = vec3(0.0, 0.0, -1.0);

  // ---- refraction (Snell) + dispersion -----------------------------------
  float path = opticalHeight * mix(0.25, 1.0, h) * uRefractScale;
  vec2 dR, dG, dB;
  {
    float e = 1.0 / max(uIOR - uDispersion, 1.0);
    vec3 R = refract(I, n, e);
    dR = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
    e = 1.0 / max(uIOR, 1.0);
    R = refract(I, n, e);
    dG = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
    e = 1.0 / max(uIOR + uDispersion, 1.0);
    R = refract(I, n, e);
    dB = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
  }

  // Strong concave meniscus normals can make the screen-space mapping fold
  // over itself at multi-shape junctions. On hard-edged wallpapers that reads
  // as triangular tearing rather than refraction. Compress only the extreme
  // tail; ordinary offsets remain almost linear while caustic spikes stay
  // within a bevel-sized optical footprint.
  float maxDisplacement = max(1.15 * bevel, max(12.0 * opticalScale, 3.0));
  dR = softLimitOffset(dR, maxDisplacement);
  dG = softLimitOffset(dG, maxDisplacement);
  dB = softLimitOffset(dB, maxDisplacement);

  // ---- scattering: rim stays readable, plateau is frosted ----------------
  float radius = mix(uBlurRim, uBlurPlateau, smoothstep(0.0, 0.85, t))
               * opticalScale;

  vec3 col;
  col.r = blurBg(px + dR, radius).r;
  col.g = blurBg(px + dG, radius).g;
  col.b = blurBg(px + dB, radius).b;

  // Saturation is boosted on the TRANSMITTED backdrop only (this is what
  // UIVisualEffectView's saturationDeltaFactor does). Any wide blur averages
  // colours toward grey; without this the frosted panel reads pale even though
  // the wallpaper behind it is saturated. Doing it before the reflections keeps
  // the specular/Fresnel highlights neutral.
  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat);

  // ---- reflection: backdrop environment + narrow specular lobes -----------
  // Schlick: F0 for glass is ~4%, and the (1-cos)^5 falloff keeps the mirror
  // term confined to the steepest part of the bevel. A softer exponent smears
  // a grey wash across the whole rim and bleaches the refracted image there.
  float fres = 0.04 + 0.96 * pow(1.0 - n.z, 5.0);
  vec2 nn = normalize(n.xy + 1e-6);

  // Keep the reflected environment local to the fragment. Stabilise the lobe
  // controls around the owning primitive below so hard wallpaper edges do not
  // chop one rim into unrelated bright and dark pieces.
  float probeLod = clamp(3.5 + log2(max(opticalScale, 0.05)),
                         0.0, uMips - 1.0);
  float probeRadius = max(1.35 * bevel, max(18.0 * opticalScale, 3.0));
  vec3 envL = sampleBg(px + vec2(-probeRadius, 0.0), probeLod).rgb;
  vec3 envR = sampleBg(px + vec2( probeRadius, 0.0), probeLod).rgb;
  vec3 envB = sampleBg(px + vec2(0.0, -probeRadius), probeLod).rgb;
  vec3 envT = sampleBg(px + vec2(0.0,  probeRadius), probeLod).rgb;
  vec2 fallbackLight = normalize(uLightDir + vec2(1e-5));
  // Highlight adaptation must be stable across one component. Driving its
  // strength and colour from each fragment's probe makes a mountain ridge or
  // tree line cut the rim into bright and dark pieces. Probe around the local
  // component centre while retaining per-fragment environment reflection.
  vec3 adaptL = sampleBg(adaptCenter + vec2(-probeRadius, 0.0), probeLod).rgb;
  vec3 adaptR = sampleBg(adaptCenter + vec2( probeRadius, 0.0), probeLod).rgb;
  vec3 adaptB = sampleBg(adaptCenter + vec2(0.0, -probeRadius), probeLod).rgb;
  vec3 adaptT = sampleBg(adaptCenter + vec2(0.0,  probeRadius), probeLod).rgb;
  vec2 adaptGradient = vec2(luminance(adaptR) - luminance(adaptL),
                            luminance(adaptT) - luminance(adaptB));
  float stableContrast = length(adaptGradient);
  float lightAdapt = clamp(uHighlightAdapt, 0.0, 1.0) *
                     smoothstep(0.025, 0.22, stableContrast);
  // Keep the lobe direction material-local. Steering it with the wallpaper
  // gradient creates a rapidly rotating direction field around hard colour
  // edges, which appears as diagonal tears and lets unrelated components alter
  // each other's highlights. The environment still adapts strength and colour.
  vec2 lightDir = fallbackLight;

  // Reflect the colour seen in the surface-normal direction. A local sample
  // keeps small bright structures (tower lights, clouds, coastlines) attached
  // to the nearby rim instead of turning every frame into the same white ring.
  float wx = clamp(0.5 + 0.5 * nn.x, 0.0, 1.0);
  float wy = clamp(0.5 + 0.5 * nn.y, 0.0, 1.0);
  vec3 envX = mix(envL, envR, wx);
  vec3 envY = mix(envB, envT, wy);
  vec3 ringEnv = (envX * abs(nn.x) + envY * abs(nn.y)) /
                 max(abs(nn.x) + abs(nn.y), 1e-3);
  float localProbeLod = clamp(2.0 + log2(max(opticalScale, 0.05)),
                              0.0, uMips - 1.0);
  vec3 localEnv = sampleBg(px + g * max(0.55 * bevel,
                                        max(6.0 * opticalScale, 2.0)),
                           localProbeLod).rgb;
  vec3 env = mix(ringEnv, localEnv, 0.58);
  float envLum = luminance(env);
  env = mix(env, vec3(envLum), 0.10); // retain wallpaper hue, tame neon spikes
  float envStrength = mix(0.58, 1.0, smoothstep(0.08, 0.75, envLum));
  col = mix(col, env, clamp(fres * uFresnel * envStrength, 0.0, 0.82));

  vec3 L1 = normalize(vec3(lightDir, 0.58));
  vec3 L2 = normalize(vec3(-lightDir, 0.48));
  float sharpness = max(uHighlightSharpness, 0.1);
  float s1 = pow(max(dot(n, L1), 0.0),
                 max(uSpecPower * sharpness, 1.0));
  float s2 = pow(max(dot(n, L2), 0.0),
                 max(uSpecPower * sharpness * 0.78, 1.0)) * 0.18;
  float highlightWidth = clamp(uHighlightWidth, 0.16, 1.0);
  float riseEnd = min(0.10, 0.25 * highlightWidth);
  float specBand = smoothstep(0.015, riseEnd, t) *
                   (1.0 - smoothstep(0.61 * highlightWidth,
                                     highlightWidth, t));
  float baseHighlight = clamp(uHighlightBase, 0.0, 1.0);
  float sourceStrength = baseHighlight + (1.0 - baseHighlight) * lightAdapt;
  vec3 sourceEnv = mix(mix(adaptL, adaptR, 0.5 + 0.5 * lightDir.x),
                       mix(adaptB, adaptT, 0.5 + 0.5 * lightDir.y), 0.5);
  float sourceLum = max(luminance(sourceEnv), 0.08);
  vec3 specColor = clamp(mix(vec3(1.0), sourceEnv / sourceLum, 0.42),
                         vec3(0.45), vec3(2.2));
  col += uSpecular * (s1 + s2) * specBand * sourceStrength * specColor;

  // Dark contour right at the silhouette: at grazing angles the rim reflects
  // the surroundings instead of transmitting, so real glass edges read dark.
  float w = max(uEdgeWidth, 0.5);
  float contour = smoothstep(w, 0.0, abs(d + 0.55 * w));
  col *= 1.0 - uEdgeDark * contour;

  // Crisp inner highlight line; direction and colour follow the local probe.
  float line = smoothstep(1.35 * w, 0.0, abs(d + 2.2 * w));
  float lit = 0.26 + 0.74 * max(dot(g, lightDir), 0.0);
  vec3 stableEnv = (adaptL + adaptR + adaptB + adaptT) * 0.25;
  float stableEnvLum = max(luminance(stableEnv), 0.12);
  vec3 lineColor = mix(vec3(1.0), stableEnv / stableEnvLum, 0.28);
  col += uEdgeLine * line * lit * lineColor;

  // ---- tint --------------------------------------------------------------
  // Tint polarity adapts once per local component, not per draw group.
  // This captures the system-material light/dark switch without letting a hard
  // background edge split one surface into visibly different materials.
  float materialLum = luminance(sampleBg(adaptCenter, uMips - 1.0).rgb);
  float useDarkMaterial = smoothstep(0.38, 0.68, materialLum);
  vec3 automaticTint = mix(vec3(0.97, 0.985, 1.0),
                           vec3(0.035, 0.055, 0.080), useDarkMaterial);
  vec3 resolvedTint = mix(uTintColor, automaticTint, clamp(uTintAdapt, 0.0, 1.0));
  float adaptiveAmount = uTintAmount * mix(1.10, 0.92, useDarkMaterial);
  col = mix(col, resolvedTint, clamp(adaptiveAmount, 0.0, 1.0));
  col += uBright;

  // ---- soft contact shadow ----------------------------------------------
  float ds = sdAppleShape(px + vec2(0.0, uShadowOffset));
  float sh = exp(-max(ds, 0.0) / max(uShadowSize, 0.5)) * uShadow;

  if (uDebug == 1) col = vec3(h);
  if (uDebug == 2) col = vec3(0.5 + 0.5 * n.xy, n.z);
  if (uDebug == 3) col = vec3(length(dG) / max(opticalHeight, 1.0),
                              length(dR - dB) / max(opticalHeight, 1.0) * 6.0, 0.0);

  // The browser drawing buffer stores display/sRGB values, unlike the explicit
  // SRGB8_ALPHA8 offscreen attachments. Encode the final linear material here,
  // then add triangular-distribution noise smaller than one display-space LSB.
  if (uDebug == 0) {
    float n0 = hash12(gl_FragCoord.xy + vec2(17.0, 59.0));
    float n1 = hash12(gl_FragCoord.yx + vec2(83.0, 11.0));
    float noise = (n0 - n1) * (0.85 / 255.0);
    col = clamp(linearToSrgb(col) + noise, 0.0, 1.0);
  }

  float a = aa + sh * (1.0 - aa);
  outColor = vec4(col * aa, a);   // premultiplied; shadow contributes black
}`;var Z=`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uDpr;
uniform float uMips;
uniform float uBackdropBlur;
const int MAX_SHAPES = 16;
uniform int uShapeCount;
uniform vec2 uShapeCenters[MAX_SHAPES];
uniform vec2 uShapeHalves[MAX_SHAPES];
uniform int uShapeTypes[MAX_SHAPES];
uniform float uShapeRadii[MAX_SHAPES];
uniform float uShapeTints[MAX_SHAPES];
uniform float uShapeTintLights[MAX_SHAPES];
uniform float uShapeFrosts[MAX_SHAPES];
uniform float uShapeOpacities[MAX_SHAPES];
uniform float uShapePressures[MAX_SHAPES];
uniform vec2 uShapePressAxes[MAX_SHAPES];
uniform vec2 uLightDirs[MAX_SHAPES];
uniform float uRefraction;
uniform float uEdgeReach;
uniform float uEdgeWidth;
uniform float uDispersion;
uniform float uBody;
uniform float uAbsorption;
uniform float uRim;
uniform float uReflection;
uniform float uHighlight;
uniform float uEcho;
uniform float uHairline;
uniform float uHairWidth;
// 1 while a layer is composited into the sRGB backdrop texture, which encodes
// on write; 0 for the display-referred drawing buffer.
uniform int uOutputLinear;

// Softness ratio -> pre-blur radius, as a fraction of the component short side.
const float FROST_PREBLUR_SCALE = 0.05;
// Strength of the pressed-in squash. The mapping slope at the contour is
// 1 - k, so k must stay below 1 to avoid folding the image.
const float PRESS_SQUASH = 0.85;

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             12.92 * c,
             lessThanEqual(c, vec3(0.0031308)));
}

vec3 srgbToLinear(vec3 c) {
  bvec3 cutoff = lessThanEqual(c, vec3(0.04045));
  vec3 low = c / 12.92;
  vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, cutoff);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Inside a rounded box the exact distance is max(q.x, q.y), and its gradient
// switches axis across the corner diagonal. Refraction reads that gradient as
// the surface normal, so the switch drew a 45-degree crease into every corner.
// A soft maximum rounds that ridge. It is used for the normal only: distance,
// masks, hairline and silhouette all keep the exact field.
// Unbiased: softMax(a, a, k) == a, so the interior term keeps its sign and
// the clamp below still recognises the inner rectangle.
float softMax(float a, float b, float k) {
  return 0.5 * (a + b + sqrt((a - b) * (a - b) + k * k)) - k * 0.5;
}

float sdRoundBoxSoft(vec2 p, vec2 b, float r, float k) {
  vec2 q = abs(p) - b + r;
  return min(softMax(q.x, q.y, k), 0.0) + length(max(q, 0.0)) - r;
}

float smoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float shapeSdf(int index, vec2 point) {
  vec2 p = point - uShapeCenters[index];
  vec2 halfSize = uShapeHalves[index];
  int kind = uShapeTypes[index];
  float radius = min(uShapeRadii[index], min(halfSize.x, halfSize.y));
  if (kind == 0) return sdRoundBox(p, halfSize, radius);
  if (kind == 1) return sdRoundBox(p, halfSize, min(halfSize.x, halfSize.y));
  return length(p) - min(halfSize.x, halfSize.y);
}

/** The silhouette field with a rounded interior ridge, for normals. */
float shapeField(int index, vec2 point) {
  vec2 p = point - uShapeCenters[index];
  vec2 halfSize = uShapeHalves[index];
  int kind = uShapeTypes[index];
  float minHalf = min(halfSize.x, halfSize.y);
  float k = clamp(minHalf * 0.08, 1.5, 12.0);
  if (kind == 0) return sdRoundBoxSoft(p, halfSize, min(uShapeRadii[index], minHalf), k);
  if (kind == 1) return sdRoundBoxSoft(p, halfSize, minHalf, k);
  return length(p) - minHalf;
}

vec2 opticalNormal(int index, vec2 point, vec2 sdfNormal) {
  vec2 p = point - uShapeCenters[index];
  vec2 halfSize = max(uShapeHalves[index], vec2(1.0));
  int kind = uShapeTypes[index];

  if (kind == 0) {
    // The sixth-order superellipse is the optical field, while roundness only
    // controls the silhouette. This separation is part of the V2 model.
    vec2 q = p / halfSize;
    vec2 g = vec2(sign(q.x) * pow(abs(q.x), 5.0) / halfSize.x,
                  sign(q.y) * pow(abs(q.y), 5.0) / halfSize.y);
    return normalize(g + sdfNormal * 0.0001);
  }
  if (kind == 1) {
    vec2 closest;
    if (halfSize.x >= halfSize.y) {
      float segment = max(halfSize.x - halfSize.y, 0.0);
      closest = vec2(clamp(p.x, -segment, segment), 0.0);
    } else {
      float segment = max(halfSize.y - halfSize.x, 0.0);
      closest = vec2(0.0, clamp(p.y, -segment, segment));
    }
    return normalize(p - closest + sdfNormal * 0.0001);
  }
  return normalize(p + sdfNormal * 0.0001);
}

// The shared backdrop pipeline stores linear radiance in SRGB8_ALPHA8.
// V2's optical constants were authored in display space, so convert each
// sample back before applying the V2 equations.
vec3 backdropLod(vec2 uv, float lod) {
  return linearToSrgb(textureLod(uSrc, clamp(uv, vec2(0.001), vec2(0.999)),
                                 clamp(lod, 0.0, max(uMips - 1.0, 0.0))).rgb);
}

// The mip level an implicit texture() lookup selects for a refracted
// coordinate. Explicit sampling never drops below it, so compressed capture
// bands stay filtered exactly as before while pre-blur can raise the level.
float footprintLod(vec2 uv) {
  vec2 dx = dFdx(uv) * uRes;
  vec2 dy = dFdy(uv) * uRes;
  return 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
}

vec3 softBackdrop(vec2 uv, float radius) {
  float lod = log2(max(radius * 0.9, 1.0));
  vec2 r = vec2(max(radius * 0.42, 0.35)) / uRes;
  vec2 center = clamp(uv, vec2(0.001), vec2(0.999));
  vec3 c = backdropLod(center, lod) * 0.44;
  c += backdropLod(center + vec2(r.x, 0.0), lod) * 0.14;
  c += backdropLod(center - vec2(r.x, 0.0), lod) * 0.14;
  c += backdropLod(center + vec2(0.0, r.y), lod) * 0.14;
  c += backdropLod(center - vec2(0.0, r.y), lod) * 0.14;
  return c;
}

// The backdrop blurred before refraction: a frosted layer that the liquid
// glass then bends. Radius is in device pixels; zero is the sharp backdrop.
vec3 preBlurredBackdrop(vec2 uv, float radius, float footprint) {
  if (radius <= 0.0) return backdropLod(uv, footprint);
  float lod = max(log2(max(radius * 0.9, 1e-3)), footprint);
  vec2 r = vec2(radius * 0.42) / uRes;
  vec2 center = clamp(uv, vec2(0.001), vec2(0.999));
  vec3 c = backdropLod(center, lod) * 0.44;
  c += backdropLod(center + vec2(r.x, 0.0), lod) * 0.14;
  c += backdropLod(center - vec2(r.x, 0.0), lod) * 0.14;
  c += backdropLod(center + vec2(0.0, r.y), lod) * 0.14;
  c += backdropLod(center - vec2(0.0, r.y), lod) * 0.14;
  return c;
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 interfaceColor(vec2 point, vec2 normal, float preBlur) {
  float radius = max(2.0, preBlur);
  vec3 outsideColor = softBackdrop((point + normal * 1.8) / uRes, radius);
  vec3 insideColor = softBackdrop((point - normal * 1.8) / uRes, radius);
  // Apple's outer interface is a neutral contrast line rather than a copy of
  // the wallpaper colour. Include display-space value as well as luminance so
  // saturated blue/purple fields select a dark line even though their formal
  // luminance is modest. The outside carries more weight because that is the
  // field the silhouette must remain legible against.
  float outsideValue = max(outsideColor.r, max(outsideColor.g, outsideColor.b));
  float insideValue = max(insideColor.r, max(insideColor.g, insideColor.b));
  float outsideLight = max(luminance(outsideColor), outsideValue * 0.72);
  float insideLight = max(luminance(insideColor), insideValue * 0.72);
  float interfaceLight = outsideLight * 0.68 + insideLight * 0.32;
  float darkLine = smoothstep(0.40, 0.61, interfaceLight);
  return mix(vec3(0.92, 0.93, 0.96), vec3(0.014, 0.013, 0.018), darkLine);
}

void main() {
  vec2 point = vUV * uRes;
  int chosen = -1;
  float chosenD = 1e6;
  int nearest = 0;
  float nearestD = 1e6;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float d = shapeSdf(i, point);
    if (d < nearestD) { nearest = i; nearestD = d; }
    if (d <= 2.1) { chosen = i; chosenD = d; }
  }

  // Screen-space derivatives (fwidth, dFdx/dFdy and implicit texture LOD) are
  // only defined in uniform control flow. Fragments outside every surface
  // return early below; if that happened before the derivatives, a lane in
  // the 2x2 quad that exited with the 1e6 sentinel would make its neighbours'
  // hairline width and mip level garbage on some GPUs, sprinkling stray
  // pixels along the silhouette. So the geometric ALU runs for every lane,
  // evaluated on the nearest surface as a continuous extension for outside
  // fragments, and only the texture fetches are skipped after the return.
  bool covered = chosen >= 0;
  if (!covered) { chosen = nearest; chosenD = nearestD; }
  float edgeAA = max(fwidth(nearestD), 0.72);

  vec2 center = uShapeCenters[chosen];
  vec2 halfSize = uShapeHalves[chosen];
  float minHalf = min(halfSize.x, halfSize.y);
  float e = 1.35;
  float dx = shapeField(chosen, point + vec2(e, 0.0)) - shapeField(chosen, point - vec2(e, 0.0));
  float dy = shapeField(chosen, point + vec2(0.0, e)) - shapeField(chosen, point - vec2(0.0, e));
  vec2 normal = normalize(vec2(dx, dy) + vec2(0.0001));
  float depth = clamp(-chosenD / max(12.0, minHalf * 0.62), 0.0, 1.0);
  float refractionSupport = max(14.0, minHalf * 0.50);
  float edgeCurve = pow(1.0 - smoothstep(0.0, refractionSupport, -chosenD), 2.2);
  vec2 local = (point - center) / max(halfSize, vec2(1.0));

  float edgeDepth = max(-chosenD, 0.0);
  float causticSupport = max(8.0, minHalf * uEdgeWidth);
  float captureX = clamp(edgeDepth / causticSupport, 0.0, 1.0);
  float causticT = 1.0 - smoothstep(0.0, causticSupport, edgeDepth);
  float causticShade = causticT * causticT * (3.0 - 2.0 * causticT);
  // The old double-smoothstep displacement flattened at the visible contour.
  // Its source-coordinate derivative therefore changed sign twice, making a
  // captured line turn back just before it touched the edge. A one-sided exit
  // profile keeps a finite slope at the contour and relaxes to zero only on
  // the inner side of the capture band, leaving a single optical fold.
  float captureProfile = pow(1.0 - captureX, 1.64);
  float refractionX = clamp(edgeDepth / refractionSupport, 0.0, 1.0);
  float refractionProfile = pow(1.0 - refractionX, 2.2);
  // The silhouette and optical superellipse deliberately differ in V2, but
  // the visible contour must still exit along the silhouette normal. Blend to
  // the broader optical field only after leaving the outer edge pixels.
  float opticalNormalMix = smoothstep(0.12, 0.55, captureX);
  vec2 bendNormal = normalize(mix(normal, opticalNormal(chosen, point, normal), opticalNormalMix));
  vec2 inward = -bendNormal;
  // Edge pull used to multiply Capture reach as a second public control. Keep
  // its original default as an internal calibration so the default material
  // retains the same displacement with one unambiguous capture parameter.
  const float CAPTURE_REACH_SCALE = 1.24;
  float captureDistance = uEdgeReach * minHalf * 2.0 * CAPTURE_REACH_SCALE * captureProfile;
  float shallowRefraction = uRefraction * refractionProfile * 0.32;
  vec2 lensShift = inward * (shallowRefraction + captureDistance);
  lensShift += -local * (uRefraction * 0.035) * smoothstep(0.16, 0.92, depth);
  // A held lens is pressed in: a shallow diverging surface that squashes what
  // is seen through it. The outward displacement follows the contour normal,
  // vanishes on the centre line and at the silhouette, and softens the
  // ordinary edge fold instead of inflating the rim.
  float pressure = clamp(uShapePressures[chosen], 0.0, 1.0);
  float pressDepth = clamp(edgeDepth / max(minHalf, 1.0), 0.0, 1.0);
  lensShift *= 1.0 - pressure * 0.35;
  // Per-axis weights let a host shorten the squash along one direction, so a
  // wide capsule can keep its length while it flattens (or vice versa).
  vec2 pressAxes = clamp(uShapePressAxes[chosen], 0.0, 1.0);
  lensShift += normal * pressAxes * (PRESS_SQUASH * minHalf * pressure
                                     * pressDepth * (1.0 - pressDepth));
  vec2 chromaShift = bendNormal * uDispersion * (0.32 + edgeCurve * 0.95);
  vec2 uvR = (point + lensShift * (1.0 + uDispersion * 0.009) + chromaShift) / uRes;
  vec2 uvG = (point + lensShift) / uRes;
  vec2 uvB = (point + lensShift * (1.0 - uDispersion * 0.011) - chromaShift) / uRes;
  // Reach controls where the sample comes from, not how fat a captured line
  // becomes. Preserve the tuned reach=35 softness while preventing larger
  // reaches from silently doubling the blur radius.
  float causticBlur = min(0.7 + 1.13 * uDpr, 0.7 + captureDistance * 0.026);
  // Softness and background pre-blur are the same operation: the backdrop is
  // blurred before the lens bends it. Softness is a ratio of the component
  // short side, so a larger card is naturally more frosted at one setting;
  // pre-blur is an absolute radius. Successive blurs add in quadrature.
  float frostRadius = clamp(uShapeFrosts[chosen], 0.0, 1.0) * minHalf * 2.0 * FROST_PREBLUR_SCALE;
  float preBlur = sqrt(frostRadius * frostRadius + uBackdropBlur * uBackdropBlur);
  float lodR = footprintLod(uvR);
  float lodG = footprintLod(uvG);
  float lodB = footprintLod(uvB);
  vec2 echoUv = (point - normal * 11.0) / uRes;
  float echoLod = footprintLod(echoUv);

  if (!covered) {
    outColor = vec4(0.0);
    return;
  }

  vec3 sr = preBlurredBackdrop(uvR, preBlur, lodR);
  vec3 sg = preBlurredBackdrop(uvG, preBlur, lodG);
  vec3 sb = preBlurredBackdrop(uvB, preBlur, lodB);
  // Captured lines keep their slight softening inside the thin caustic band
  // unless the pre-blurred backdrop is already at least that soft.
  float causticMix = causticShade * 0.18;
  if (causticMix > 0.001 && causticBlur > preBlur) {
    sr = mix(sr, softBackdrop(uvR, causticBlur), causticMix);
    sg = mix(sg, softBackdrop(uvG, causticBlur), causticMix);
    sb = mix(sb, softBackdrop(uvB, causticBlur), causticMix);
  }
  vec3 transmitted = vec3(sr.r, sg.g, sb.b);

  float transmittedLum = luminance(transmitted);
  vec3 bodyTarget = mix(vec3(0.030, 0.031, 0.038), vec3(0.94, 0.95, 0.97),
                        smoothstep(0.58, 0.82, transmittedLum));
  transmitted = mix(transmitted, bodyTarget,
                    clamp(uBody * (0.034 + edgeCurve * 0.012), 0.0, 0.11));
  transmitted = mix(vec3(luminance(transmitted)), transmitted, 1.0 - uBody * 0.045);

  float opticalPath = 0.26 + sqrt(depth) * 0.74;
  transmitted *= exp(-vec3(0.018, 0.011, 0.004) * opticalPath * 2.4 * uAbsorption);
  // Tinted Liquid Glass chooses one light/dark material for the whole
  // component. Choosing per fragment lets high-contrast content punch a
  // checkerboard through the surface instead of producing the coherent milky
  // veil used by notifications and other legibility-first controls.
  vec3 tintTarget = mix(vec3(0.055, 0.057, 0.066), vec3(0.975, 0.970, 0.955),
                        clamp(uShapeTintLights[chosen], 0.0, 1.0));
  float tintOpacity = smoothstep(0.0, 1.5, uShapeTints[chosen]) * 0.78;
  transmitted = mix(transmitted, tintTarget, tintOpacity * (0.88 + depth * 0.12));

  float mask = 1.0 - smoothstep(0.0, 1.35, chosenD);
  float thinRim = exp(-pow((chosenD + 0.65) / 1.4, 2.0));
  float innerRim = exp(-pow((chosenD + 6.2) / 3.8, 2.0));
  float fresnel = pow(clamp(edgeCurve, 0.0, 1.0), 0.72);
  vec2 lightDir = normalize(uLightDirs[chosen] + vec2(0.0001));
  float key = pow(max(dot(normal, lightDir), 0.0), 7.0) * fresnel;
  float opposite = pow(max(dot(normal, -lightDir), 0.0), 5.0) * innerRim;
  vec3 color = transmitted;
  // The rim reflection, echo and interface line only exist in a band around
  // the contour. Their weights are resolved first so interior fragments skip
  // the extra backdrop probes; a skipped weight is below 1/2000.
  float rimMix = clamp((thinRim * 0.42 + innerRim * 0.18 + fresnel * 0.10)
                       * uRim * uReflection, 0.0, 0.72);
  if (rimMix > 0.0005) {
    // A softened environment probe keeps moving video/feed edges from turning
    // into one-frame white flashes while preserving the local colour response.
    vec3 reflected = softBackdrop((point + normal * (8.0 + uRefraction * 0.17)) / uRes,
                                  max(5.2, preBlur));
    vec3 adaptiveRim = reflected * 1.45 + vec3(0.06, 0.035, 0.08);
    adaptiveRim = mix(adaptiveRim, vec3(0.96, 0.97, 1.0), 0.24);
    adaptiveRim = mix(adaptiveRim, vec3(0.035, 0.025, 0.045),
                      smoothstep(0.78, 0.98, luminance(reflected)) * 0.48);
    color = mix(color, adaptiveRim, rimMix);
  }
  color += vec3(1.0, 0.82, 0.92) * key * 0.30 * uRim * uHighlight;
  color *= 1.0 - opposite * 0.12 * uRim;
  float echoMix = exp(-pow((chosenD + 11.0) / 5.5, 2.0)) * 0.075 * uRim * uEcho;
  if (echoMix > 0.0005) {
    vec3 echoColor = preBlurredBackdrop(echoUv, preBlur, echoLod);
    color = mix(color, echoColor * 1.12, echoMix);
  }

  float lineWidth = mix(0.34, 1.08, clamp(uHairWidth, 0.0, 1.0));
  float strokeDistance = abs(chosenD + 0.10) - lineWidth * 0.5;
  float hairline = 1.0 - smoothstep(-edgeAA * 0.72, edgeAA * 0.72, strokeDistance);
  // Premultiplied layer composition exactly reproduces the prototype's two
  // sequential mixes when drawn over the supplied backdrop, and also allows
  // the same shader to work in overlay mode over a DOM/canvas backdrop.
  float hairAlpha = clamp(hairline * uHairline * (0.22 + uRim * 0.20), 0.0, 1.0);
  vec3 hairColor = vec3(0.0);
  if (hairAlpha > 0.0) {
    hairColor = interfaceColor(point, normal, preBlur);
    // The contrast line is the default interface. On the light-facing arc the
    // specular key replaces it with the thin white highlight visible in the
    // native material instead of merely brightening the black line underneath.
    float hairHighlight = clamp(key * uHighlight * 2.5 * (0.65 + uRim * 0.60), 0.0, 0.96);
    hairColor = mix(hairColor, vec3(0.985, 0.99, 1.0), hairHighlight);
  }

  float alpha = hairAlpha + mask * (1.0 - hairAlpha);
  // The rim, key highlight and echo terms can push the body colour past 1.0.
  // Inside the surface the drawing buffer clamps that anyway, but on the
  // anti-aliased fringe a premultiplied rgb larger than alpha composites
  // brighter than either the glass or the backdrop, sprinkling over-bright
  // pixels along the outer edge. Saturate before premultiplying.
  color = clamp(color, 0.0, 1.0);
  if (uOutputLinear == 1) {
    color = srgbToLinear(color);
    hairColor = srgbToLinear(hairColor);
  }
  vec3 premultiplied = hairColor * hairAlpha + color * mask * (1.0 - hairAlpha);
  float surfaceOpacity = clamp(uShapeOpacities[chosen], 0.0, 1.0);
  outColor = vec4(premultiplied * surfaceOpacity, alpha * surfaceOpacity);
}`;function J(a,e,i){let t=a.createShader(e);if(a.shaderSource(t,i),a.compileShader(t),!a.getShaderParameter(t,a.COMPILE_STATUS)){let n=a.getShaderInfoLog(t);throw a.deleteShader(t),new Error(n+`
`+i)}return t}function U(a,e,i){let t=a.createProgram(),n=J(a,a.VERTEX_SHADER,e),r;try{r=J(a,a.FRAGMENT_SHADER,i)}catch(s){throw a.deleteShader(n),a.deleteProgram(t),s}if(a.attachShader(t,n),a.attachShader(t,r),a.linkProgram(t),a.detachShader(t,n),a.detachShader(t,r),a.deleteShader(n),a.deleteShader(r),!a.getProgramParameter(t,a.LINK_STATUS)){let s=a.getProgramInfoLog(t);throw a.deleteProgram(t),new Error(s)}let o={},h=a.getProgramParameter(t,a.ACTIVE_UNIFORMS);for(let s=0;s<h;s++){let l=a.getActiveUniform(t,s).name.replace("[0]","");o[l]=a.getUniformLocation(t,l)}return{p:t,loc:o}}var ve=7;var N=class{constructor(e,i={}){let t=e.getContext("webgl2",{alpha:!!i.alpha,antialias:!1,premultipliedAlpha:!0,preserveDrawingBuffer:!!i.preserveDrawingBuffer});if(!t)throw new Error("WebGL2 unavailable");this.gl=t,this.canvas=e,this.materialVersion=i.materialVersion===2?2:1,this.lost=!1,this.tex=null,this.blurTex=null,this.wallpapers=[],this.fbos=[],this.blurFbos=[],this.mipLevels=0,this.w=0,this.h=0,this.createResources()}createResources(){let e=this.gl;this.quad=e.createVertexArray(),e.bindVertexArray(this.quad),this.quadBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.quadBuffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),this.progWall=U(e,P,Q),this.progDown=U(e,P,j),this.progUp=U(e,P,$),this.progBlit=U(e,P,Y),this.progGlass=U(e,O,this.materialVersion===2?Z:K),this.fallbackTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.fallbackTexture),e.texImage2D(e.TEXTURE_2D,0,e.SRGB8_ALPHA8,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.bindTexture(e.TEXTURE_2D,null)}releaseResources(){let e=this.gl;for(let i of[this.progWall,this.progDown,this.progUp,this.progBlit,this.progGlass])i&&e.deleteProgram(i.p);this.progWall=null,this.progDown=null,this.progUp=null,this.progBlit=null,this.progGlass=null,this.quad&&e.deleteVertexArray(this.quad),this.quadBuffer&&e.deleteBuffer(this.quadBuffer),this.fallbackTexture&&e.deleteTexture(this.fallbackTexture),this.quad=null,this.quadBuffer=null,this.fallbackTexture=null}releaseTargets(){let e=this.gl;this.tex&&e.deleteTexture(this.tex),this.blurTex&&e.deleteTexture(this.blurTex),this.fbos.forEach(i=>e.deleteFramebuffer(i)),this.blurFbos.forEach(i=>e.deleteFramebuffer(i)),this.tex=null,this.blurTex=null,this.fbos=[],this.blurFbos=[],this.mipLevels=0}handleContextLost(){this.lost=!0,this.progWall=null,this.progDown=null,this.progUp=null,this.progBlit=null,this.progGlass=null,this.quad=null,this.quadBuffer=null,this.fallbackTexture=null,this.tex=null,this.blurTex=null,this.fbos=[],this.blurFbos=[];for(let e of this.wallpapers)e.texture=null,e.ready=!1,e.width=0,e.height=0}restore(){if(!this.lost)return this;this.lost=!1,this.createResources();let{w:e,h:i}=this;return this.w=0,this.h=0,e>0&&i>0&&this.resize(e,i),this.createWallpaperTextures(),this}hasLiveBackdrop(){return this.wallpapers.some(e=>e.update==="live")}sourceSize(e){return[Number(e?.videoWidth||e?.naturalWidth||e?.width||0),Number(e?.videoHeight||e?.naturalHeight||e?.height||0)]}isPremultipliedSource(e){let i=e?.tagName?.toUpperCase();return i==="CANVAS"||i==="VIDEO"||e?.constructor?.name==="OffscreenCanvas"||e?.constructor?.name==="VideoFrame"}uploadSource(e){let[i,t]=this.sourceSize(e.source),n=Math.min(1,Math.max(.1,Number(e.scale)||1));if(n>=1||!this.isPremultipliedSource(e.source))return[e.source,i,t];let r=Math.max(1,Math.round(i*n)),o=Math.max(1,Math.round(t*n));e.scaled||(e.scaled=typeof document<"u"?document.createElement("canvas"):new globalThis.OffscreenCanvas(r,o)),e.scaled.width!==r&&(e.scaled.width=r),e.scaled.height!==o&&(e.scaled.height=o);let h=e.scaled.getContext("2d");return h.clearRect(0,0,r,o),h.drawImage(e.source,0,0,r,o),[e.scaled,r,o]}probeSource(e){let i=this.wallpapers[e];if(!i)return null;let t=Math.min(1,Math.max(.1,Number(i.scale)||1));return i.scaled&&t<1?i.scaled:i.source}uploadWallpaper(e,i=!1){if(this.lost||!e.texture)return!1;let[t,n]=this.sourceSize(e.source);if(!(t>0)||!(n>0))return!1;let[r,o,h]=this.uploadSource(e),s=this.gl;s.bindTexture(s.TEXTURE_2D,e.texture);let l=this.isPremultipliedSource(r);return s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,l),!i&&e.ready&&e.width===o&&e.height===h?s.texSubImage2D(s.TEXTURE_2D,0,0,0,s.RGBA,s.UNSIGNED_BYTE,r):s.texImage2D(s.TEXTURE_2D,0,s.RGBA8,s.RGBA,s.UNSIGNED_BYTE,r),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.width=o,e.height=h,e.ready=!0,!0}setWallpaperScale(e){let i=Math.min(1,Math.max(.1,Number(e)||1)),t=!1;for(let n of this.wallpapers)(n.scale??1)!==i&&(t=!0),n.scale=i;return t}resize(e,i){if(e=Math.max(1,Math.round(e)),i=Math.max(1,Math.round(i)),this.lost){this.w=e,this.h=i;return}if(e===this.w&&i===this.h)return;let t=this.gl;this.w=e,this.h=i,this.canvas.width=e,this.canvas.height=i,this.releaseTargets(),this.mipLevels=Math.min(ve,Math.floor(Math.log2(Math.max(e,i)))+1);let n=()=>{let r=t.createTexture();return t.bindTexture(t.TEXTURE_2D,r),t.texStorage2D(t.TEXTURE_2D,this.mipLevels,t.SRGB8_ALPHA8,e,i),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR_MIPMAP_LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),r};this.tex=n(),this.blurTex=n(),this.fbos=[],this.blurFbos=[];for(let r=0;r<this.mipLevels;r++){let o=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,o),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.tex,r),this.fbos.push(o);let h=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,h),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.blurTex,r),this.blurFbos.push(h)}t.bindFramebuffer(t.FRAMEBUFFER,null)}createWallpaperTextures(){if(this.lost)return;let e=this.gl;for(let i of this.wallpapers)i.texture&&e.deleteTexture(i.texture),i.texture=e.createTexture(),i.ready=!1,i.width=0,i.height=0,e.bindTexture(e.TEXTURE_2D,i.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.uploadWallpaper(i,!0);e.bindTexture(e.TEXTURE_2D,null)}setWallpapers(e,i={}){let t=this.gl,n=i.update==="live"?"live":"static",r=Math.min(1,Math.max(.1,Number(i.scale)||1));this.lost||this.wallpapers.forEach(o=>t.deleteTexture(o.texture)),this.wallpapers=e.map(o=>({texture:null,source:o,update:n,scale:r,scaled:null,ready:!1,width:0,height:0})),this.createWallpaperTextures()}refreshWallpapers(e=!1){if(!this.lost){for(let i of this.wallpapers)(e||i.update==="live")&&this.uploadWallpaper(i);this.gl.bindTexture(this.gl.TEXTURE_2D,null)}}mipSize(e){return[Math.max(1,this.w>>e),Math.max(1,this.h>>e)]}buildBackdrop(e,i=1){if(this.lost||!this.fbos.length)return;let t=this.gl;this.refreshWallpapers(),t.bindVertexArray(this.quad),t.disable(t.BLEND),t.bindFramebuffer(t.FRAMEBUFFER,this.fbos[0]),t.viewport(0,0,this.w,this.h),t.useProgram(this.progWall.p),t.uniform2f(this.progWall.loc.uRes,this.w,this.h),t.uniform1i(this.progWall.loc.uScene,e),t.uniform1f(this.progWall.loc.uZoom,i);let n=this.wallpapers[e];if(t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,n?.ready?n.texture:this.fallbackTexture),t.uniform1i(this.progWall.loc.uWallpaper,1),t.uniform1i(this.progWall.loc.uUseImage,n?.ready?1:0),t.drawArrays(t.TRIANGLE_STRIP,0,4),this.downsampleBackdrop(),this.materialVersion===2)return;let r=this.mipLevels-1,[o,h]=this.mipSize(r);t.bindFramebuffer(t.READ_FRAMEBUFFER,this.fbos[r]),t.bindFramebuffer(t.DRAW_FRAMEBUFFER,this.blurFbos[r]),t.blitFramebuffer(0,0,o,h,0,0,o,h,t.COLOR_BUFFER_BIT,t.NEAREST),t.bindVertexArray(this.quad),t.useProgram(this.progUp.p),t.uniform1i(this.progUp.loc.uLow,0),t.uniform1i(this.progUp.loc.uHigh,1);for(let s=r-1;s>=0;s--){let[l,m]=this.mipSize(s+1),[c,f]=this.mipSize(s);t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.blurTex),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_BASE_LEVEL,s+1),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAX_LEVEL,s+1),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.tex),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_BASE_LEVEL,s),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAX_LEVEL,s),t.bindFramebuffer(t.FRAMEBUFFER,this.blurFbos[s]),t.viewport(0,0,c,f),t.uniform2f(this.progUp.loc.uLowTexel,1/l,1/m),t.drawArrays(t.TRIANGLE_STRIP,0,4)}t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.blurTex),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_BASE_LEVEL,0),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAX_LEVEL,this.mipLevels-1),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.tex),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_BASE_LEVEL,0),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAX_LEVEL,this.mipLevels-1)}downsampleBackdrop(){if(this.lost||!this.fbos.length)return;let e=this.gl;e.bindVertexArray(this.quad),e.disable(e.BLEND),e.useProgram(this.progDown.p),e.uniform1i(this.progDown.loc.uTex,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex);for(let i=1;i<this.mipLevels;i++){let[t,n]=this.mipSize(i-1),[r,o]=this.mipSize(i);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_BASE_LEVEL,i-1),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAX_LEVEL,i-1),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[i]),e.viewport(0,0,r,o),e.uniform2f(this.progDown.loc.uTexel,1/t,1/n),e.drawArrays(e.TRIANGLE_STRIP,0,4)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_BASE_LEVEL,0),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAX_LEVEL,this.mipLevels-1)}beginBackdropLayer(){if(this.lost||!this.fbos.length||!this.blurFbos.length)return!1;let e=this.gl;return e.bindFramebuffer(e.READ_FRAMEBUFFER,this.fbos[0]),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,this.blurFbos[0]),e.blitFramebuffer(0,0,this.w,this.h,0,0,this.w,this.h,e.COLOR_BUFFER_BIT,e.NEAREST),!0}commitBackdropLayer(){this.lost||!this.fbos.length||!this.blurFbos.length||([this.tex,this.blurTex]=[this.blurTex,this.tex],[this.fbos,this.blurFbos]=[this.blurFbos,this.fbos],this.downsampleBackdrop())}drawBackdrop(){if(this.lost||!this.tex)return;let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.w,this.h),e.disable(e.BLEND),e.bindVertexArray(this.quad),e.useProgram(this.progBlit.p),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex),e.uniform1i(this.progBlit.loc.uTex,0),e.drawArrays(e.TRIANGLE_STRIP,0,4)}clearOutput(){if(this.lost)return;let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.w,this.h),e.disable(e.BLEND),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT)}drawGlassGroup(e,i,t,n=i.mergeRadius??0){if(!e.length||this.lost||!this.tex)return;let r=this.gl,{loc:o,p:h}=this.progGlass,s=e.slice(0,16),l=Math.min(...s.map(u=>u.x)),m=Math.min(...s.map(u=>u.y)),c=Math.max(...s.map(u=>u.x+u.w)),f=Math.max(...s.map(u=>u.y+u.h)),S=c-l,b=f-m;r.bindFramebuffer(r.FRAMEBUFFER,null),r.viewport(0,0,this.w,this.h),r.enable(r.BLEND),r.blendFunc(r.ONE,r.ONE_MINUS_SRC_ALPHA),r.bindVertexArray(this.quad),r.useProgram(h);let T=(l+S/2)*t,R=this.h-(m+b/2)*t,k=S/2*t,E=b/2*t,A=new Float32Array(32),d=new Float32Array(32),g=new Float32Array(16),L=new Int32Array(16);s.forEach((u,y)=>{let M=Math.min(u.w,u.h);A[y*2]=(u.x+u.w/2)*t,A[y*2+1]=this.h-(u.y+u.h/2)*t,d[y*2]=u.w/2*t,d[y*2+1]=u.h/2*t,g[y]=Math.min(u.radius??i.radius,M*.235)*t,L[y]=u.shape==="pill"?1:u.shape==="circle"?2:0}),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.tex),r.uniform1i(o.uSrc,0),r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,this.blurTex),r.uniform1i(o.uBlurSrc,2),r.uniform2f(o.uRes,this.w,this.h),r.uniform2f(o.uCenter,T,R),r.uniform2f(o.uHalf,k,E),r.uniform1i(o.uShapeCount,s.length),r.uniform2fv(o.uShapeCenters,A),r.uniform2fv(o.uShapeHalves,d),r.uniform1iv(o.uShapeTypes,L),r.uniform1fv(o.uShapeRadii,g),r.uniform1f(o.uMergeRadius,Math.max(0,n)*t),r.uniform1f(o.uPad,(i.shadowSize*4+Math.max(n,0)*.3+8)*t),r.uniform1f(o.uSquircle,i.squircle),r.uniform1f(o.uBevel,i.bevel*t),r.uniform1f(o.uHeight,i.height*t),r.uniform1f(o.uSizeAdaptation,i.sizeAdaptation??1),r.uniform1f(o.uIOR,i.ior),r.uniform1f(o.uDispersion,i.dispersion),r.uniform1f(o.uBlurPlateau,i.blurPlateau*t),r.uniform1f(o.uBlurRim,i.blurRim*t),r.uniform1f(o.uOpticalDensity,i.opticalDensity),r.uniform1f(o.uMips,this.mipLevels),r.uniform1f(o.uSpecular,i.specular),r.uniform1f(o.uSpecPower,i.specPower),r.uniform1f(o.uHighlightAdapt,i.highlightAdapt),r.uniform1f(o.uHighlightWidth,i.highlightWidth),r.uniform1f(o.uHighlightSharpness,i.highlightSharpness),r.uniform1f(o.uHighlightBase,i.highlightBase),r.uniform1f(o.uFresnel,i.fresnel),r.uniform1f(o.uSat,i.saturation),r.uniform1f(o.uBright,i.brightness),r.uniform1f(o.uTintAmount,i.tintAmount),r.uniform3f(o.uTintColor,...i.tintColor),r.uniform1f(o.uTintAdapt,i.tintAdapt??0),r.uniform1f(o.uShadow,i.shadow),r.uniform1f(o.uShadowSize,i.shadowSize*t),r.uniform1f(o.uShadowOffset,i.shadowOffset*t),r.uniform2f(o.uLightDir,i.lightX,i.lightY),r.uniform1f(o.uEdgeLine,i.edgeLine),r.uniform1f(o.uEdgeWidth,i.edgeWidth*t),r.uniform1f(o.uEdgeDark,i.edgeDark),r.uniform1f(o.uRefractScale,i.refractScale),r.uniform1f(o.uMeniscus,i.meniscus),r.uniform1i(o.uDebug,i.debug|0),r.drawArrays(r.TRIANGLE_STRIP,0,4),r.disable(r.BLEND)}drawGlass(e,i,t){this.drawGlassGroup([e],i,t,0)}drawGlassV2Group(e,i,t,n=[],r=[],o={}){if(!e.length||this.lost||!this.tex)return;let h=!!o.intoBackdrop&&this.blurFbos.length>0,s=this.gl,{loc:l,p:m}=this.progGlass,c=e.slice(0,16),f=Math.min(...c.map(p=>p.x)),S=Math.min(...c.map(p=>p.y)),b=Math.max(...c.map(p=>p.x+p.w)),T=Math.max(...c.map(p=>p.y+p.h)),R=b-f,k=T-S,E=new Float32Array(32),A=new Float32Array(32),d=new Float32Array(16),g=new Int32Array(16),L=new Float32Array(32),u=new Float32Array(16),y=new Float32Array(16),M=new Float32Array(16),F=new Float32Array(16),q=new Float32Array(16),V=new Float32Array(32);c.forEach((p,w)=>{let W=Math.min(p.w,p.h);E[w*2]=(p.x+p.w/2)*t,E[w*2+1]=this.h-(p.y+p.h/2)*t,A[w*2]=p.w/2*t,A[w*2+1]=p.h/2*t,d[w]=Math.min(p.radius??W*.5*i.roundness,W*.5)*t,g[w]=p.shape==="pill"?1:p.shape==="circle"?2:0;let G=n[w]??[Math.SQRT1_2,Math.SQRT1_2];L[w*2]=G[0],L[w*2+1]=G[1],u[w]=p.tint??i.tint,y[w]=r[w]??1,M[w]=p.frost??i.frost,F[w]=p.opacity??1,q[w]=p.pressure??0,V[w*2]=p.pressureAxes?.[0]??1,V[w*2+1]=p.pressureAxes?.[1]??1}),s.bindFramebuffer(s.FRAMEBUFFER,h?this.blurFbos[0]:null),s.viewport(0,0,this.w,this.h),s.enable(s.BLEND),s.blendFunc(s.ONE,s.ONE_MINUS_SRC_ALPHA),s.bindVertexArray(this.quad),s.useProgram(m),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.tex),s.uniform1i(l.uSrc,0),s.uniform1i(l.uOutputLinear,h?1:0),s.uniform2f(l.uRes,this.w,this.h),s.uniform1f(l.uDpr,t),s.uniform2f(l.uCenter,(f+R/2)*t,this.h-(S+k/2)*t),s.uniform2f(l.uHalf,R/2*t,k/2*t),s.uniform1f(l.uPad,4*t),s.uniform1f(l.uMips,this.mipLevels),s.uniform1i(l.uShapeCount,c.length),s.uniform2fv(l.uShapeCenters,E),s.uniform2fv(l.uShapeHalves,A),s.uniform1iv(l.uShapeTypes,g),s.uniform1fv(l.uShapeRadii,d),s.uniform1fv(l.uShapeTints,u),s.uniform1fv(l.uShapeTintLights,y),s.uniform1fv(l.uShapeFrosts,M),s.uniform1fv(l.uShapeOpacities,F),s.uniform1fv(l.uShapePressures,q),s.uniform2fv(l.uShapePressAxes,V),s.uniform2fv(l.uLightDirs,L),s.uniform1f(l.uRefraction,i.refraction*t),s.uniform1f(l.uEdgeReach,i.edgeReach),s.uniform1f(l.uBackdropBlur,(i.backdropBlur??0)*t),s.uniform1f(l.uEdgeWidth,i.edgeWidth),s.uniform1f(l.uDispersion,i.dispersion),s.uniform1f(l.uBody,i.body),s.uniform1f(l.uAbsorption,i.absorption),s.uniform1f(l.uRim,i.rim),s.uniform1f(l.uReflection,i.reflection),s.uniform1f(l.uHighlight,i.highlight),s.uniform1f(l.uEcho,i.echo),s.uniform1f(l.uHairline,i.hairline),s.uniform1f(l.uHairWidth,i.hairWidth),s.drawArrays(s.TRIANGLE_STRIP,0,4),s.disable(s.BLEND)}destroy(){if(this.lost){this.wallpapers=[];return}let e=this.gl;this.releaseTargets(),this.releaseResources(),this.wallpapers.forEach(i=>e.deleteTexture(i.texture)),this.wallpapers=[]}};var H=Object.freeze({refraction:84,edgeReach:.14,edgeWidth:.21,dispersion:2,frost:0,backdropBlur:0,body:.72,absorption:.58,tint:0,rim:.24,reflection:.31,highlight:.34,lightAngle:136,echo:.28,hairline:.92,hairWidth:.52,roundness:.47}),ee=Object.freeze({refraction:0,edgeReach:0,dispersion:0,frost:0,backdropBlur:0,body:1.5,tint:1.35,reflection:.18,highlight:.12,echo:0}),xe=Object.freeze([["refraction",0,110,1],["edgeReach",0,1.6,.01],["edgeWidth",0,.55,.01],["dispersion",0,7,.1],["frost",0,1,.01],["backdropBlur",0,64,1],["body",0,1.5,.01],["absorption",0,2,.01],["tint",0,1.5,.01],["rim",0,1,.01],["reflection",0,1.5,.01],["highlight",0,1.5,.01],["lightAngle",-180,180,1],["echo",0,1.5,.01],["hairline",0,1.5,.01],["hairWidth",0,1,.01],["roundness",.05,.6,.01]]);function te(){return{...H}}function I(a={}){if(typeof a=="string")throw new TypeError("Liquid Glass V2 does not use V1 preset names.");let e=Object.keys(a||{}).filter(i=>!(i in H));if(e.length)throw new TypeError(`Unknown Liquid Glass V2 material parameter${e.length===1?"":"s"}: ${e.join(", ")}`);return{...te(),...a||{}}}var be=Object.freeze({rect:0,folder:0,pill:1,circle:2});function Se(a){return be[a]??0}function ie(a,e,i,t,n){let r=Math.min(n,i,t),o=Math.abs(a)-i+r,h=Math.abs(e)-t+r;return Math.min(Math.max(o,h),0)+Math.hypot(Math.max(o,0),Math.max(h,0))-r}function we(a,e=.47){let i=Number(a.w??a.width??a.size??0),t=Number(a.h??a.height??a.size??i);return Number.isFinite(a.radius)?Math.max(0,Math.min(Number(a.radius),Math.min(i,t)*.5)):Math.min(i,t)*.5*e}function re(a,e,i,t={}){let n=Number(i.w??i.width??i.size??0),r=Number(i.h??i.height??i.size??n),o=n/2,h=r/2,s=a-Number(i.x??0)-o,l=e-Number(i.y??0)-h,m=Se(i.shape),c=we({...i,w:n,h:r},t.roundness??.47);return m===1?ie(s,l,o,h,Math.min(o,h)):m===2?Math.hypot(s,l)-Math.min(o,h):ie(s,l,o,h,c)}function ae(a,e,i,t={}){let n=1/0;for(let r of i)n=Math.min(n,re(a,e,r,t));return n}function oe(a,e,i,t={},n={}){let r=n.tolerance??0;for(let o=i.length-1;o>=0;o--)if(re(a,e,i[o],t)<=r)return i[o];return null}var Te=new Set(["folder","rect","pill","circle"]),Ee=new Set(["replace","overlay"]),ye=new Set(["auto","static","live"]),Re="(prefers-reduced-transparency: reduce)";function Ae(a){if(!Ee.has(a))throw new TypeError(`Unknown liquid glass V2 composite mode: ${a}`);return a}function Le(a){let e=a==="folderRect"?"rect":a;if(!Te.has(e))throw new TypeError(`Unknown liquid glass V2 shape: ${a}`);return e}function X(a,e){let i=Number(a.w??a.width??a.size??0),t=Number(a.h??a.height??a.size??i);if(!Number.isFinite(i)||!Number.isFinite(t)||i<0||t<0)throw new TypeError("Liquid glass V2 elements need a finite, non-negative width and height.");let n=a.tint==null?void 0:Number(a.tint);if(n!==void 0&&!Number.isFinite(n))throw new TypeError("Liquid glass V2 element tint must be a finite number.");let r=a.frost==null?void 0:Number(a.frost);if(r!==void 0&&!Number.isFinite(r))throw new TypeError("Liquid glass V2 element frost must be a finite number.");let o=a.opacity==null?void 0:Number(a.opacity),h=Number(a.pressure??0);if(!Number.isFinite(h))throw new TypeError("Liquid glass V2 element pressure must be a finite number.");let s=a.pressureAxes==null?[1,1]:[Number(a.pressureAxes[0]??1),Number(a.pressureAxes[1]??1)];if(!s.every(Number.isFinite))throw new TypeError("Liquid glass V2 element pressureAxes must be two finite numbers.");if(o!==void 0&&!Number.isFinite(o))throw new TypeError("Liquid glass V2 element opacity must be a finite number.");let l=a.tintTone??"light";if(!["auto","light","dark"].includes(l))throw new TypeError(`Unknown liquid glass V2 tint tone: ${l}`);let m=Number(a.layer??0);if(!Number.isInteger(m)||m<0)throw new TypeError("Liquid glass V2 element layer must be a non-negative integer.");return{...a,id:a.id??`glass-v2-${e+1}`,shape:Le(a.shape??"rect"),x:Number(a.x??0),y:Number(a.y??0),w:i,h:t,...n===void 0?{}:{tint:n},...r===void 0?{}:{frost:r},...o===void 0?{}:{opacity:o},tintTone:l,layer:m,pressure:Math.max(0,Math.min(1,h)),pressureAxes:s.map(c=>Math.max(0,Math.min(1,c)))}}function ke(a){let e=new Map;for(let i of a){let t=i.layer??0;e.has(t)||e.set(t,[]),e.get(t).push(i)}return[...e.keys()].sort((i,t)=>i-t).map(i=>e.get(i))}function se(a){let e=Number(a??1);if(!Number.isFinite(e)||e<=0||e>1)throw new TypeError("Liquid glass V2 backdrop scale must be a number in (0, 1].");return Math.max(.1,e)}function ne(a){return typeof a!="string"?Promise.resolve(a):new Promise((e,i)=>{let t=new Image;t.onload=()=>e(t),t.onerror=()=>i(new Error(`Unable to load liquid glass V2 wallpaper: ${a}`)),t.src=a})}function Be(a){let e=a?.tagName?.toUpperCase();return e==="CANVAS"||e==="VIDEO"||a?.constructor?.name==="OffscreenCanvas"||a?.constructor?.name==="VideoFrame"}function Me(a,e="auto"){if(!ye.has(e))throw new TypeError(`Unknown liquid glass V2 backdrop update mode: ${e}`);return e==="auto"?Be(a)?"live":"static":e}function De(a){return typeof globalThis.matchMedia=="function"?globalThis.matchMedia(a):null}function le(a){return[Number(a?.videoWidth||a?.naturalWidth||a?.width||0),Number(a?.videoHeight||a?.naturalHeight||a?.height||0)]}function he(a,e,i,t){let n=Math.max(i/a,i/e)*t,r=a*n,o=e*n;return{x:(i-r)/2,y:(i-o)/2,width:r,height:o}}var _e=`
let canvas = null;
self.onmessage = ({ data }) => {
  const { id, bitmap, size, x, y, width, height } = data;
  let pixels = null;
  try {
    if (!canvas || canvas.width !== size) canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, size, size);
    context.drawImage(bitmap, x, y, width, height);
    pixels = context.getImageData(0, 0, size, size).data;
  } catch {}
  bitmap.close();
  self.postMessage({ id, pixels }, pixels ? [pixels.buffer] : []);
};`,ce=84,C=class{static isSupported(){if(typeof document>"u")return!1;try{let i=document.createElement("canvas").getContext("webgl2");return i?(i.getExtension("WEBGL_lose_context")?.loseContext(),!0):!1}catch{return!1}}constructor(e,i={}){if(!e||typeof e.getContext!="function")throw new TypeError("LiquidGlassWebGLV2 needs an HTMLCanvasElement.");this.canvas=e,this.version="v2",this.compositeMode=Ae(i.compositeMode??"replace"),this.renderer=new N(e,{alpha:this.compositeMode==="overlay",preserveDrawingBuffer:!!i.preserveDrawingBuffer,materialVersion:2}),this.material=I(i.material),this.elements=[],this.backdrops=[],this.wallpaperIndex=0,this.wallpaperZoom=i.wallpaperZoom??1,this.running=!1,this.animationFrame=0,this.dirty=!0,this.backdropDirty=!0,this.pyramidStale=!1,this.backdropScale=1,this.lightFieldDirty=!0,this.lastFrame={width:0,height:0,dpr:0},this.warnedShapeLimit=!1,this.lightCanvas=null,this.lightPixels=null,this.lightSampleSize=64,this.smoothedLightDirections=new Map,this.lastLightFieldUpdate=0,this.lastLightBlendTime=0,this.lastManualBackdropUpdate=-1/0,this.lightFieldAsyncDirty=!1,this.lightWorker=null,this.lightWorkerUnavailable=!1,this.lightProbeId=0,this.lightProbePending=!1,this.lightProbeQueued=!1,this.settledRenderFrame=0,this.onContextLost=i.onContextLost??null,this.onContextRestored=i.onContextRestored??null,this.respectReducedTransparency=i.respectReducedTransparency??!0,this.reducedTransparencyQuery=this.respectReducedTransparency?De(Re):null,this.handleReducedTransparencyChange=()=>{this.markDirty(),this.render()},this.reducedTransparencyQuery?.addEventListener?.("change",this.handleReducedTransparencyChange),this.handleContextLost=t=>{t.preventDefault(),this.renderer.handleContextLost(),this.markBackdropDirty(),this.onContextLost?.(t)},this.handleContextRestored=t=>{this.renderer.restore(),this.markBackdropDirty(),this.lastFrame={width:0,height:0,dpr:0},this.onContextRestored?.(t),this.render()},e.addEventListener("webglcontextlost",this.handleContextLost,!1),e.addEventListener("webglcontextrestored",this.handleContextRestored,!1),this.resizeObserver=null,(i.autoResize??!0)&&typeof globalThis.ResizeObserver=="function"&&(this.resizeObserver=new globalThis.ResizeObserver(()=>{this.lightFieldDirty=!0,this.markDirty(),this.render()}),this.resizeObserver.observe(e)),i.elements&&this.setElements(i.elements,!1),i.wallpapers&&this.setWallpapers(i.wallpapers,!1),i.backdrop&&this.setBackdrop(i.backdrop,{update:i.backdropUpdate,autoStart:i.autoStart,shouldRender:!1})}get contextLost(){return this.renderer.lost}get reducedTransparency(){return!!this.reducedTransparencyQuery?.matches}get effectiveMaterial(){return this.reducedTransparency?{...this.material,...ee}:this.material}markDirty(){return this.dirty=!0,this}markBackdropDirty(){return this.backdropDirty=!0,this.lightFieldDirty=!0,this.lastLightFieldUpdate=0,this.smoothedLightDirections.clear(),this.markDirty()}setElements(e,i=!0){return this.elements=e.map((t,n)=>X(t,n)),this.markDirty(),i&&this.render(),this}addElement(e,i=!0){let t=X(e,this.elements.length);return this.elements.push(t),this.markDirty(),i&&this.render(),t.id}updateElement(e,i,t=!0){let n=this.elements.findIndex(r=>r.id===e);return n===-1?this:(this.elements[n]=X({...this.elements[n],...i},n),this.markDirty(),t&&this.render(),this)}removeElement(e,i=!0){return this.elements=this.elements.filter(t=>t.id!==e),this.markDirty(),i&&this.render(),this}setMaterial(e,i=!0){if(typeof e=="string")throw new TypeError("Liquid Glass V2 does not convert V1 preset names. Pass a V2 material object.");return this.material=I({...this.material,...e||{}}),this.markDirty(),i&&this.render(),this}setWallpapers(e,i=!0){return this.backdrops=e.slice(),this.renderer.setWallpapers(e,{update:"static"}),this.markBackdropDirty(),i&&this.render(),this}async loadWallpapers(e,i=!0){let t=await Promise.all(e.map(ne));return this.setWallpapers(t,i)}async setWallpaper(e,i=!0){return this.loadWallpapers([e],i)}setBackdrop(e,i={}){if(!e||typeof e=="string")throw new TypeError("setBackdrop needs a CanvasImageSource. Use loadBackdrop for a URL.");let t=Me(e,i.update);return i.scale!==void 0&&(this.backdropScale=se(i.scale)),this.backdrops=[e],this.renderer.setWallpapers([e],{update:t,scale:this.backdropScale}),this.wallpaperIndex=0,this.markBackdropDirty(),(i.autoStart??t==="live")&&this.start(),(i.shouldRender??!0)&&this.render(),this}setBackdropScale(e,i=!0){let t=se(e);return t===this.backdropScale?this:(this.backdropScale=t,this.renderer.setWallpaperScale(t)&&!this.renderer.hasLiveBackdrop()&&this.renderer.refreshWallpapers(!0),this.markBackdropDirty(),i&&this.render(),this)}async loadBackdrop(e,i={}){let t=await ne(e);return this.setBackdrop(t,{...i,update:i.update??"static"})}updateBackdrop(e=!0){this.renderer.refreshWallpapers(!0);let i=globalThis.performance?.now?.()??Date.now(),t=i-this.lastManualBackdropUpdate<ce;return this.lastManualBackdropUpdate=i,t&&this.lightProbeWorker()?(this.backdropDirty=!0,this.lightFieldAsyncDirty=!0,this.markDirty()):this.markBackdropDirty(),e&&this.render(),this}setWallpaperIndex(e,i=!0){return this.wallpaperIndex=Math.max(0,Math.floor(e)),this.markBackdropDirty(),i&&this.render(),this}distanceAt(e,i){return ae(e,i,this.elements,this.material)}hitTest(e,i,t={}){return oe(e,i,this.elements,this.material,t)}pointerPosition(e){let i=this.canvas.getBoundingClientRect(),t=e.touches?.[0]??e.changedTouches?.[0]??e;return{x:t.clientX-i.left,y:t.clientY-i.top}}hitTestEvent(e,i={}){let{x:t,y:n}=this.pointerPosition(e),r=i.tolerance??(e.pointerType&&e.pointerType!=="mouse"?8:0);return this.hitTest(t,n,{...i,tolerance:r})}start(){if(this.running)return this;if(typeof globalThis.requestAnimationFrame!="function")throw new Error("LiquidGlassWebGLV2.start() requires requestAnimationFrame.");this.running=!0;let e=()=>{this.running&&(this.render(),this.animationFrame=globalThis.requestAnimationFrame(e))};return this.animationFrame=globalThis.requestAnimationFrame(e),this}stop(){return this.running=!1,this.animationFrame&&typeof globalThis.cancelAnimationFrame=="function"&&globalThis.cancelAnimationFrame(this.animationFrame),this.animationFrame=0,this}resize(e=this.canvas.clientWidth||this.canvas.width||1,i=this.canvas.clientHeight||this.canvas.height||1,t=Math.min(globalThis.devicePixelRatio||1,2)){return this.renderer.resize(Math.round(e*t),Math.round(i*t)),{width:e,height:i,dpr:t}}probeSource(){return this.renderer.probeSource(this.wallpaperIndex)??this.backdrops[this.wallpaperIndex]}updateLightField(){this.lightFieldDirty=!1,this.lightProbeId+=1,this.lightProbeQueued=!1;let e=this.probeSource(),[i,t]=le(e);if(!(i>0)||!(t>0)||typeof document>"u"){this.lightPixels=null;return}this.lightCanvas||(this.lightCanvas=document.createElement("canvas"));let n=this.lightSampleSize;this.lightCanvas.width=n,this.lightCanvas.height=n;let r=this.lightCanvas.getContext("2d",{willReadFrequently:!0});if(!r){this.lightPixels=null;return}r.clearRect(0,0,n,n);let o=he(i,t,n,this.wallpaperZoom);try{r.drawImage(e,o.x,o.y,o.width,o.height),this.lightPixels=r.getImageData(0,0,n,n).data}catch{this.lightPixels=null}}lightProbeWorker(){if(this.lightWorker||this.lightWorkerUnavailable)return this.lightWorker;if(typeof globalThis.Worker!="function"||typeof globalThis.OffscreenCanvas!="function"||typeof globalThis.createImageBitmap!="function"||typeof globalThis.Blob!="function"||typeof globalThis.URL?.createObjectURL!="function")return this.lightWorkerUnavailable=!0,null;let e="",i=()=>{e&&globalThis.URL.revokeObjectURL(e),e=""};try{e=globalThis.URL.createObjectURL(new globalThis.Blob([_e],{type:"text/javascript"})),this.lightWorker=new globalThis.Worker(e)}catch{return i(),this.lightWorkerUnavailable=!0,null}let t=()=>{this.lightWorker?.terminate(),this.lightWorker=null,this.lightWorkerUnavailable=!0,this.lightProbePending=!1,this.lightFieldDirty=!0,this.markDirty()};return this.lightWorker.onerror=()=>{i(),t()},this.lightWorker.onmessage=({data:n})=>{if(i(),this.lightProbePending=!1,!n.pixels){t();return}n.id===this.lightProbeId&&(this.lightPixels=n.pixels,this.markDirty(),this.lightProbeQueued&&(this.lightProbeQueued=!1,this.requestLightField({queue:!0})),this.renderer.hasLiveBackdrop()||this.scheduleSettledRender())},this.lightWorker}requestLightField({queue:e=!1}={}){if(this.lightProbePending)return e&&(this.lightProbeQueued=!0),!0;let i=this.probeSource(),[t,n]=le(i);if(!(t>0)||!(n>0)||!this.lightProbeWorker())return!1;let r=++this.lightProbeId,o=this.lightSampleSize,h=he(t,n,o,this.wallpaperZoom);return this.lightProbePending=!0,globalThis.createImageBitmap(i).then(s=>{if(r!==this.lightProbeId||!this.lightWorker){s.close(),r===this.lightProbeId&&(this.lightProbePending=!1);return}this.lightWorker.postMessage({id:r,bitmap:s,size:o,...h},[s])},()=>{r===this.lightProbeId&&(this.lightProbePending=!1)}),!0}scheduleSettledRender(){this.settledRenderFrame||typeof globalThis.requestAnimationFrame!="function"||(this.settledRenderFrame=globalThis.requestAnimationFrame(()=>{this.settledRenderFrame=0,this.dirty&&this.render({dpr:this.lastFrame.dpr||void 0})}))}sampleLuminance(e,i){if(!this.lightPixels)return .5;let t=this.lightSampleSize,n=Math.max(0,Math.min(t-1,Math.round(e*(t-1)))),o=(Math.max(0,Math.min(t-1,Math.round(i*(t-1))))*t+n)*4;return(this.lightPixels[o]*.2126+this.lightPixels[o+1]*.7152+this.lightPixels[o+2]*.0722)/255}lightDirection(e,i,t,n){let r=[-.34,0,.34],o=0,h=0;for(let d of r)for(let g of r){let L=(e.x+e.w*(.5+g))/Math.max(i,1),u=(e.y+e.h*(.5+d))/Math.max(t,1),y=this.sampleLuminance(L,u);o+=g*y,h+=d*y}let s=n*Math.PI/180,l=Math.cos(s),m=Math.sin(s),c=Math.hypot(o,h)/r.length;if(c<.008)return[l,m];let f=Math.hypot(o,h)||1,S=-o/f,b=h/f,T=Math.max(0,Math.min(1,(c-.015)/.13)),R=T*T*(3-2*T)*.58,k=l*(1-R)+S*R,E=m*(1-R)+b*R,A=Math.hypot(k,E)||1;return[k/A,E/A]}tintLightForElement(e,i,t){if(e.tintTone==="light")return 1;if(e.tintTone==="dark")return 0;let n=[-24,0,24],r=e.x+e.w*.5,o=e.y+e.h*.5,h=0;for(let m of n)for(let c of n){let f=(r+c)/Math.max(i,1),S=(o+m)/Math.max(t,1);h+=this.sampleLuminance(f,S)}let s=h/(n.length*n.length),l=Math.max(0,Math.min(1,(s-.22)/(.5-.22)));return l*l*(3-2*l)}render(e={}){if(this.renderer.lost)return this;let i=this.canvas.clientWidth||this.canvas.width||1,t=this.canvas.clientHeight||this.canvas.height||1,n=Number(e.dpr??globalThis.devicePixelRatio??1),r=Math.max(.5,Math.min(Number.isFinite(n)?n:1,2)),o=i!==this.lastFrame.width||t!==this.lastFrame.height||r!==this.lastFrame.dpr,h=this.renderer.hasLiveBackdrop();if(!e.force&&!this.dirty&&!o&&!h)return this;this.resize(i,t,r);let s=ke(this.elements.filter(d=>d.w>0&&d.h>0));if(this.compositeMode==="overlay"&&!s.length)return this.renderer.clearOutput(),o&&(this.pyramidStale=!0),this.dirty=!1,this.lastFrame={width:i,height:t,dpr:r},this;let l=globalThis.performance?.now?.()??Date.now(),m=this.backdropDirty||o||h;if((m||this.pyramidStale)&&(this.renderer.buildBackdrop(this.wallpaperIndex,this.wallpaperZoom),this.pyramidStale=!1),m){let d=h&&l-this.lastLightFieldUpdate>=ce;if(this.lightFieldDirty||o)this.updateLightField(),this.lastLightFieldUpdate=l;else if(d||this.lightFieldAsyncDirty){let g=this.lightFieldAsyncDirty;this.lightFieldAsyncDirty=!1,this.requestLightField({queue:g})||this.updateLightField(),this.lastLightFieldUpdate=l}this.backdropDirty=!1}this.compositeMode==="overlay"?this.renderer.clearOutput():this.renderer.drawBackdrop();let c=this.effectiveMaterial,f=s.flat(),S=this.lastLightBlendTime?Math.min(100,l-this.lastLightBlendTime):100,b=h?1-Math.exp(-S/280):1,T=new Set(f.map(d=>d.id));for(let d of this.smoothedLightDirections.keys())T.has(d)||this.smoothedLightDirections.delete(d);let R=f.map(d=>{let g=this.lightDirection(d,i,t,c.lightAngle),L=this.smoothedLightDirections.get(d.id);if(!L||b>=1)return this.smoothedLightDirections.set(d.id,g),g;let u=L[0]*(1-b)+g[0]*b,y=L[1]*(1-b)+g[1]*b,M=Math.hypot(u,y)||1,F=[u/M,y/M];return this.smoothedLightDirections.set(d.id,F),F}),k=f.map(d=>this.tintLightForElement(d,i,t));this.lastLightBlendTime=l,s.some(d=>d.length>16)&&!this.warnedShapeLimit&&(this.warnedShapeLimit=!0,console.warn(`LiquidGlassWebGLV2: more than ${16} shapes require multiple passes; overlapping shapes across a pass boundary may composite differently.`));let E=(d,g,L)=>{for(let u=0;u<d.length;u+=16)this.renderer.drawGlassV2Group(d.slice(u,u+16),c,r,R.slice(g+u,g+u+16),k.slice(g+u,g+u+16),{intoBackdrop:L})},A=0;return s.forEach((d,g)=>{E(d,A,!1),g<s.length-1&&this.renderer.beginBackdropLayer()&&(E(d,A,!0),this.renderer.commitBackdropLayer(),this.pyramidStale=!0),A+=d.length}),this.dirty=!1,this.lastFrame={width:i,height:t,dpr:r},this}destroy(){this.stop(),this.lightProbeId+=1,this.settledRenderFrame&&typeof globalThis.cancelAnimationFrame=="function"&&globalThis.cancelAnimationFrame(this.settledRenderFrame),this.settledRenderFrame=0,this.lightWorker?.terminate(),this.lightWorker=null,this.lightProbePending=!1,this.canvas.removeEventListener("webglcontextlost",this.handleContextLost,!1),this.canvas.removeEventListener("webglcontextrestored",this.handleContextRestored,!1),this.reducedTransparencyQuery?.removeEventListener?.("change",this.handleReducedTransparencyChange),this.resizeObserver?.disconnect(),this.resizeObserver=null,this.renderer.destroy(),this.elements=[],this.backdrops=[],this.lightPixels=null,this.lightCanvas=null,this.smoothedLightDirections.clear()}};function ue(){let a=document.querySelector(".filter-stage"),e=document.querySelector("#glass-nav"),i,t=0,n,r=matchMedia("(prefers-reduced-motion: reduce)"),o=()=>{cancelAnimationFrame(t),a.classList.remove("glass-ready"),e.hidden=!0};if(matchMedia("(forced-colors: active), (prefers-reduced-transparency: reduce)").matches||!C.isSupported())return()=>{};try{e.hidden=!1,i=new C(e,{autoStart:!1,autoResize:!1,compositeMode:"replace",backdropUpdate:"static",material:{refraction:.025,dispersion:.015,frost:.02,body:.2,tint:.08,roundness:15},onContextLost:o,onContextRestored:()=>{e.hidden=!1,a.classList.add("glass-ready"),l()}}),a.classList.add("glass-ready")}catch{return o(),()=>{}}let h=()=>{let c=document.querySelector("#filters button[aria-pressed=true]");return c?{x:c.offsetLeft,y:c.offsetTop,w:c.offsetWidth,h:c.offsetHeight}:null};function s(c){!c||i.contextLost||(i.setElements([{id:"selected",shape:"pill",...c}],!1),i.render())}function l(){let c=a.clientWidth,f=a.clientHeight,S=document.createElement("canvas");S.width=c,S.height=f;let b=S.getContext("2d"),T=b.createLinearGradient(0,0,c,f);T.addColorStop(0,"#e7eff8"),T.addColorStop(.5,"#f5f7fa"),T.addColorStop(1,"#e7eff4"),b.fillStyle=T,b.fillRect(0,0,c,f),i.resize(c,f,Math.min(devicePixelRatio,2)),i.setBackdrop(S,{update:"static",autoStart:!1,shouldRender:!1}),n=h(),s(n)}return new ResizeObserver(l).observe(a),l(),window.addEventListener("pagehide",()=>{cancelAnimationFrame(t),i.stop()}),window.addEventListener("pageshow",l),()=>{cancelAnimationFrame(t);let c=h();if(!c)return;if(r.matches||!n){n=c,s(c);return}let f={...n},S=performance.now(),b=T=>{let R=Math.min(1,(T-S)/230),k=1-(1-R)**3;n=Object.fromEntries(Object.keys(c).map(E=>[E,f[E]+(c[E]-f[E])*k])),s(n),R<1&&(t=requestAnimationFrame(b))};t=requestAnimationFrame(b)}}var x=a=>document.getElementById(a),pe=[["all","\u5168\u90E8\u754C\u9762","\u4ECE\u9996\u9875\u5230\u901A\u5173\u8865\u7ED9\uFF0C\u6309\u754C\u9762\u67E5\u770B\u5165\u53E3\u3001\u64CD\u4F5C\u3001\u72B6\u6001\u548C\u52A8\u6548\u3002"],["home","\u4E3B\u9875","\u5F00\u59CB\u3001\u7EE7\u7EED\u6E38\u620F\u4E0E\u8BBE\u7F6E\u3002\u97F3\u91CF\u63A7\u5236\u96C6\u4E2D\u5728\u8BBE\u7F6E\u4E2D\u3002"],["play","\u5C40\u5185\u64CD\u4F5C","\u67E5\u770B\u751F\u547D\u3001\u5F97\u5206\u548C\u6295\u653E\u6B21\u6570\uFF1B\u4F7F\u7528\u9053\u5177\uFF0C\u8C03\u6574\u5FEB\u6377\u680F\u4E0E\u6682\u5B58\u987A\u5E8F\u3002"],["guide","\u56FE\u9274\u4E0E\u89C4\u5219","\u901A\u8FC7\u6F14\u793A\u548C\u6548\u679C\u8BF4\u660E\u4E86\u89E3\u9053\u5177\u4E0E\u7279\u6B8A\u65B9\u5757\uFF0C\u67E5\u770B\u6295\u653E\u4E0E\u6D88\u9664\u89C4\u5219\u3002"],["rewards","\u901A\u5173\u4E0E\u8865\u7ED9","\u5148\u7ED3\u7B97\u91D1\u5E01\uFF0C\u518D\u8FDB\u5165\u8865\u7ED9\u7AD9\u9886\u53D6\u9053\u5177\u6216\u7279\u6B8A\u65B9\u5757\u3002"],["shop","\u5546\u5E97","\u7B5B\u9009\u5546\u54C1\uFF0C\u67E5\u770B\u6548\u679C\u548C\u6301\u6709\u6570\u91CF\uFF0C\u8D2D\u4E70\u540E\u66F4\u65B0\u91D1\u5E01\u4E0E\u4EF7\u683C\u3002"],["recovery","\u5931\u8D25\u4E0E\u590D\u6D3B","\u6295\u653E\u6B21\u6570\u7528\u5C3D\u540E\uFF0C\u53EF\u89C2\u770B\u5E7F\u544A\u590D\u6D3B\u6216\u91CD\u65B0\u5F00\u59CB\u3002"]],fe=[],_=[],D=0,me,ge=()=>{};function B(a,e){x(a).textContent=e}function z(a){D=a;let e=_[a];B("viewer-title",e.title),B("viewer-description",e.description),B("viewer-entry",e.entry),B("viewer-state",e.state),B("viewer-motion",e.motion),B("viewer-position",`${a+1} / ${_.length}`),x("viewer-image").src=e.image,x("viewer-image").alt=e.title,x("original-image").href=e.image,x("viewer-actions").closest("section").hidden=e.actions.length===0,x("viewer-actions").replaceChildren(...(e.buttons||e.actions.map(i=>({label:i}))).map(i=>{let t=document.createElement("li");return t.textContent=i.effect?`${i.label}\uFF1A${i.effect}`:i.label,t})),x("previous-screen").disabled=a===0,x("next-screen").disabled=a===_.length-1,document.querySelector(".viewer-body").scrollTop=0}function de(a){let e=pe.find(i=>i[0]===a);_=fe.filter(i=>a==="all"||i.group===a),B("group-title",e[1]),B("group-summary",e[2]),B("count",`${_.length} \u5F20\u754C\u9762`),document.querySelectorAll("#filters button").forEach(i=>i.setAttribute("aria-pressed",String(i.dataset.group===a))),x("screens").replaceChildren(..._.map((i,t)=>{let n=document.createElement("button");n.className="screen-card",n.type="button",n.setAttribute("aria-label",`\u67E5\u770B${i.title}\u7684\u622A\u56FE\u4E0E\u8BF4\u660E`);let r=document.createElement("span");r.className="image-frame";let o=new Image;o.src=i.image,o.alt=i.title,o.width=390,o.height=844,o.loading=t<5?"eager":"lazy",o.decoding="async",r.append(o),n.append(r);for(let[h,s]of[["card-title",i.title],["card-description",i.description]]){let l=document.createElement("span");l.className=h,l.textContent=s,n.append(l)}return n.addEventListener("click",()=>{me=n,z(t),x("viewer").showModal()}),n})),ge()}x("close-viewer").addEventListener("click",()=>x("viewer").close());x("viewer").addEventListener("close",()=>me?.focus());x("viewer").addEventListener("click",a=>{if(a.target!==x("viewer"))return;let e=x("viewer").getBoundingClientRect();(a.clientX<e.left||a.clientX>e.right||a.clientY<e.top||a.clientY>e.bottom)&&x("viewer").close()});x("previous-screen").addEventListener("click",()=>z(D-1));x("next-screen").addEventListener("click",()=>z(D+1));x("viewer").addEventListener("keydown",a=>{a.key==="ArrowLeft"&&D>0&&(a.preventDefault(),z(D-1)),a.key==="ArrowRight"&&D<_.length-1&&(a.preventDefault(),z(D+1))});try{let a=await fetch("./data/screens.json");if(!a.ok)throw Error("screens");fe=await a.json();for(let[e,i]of pe){let t=document.createElement("button");t.type="button",t.dataset.group=e,t.textContent=i,t.addEventListener("click",()=>de(e)),x("filters").append(t)}de("all"),ge=ue()}catch(a){x("load-error").hidden=!1,B("count","\u622A\u56FE\u8F7D\u5165\u5931\u8D25"),console.error(a)}

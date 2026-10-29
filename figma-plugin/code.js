"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // plugin/src/serializer.ts
  var PLAIN_KEYS, isPlain, isRecord, numberOr, rgbaOf, isShown, paintOf, effectOf, shownList, stub, readNode, serialize, serializeNode;
  var init_serializer = __esm({
    "plugin/src/serializer.ts"() {
      "use strict";
      PLAIN_KEYS = [
        "opacity",
        "layoutMode",
        "layoutSizingHorizontal",
        "layoutSizingVertical",
        "layoutPositioning",
        "layoutWrap",
        "primaryAxisSizingMode",
        "counterAxisSizingMode",
        "primaryAxisAlignItems",
        "counterAxisAlignItems",
        "itemSpacing",
        "counterAxisSpacing",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "minWidth",
        "maxWidth",
        "minHeight",
        "maxHeight",
        "clipsContent",
        "isMask",
        "blendMode",
        "strokeWeight",
        "strokeTopWeight",
        "strokeRightWeight",
        "strokeBottomWeight",
        "strokeLeftWeight",
        "strokeAlign",
        "cornerRadius",
        "topLeftRadius",
        "topRightRadius",
        "bottomLeftRadius",
        "bottomRightRadius",
        "fontSize",
        "fontWeight",
        "textAlignHorizontal",
        "textAlignVertical",
        "textAutoResize",
        "textCase"
      ];
      isPlain = (value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean";
      isRecord = (value) => typeof value === "object" && value !== null;
      numberOr = (value, fallback) => typeof value === "number" ? value : fallback;
      rgbaOf = (value) => {
        const color = isRecord(value) ? value : {};
        return { r: numberOr(color.r, 0), g: numberOr(color.g, 0), b: numberOr(color.b, 0), a: numberOr(color.a, 1) };
      };
      isShown = (item) => isRecord(item) && item.visible !== false;
      paintOf = (paint) => {
        const data = { type: String(paint.type), opacity: numberOr(paint.opacity, 1) };
        if (paint.type === "SOLID")
          data.color = rgbaOf(paint.color);
        if (typeof paint.blendMode === "string" && paint.blendMode !== "NORMAL")
          data.blendMode = paint.blendMode;
        if (Array.isArray(paint.gradientStops)) {
          data.gradientStops = paint.gradientStops.map((stop) => {
            const item = isRecord(stop) ? stop : {};
            return { position: numberOr(item.position, 0), color: rgbaOf(item.color) };
          });
          if (Array.isArray(paint.gradientTransform))
            data.gradientTransform = paint.gradientTransform.map((row) => row.slice());
        }
        if (paint.type === "IMAGE") {
          if (typeof paint.imageHash === "string")
            data.imageHash = paint.imageHash;
          if (typeof paint.scaleMode === "string")
            data.scaleMode = paint.scaleMode;
        }
        return data;
      };
      effectOf = (effect) => {
        const data = { type: String(effect.type), opacity: numberOr(effect.opacity, 1) };
        if (typeof effect.radius === "number")
          data.blurRadius = effect.radius;
        if (isRecord(effect.offset))
          data.offset = { x: numberOr(effect.offset.x, 0), y: numberOr(effect.offset.y, 0) };
        if (isRecord(effect.color))
          data.color = rgbaOf(effect.color);
        if (typeof effect.spread === "number")
          data.spread = effect.spread;
        return data;
      };
      shownList = (value, convert) => {
        if (!Array.isArray(value))
          return void 0;
        const list = value.filter(isShown).map(convert);
        return list.length ? list : void 0;
      };
      stub = (node) => {
        var _a, _b, _c;
        return { id: String((_a = node.id) != null ? _a : ""), name: String((_b = node.name) != null ? _b : ""), type: String((_c = node.type) != null ? _c : "UNKNOWN"), visible: true, width: 0, height: 0, x: 0, y: 0 };
      };
      readNode = (node) => {
        var _a, _b, _c, _d, _e;
        const data = {
          id: String((_a = node.id) != null ? _a : ""),
          name: String((_b = node.name) != null ? _b : ""),
          type: String((_c = node.type) != null ? _c : ""),
          visible: node.visible !== false,
          width: numberOr(node.width, 0),
          height: numberOr(node.height, 0),
          x: numberOr(node.x, 0),
          y: numberOr(node.y, 0)
        };
        PLAIN_KEYS.forEach((key) => {
          const value = node[key];
          if (isPlain(value))
            data[key] = value;
        });
        if (data.layoutMode === "NONE")
          delete data.layoutMode;
        const fills = shownList(node.fills, paintOf);
        if (fills)
          data.fills = fills;
        const strokes = shownList(node.strokes, paintOf);
        if (strokes)
          data.strokes = strokes;
        const effects = shownList(node.effects, effectOf);
        if (effects)
          data.effects = effects;
        if (Array.isArray(node.dashPattern) && node.dashPattern.length)
          data.dashPattern = node.dashPattern.map(Number);
        if (isRecord(node.constraints))
          data.constraints = { horizontal: String((_d = node.constraints.horizontal) != null ? _d : "LEFT"), vertical: String((_e = node.constraints.vertical) != null ? _e : "TOP") };
        if (typeof node.rotation === "number" && node.rotation !== 0)
          data.rotation = node.rotation;
        if (node.type === "TEXT") {
          if (typeof node.characters === "string")
            data.characters = node.characters;
          if (isRecord(node.fontName)) {
            data.fontFamily = String(node.fontName.family);
            data.italic = String(node.fontName.style).toLowerCase().includes("italic");
          }
          if (isRecord(node.letterSpacing))
            data.letterSpacing = { value: numberOr(node.letterSpacing.value, 0), unit: String(node.letterSpacing.unit) };
          if (isRecord(node.lineHeight)) {
            data.lineHeight = node.lineHeight.unit === "AUTO" ? { unit: "AUTO" } : { value: numberOr(node.lineHeight.value, 0), unit: String(node.lineHeight.unit) };
          }
          if (typeof node.textDecoration === "string" && node.textDecoration !== "NONE")
            data.textDecoration = node.textDecoration;
        }
        if (Array.isArray(node.children))
          data.children = node.children.map((child) => serialize(child));
        return data;
      };
      serialize = (node) => {
        try {
          return readNode(node);
        } catch (error) {
          console.error("[Plugin] Serialization error:", error);
          return stub(node);
        }
      };
      serializeNode = (node) => serialize(node);
    }
  });

  // plugin/src/gradient.ts
  var gradientAngle, backThrough, gradientHandles;
  var init_gradient = __esm({
    "plugin/src/gradient.ts"() {
      "use strict";
      gradientAngle = (transform, box) => {
        const [[a, b], [c, d]] = transform;
        const det = a * d - b * c;
        if (!det)
          return 180;
        const degrees = Math.atan2(d / det * box.width, -(-c / det * box.height)) * 180 / Math.PI;
        return Math.round((degrees + 360) % 360);
      };
      backThrough = (transform, x, y) => {
        const [[m00, m01, m02], [m10, m11, m12]] = transform;
        const det = m00 * m11 - m01 * m10;
        if (!det)
          return null;
        const dx = x - m02;
        const dy = y - m12;
        return [(m11 * dx - m01 * dy) / det, (-m10 * dx + m00 * dy) / det];
      };
      gradientHandles = (transform, box) => {
        const centre = backThrough(transform, 0.5, 0.5);
        const right = backThrough(transform, 1, 0.5);
        const down = backThrough(transform, 0.5, 1);
        if (!centre || !right || !down)
          return null;
        const across = [(right[0] - centre[0]) * box.width, (right[1] - centre[1]) * box.height];
        const below = [(down[0] - centre[0]) * box.width, (down[1] - centre[1]) * box.height];
        return {
          cx: centre[0],
          cy: centre[1],
          rx: Math.hypot(across[0], across[1]),
          ry: Math.hypot(below[0], below[1]),
          turn: Math.atan2(across[1], across[0]) * 180 / Math.PI
        };
      };
    }
  });

  // plugin/src/shared.ts
  var isMixed, round, hex2, shorten, visiblePaints, paintsOf, childrenOf, isFlow, EPSILON, matrixOf, isMirrored, isAxisAligned;
  var init_shared = __esm({
    "plugin/src/shared.ts"() {
      "use strict";
      isMixed = (value) => typeof value === "symbol";
      round = (value) => String(Math.round(value * 10) / 10);
      hex2 = (channel) => {
        const hex = Math.round(channel * 255).toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      };
      shorten = (hex) => /^(.)\1(.)\2(.)\3$/.test(hex) ? `${hex[0]}${hex[2]}${hex[4]}` : hex;
      visiblePaints = (paints) => isMixed(paints) ? null : paints.filter((paint) => paint.visible !== false);
      paintsOf = (node, key) => key in node ? node[key] : [];
      childrenOf = (node) => "children" in node ? node.children : [];
      isFlow = (node) => "layoutMode" in node && (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL");
      EPSILON = 1e-6;
      matrixOf = (node) => "relativeTransform" in node ? node.relativeTransform : null;
      isMirrored = (node) => {
        const matrix = matrixOf(node);
        return matrix !== null && matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0] < -EPSILON;
      };
      isAxisAligned = (matrix) => Math.abs(matrix[0][1]) < EPSILON && Math.abs(matrix[1][0]) < EPSILON;
    }
  });

  // plugin/src/css.ts
  var PLACEHOLDER, PLACEHOLDER_LOOK, BLUR_SCALE, JUSTIFY, ALIGN, TEXT_ALIGN, TEXT_CASE, TEXT_DECORATION, px, fine, cssColor, colorOfPaint, gradientLayer, layerOf, backgroundOf, hasFill, sideWeights, strokeLook, effectLook, radiusOf, composeOf, transformOf, appearanceOf, flowOf, positionRules, sizeRules, modesOf, limitsOf, paddingOf, gapOf, layoutOf, cssContainer, cssPlaceholder, cssTextBox, cssRunStyle;
  var init_css = __esm({
    "plugin/src/css.ts"() {
      "use strict";
      init_gradient();
      init_shared();
      PLACEHOLDER = "#e6e6e6";
      PLACEHOLDER_LOOK = `background:${PLACEHOLDER};outline:1px dashed #9a9a9a;outline-offset:-1px`;
      BLUR_SCALE = 0.425;
      JUSTIFY = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between" };
      ALIGN = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", BASELINE: "baseline" };
      TEXT_ALIGN = { CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" };
      TEXT_CASE = { UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize" };
      TEXT_DECORATION = { UNDERLINE: "underline", STRIKETHROUGH: "line-through" };
      px = (value) => `${round(value)}px`;
      fine = (value) => String(Math.round(value * 1e3) / 1e3);
      cssColor = (color, alpha) => {
        const rounded = Math.round(alpha * 100) / 100;
        if (rounded >= 1)
          return `#${shorten(`${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`)}`;
        return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${rounded})`;
      };
      colorOfPaint = (paint) => {
        var _a, _b;
        if (paint.type === "SOLID")
          return cssColor(paint.color, (_a = paint.opacity) != null ? _a : 1);
        if ("gradientStops" in paint && paint.gradientStops.length > 0)
          return cssColor(paint.gradientStops[0].color, paint.gradientStops[0].color.a * ((_b = paint.opacity) != null ? _b : 1));
        return PLACEHOLDER;
      };
      gradientLayer = (paint, box) => {
        const stops = paint.gradientStops.map((stop) => {
          var _a;
          return `${cssColor(stop.color, stop.color.a * ((_a = paint.opacity) != null ? _a : 1))} ${Math.round(stop.position * 100)}%`;
        }).join(",");
        if (paint.type === "GRADIENT_LINEAR")
          return `linear-gradient(${gradientAngle(paint.gradientTransform, box)}deg,${stops})`;
        const handles = gradientHandles(paint.gradientTransform, box);
        const at = handles ? ` at ${round(handles.cx * 100)}% ${round(handles.cy * 100)}%` : "";
        if (paint.type === "GRADIENT_RADIAL")
          return `radial-gradient(ellipse ${handles ? `${px(handles.rx)} ${px(handles.ry)}` : "farthest-corner"}${at},${stops})`;
        if (paint.type === "GRADIENT_ANGULAR")
          return `conic-gradient(from ${handles ? Math.round(((90 + handles.turn) % 360 + 360) % 360) : 0}deg${at},${stops})`;
        return `linear-gradient(${stops})`;
      };
      layerOf = (paint, box) => {
        var _a;
        if (paint.type === "SOLID")
          return cssColor(paint.color, (_a = paint.opacity) != null ? _a : 1);
        if ("gradientStops" in paint)
          return gradientLayer(paint, box);
        return PLACEHOLDER;
      };
      backgroundOf = (node) => {
        const paints = visiblePaints(paintsOf(node, "fills"));
        if (!paints || paints.length === 0)
          return [];
        const layers = paints.map((paint) => layerOf(paint, node)).reverse();
        const stacked = layers.map((layer, index) => index < layers.length - 1 && !layer.includes("gradient(") ? `linear-gradient(${layer},${layer})` : layer);
        return [`background:${stacked.join(",")}`];
      };
      hasFill = (node) => {
        var _a, _b;
        return ((_b = (_a = visiblePaints(paintsOf(node, "fills"))) == null ? void 0 : _a.length) != null ? _b : 0) > 0;
      };
      sideWeights = (node) => {
        if (!("strokeWeight" in node))
          return null;
        if (typeof node.strokeWeight === "number")
          return [node.strokeWeight, node.strokeWeight, node.strokeWeight, node.strokeWeight];
        if (!("strokeTopWeight" in node))
          return null;
        return [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight];
      };
      strokeLook = (node, look) => {
        const strokes = visiblePaints(paintsOf(node, "strokes"));
        const weights = sideWeights(node);
        if (!strokes || strokes.length === 0 || !weights)
          return;
        const color = colorOfPaint(strokes[strokes.length - 1]);
        const [top, right, bottom, left] = weights;
        const dashed = "dashPattern" in node && node.dashPattern.length > 0;
        if (node.type === "LINE") {
          look.extra.push(`border-top:${px(top)} ${dashed ? "dashed" : "solid"} ${color}`, "height:0");
          return;
        }
        const even = top === right && right === bottom && bottom === left;
        if (even && dashed) {
          look.extra.push(`border:${px(top)} dashed ${color}`);
          return;
        }
        if (even) {
          const align = "strokeAlign" in node ? node.strokeAlign : "INSIDE";
          if (align === "OUTSIDE")
            look.shadows.push(`0 0 0 ${px(top)} ${color}`);
          else if (align === "CENTER")
            look.shadows.push(`inset 0 0 0 ${px(top / 2)} ${color}`, `0 0 0 ${px(top / 2)} ${color}`);
          else
            look.shadows.push(`inset 0 0 0 ${px(top)} ${color}`);
          const paint = strokes[strokes.length - 1];
          if ("gradientStops" in paint)
            look.extra.push(`--figma-stroke:${px(top)} ${gradientLayer(paint, node)}`);
          return;
        }
        if (top)
          look.shadows.push(`inset 0 ${px(top)} 0 0 ${color}`);
        if (right)
          look.shadows.push(`inset ${px(-right)} 0 0 0 ${color}`);
        if (bottom)
          look.shadows.push(`inset 0 ${px(-bottom)} 0 0 ${color}`);
        if (left)
          look.shadows.push(`inset ${px(left)} 0 0 0 ${color}`);
      };
      effectLook = (node, look) => {
        if (!("effects" in node))
          return;
        const isText = node.type === "TEXT";
        const followsContent = !isText && !hasFill(node);
        node.effects.filter((effect) => effect.visible !== false).forEach((effect) => {
          var _a, _b;
          if (effect.type === "LAYER_BLUR")
            look.filters.push(`blur(${px(effect.radius * BLUR_SCALE)})`);
          else if (effect.type === "BACKGROUND_BLUR")
            look.backdrop.push(`blur(${px(effect.radius * BLUR_SCALE)})`);
          else if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
            const color = cssColor(effect.color, effect.color.a);
            const reach = `${px(effect.offset.x)} ${px(effect.offset.y)} ${px(effect.radius)}`;
            if (effect.type === "INNER_SHADOW")
              look.shadows.push(`inset ${reach} ${px((_a = effect.spread) != null ? _a : 0)} ${color}`);
            else if (isText)
              look.textShadows.push(`${reach} ${color}`);
            else if (followsContent)
              look.filters.push(`drop-shadow(${reach} ${color})`);
            else
              look.shadows.push(`${reach} ${px((_b = effect.spread) != null ? _b : 0)} ${color}`);
          }
        });
      };
      radiusOf = (node) => {
        if (node.type === "ELLIPSE")
          return ["border-radius:50%"];
        if (!("cornerRadius" in node))
          return [];
        if (typeof node.cornerRadius === "number")
          return node.cornerRadius ? [`border-radius:${px(node.cornerRadius)}`] : [];
        if (!("topLeftRadius" in node))
          return [];
        return [`border-radius:${[node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].map(px).join(" ")}`];
      };
      composeOf = (node) => {
        const out = [];
        if ("opacity" in node && node.opacity < 1)
          out.push(`opacity:${Math.round(node.opacity * 100) / 100}`);
        if ("blendMode" in node && node.blendMode !== "PASS_THROUGH" && node.blendMode !== "NORMAL")
          out.push(`mix-blend-mode:${node.blendMode.toLowerCase().replace(/_/g, "-")}`);
        if ("isMask" in node && node.isMask)
          out.push(`--figma-mask:${"maskType" in node ? node.maskType.toLowerCase() : "alpha"}`);
        return out;
      };
      transformOf = (node) => {
        const matrix = matrixOf(node);
        if (matrix !== null && isMirrored(node)) {
          if (!isAxisAligned(matrix)) {
            return [`transform:matrix(${[matrix[0][0], matrix[1][0], matrix[0][1], matrix[1][1], matrix[0][2], matrix[1][2]].map(fine).join(",")})`, "transform-origin:0 0"];
          }
          return [`transform:${[matrix[0][0] < 0 ? "scaleX(-1)" : "", matrix[1][1] < 0 ? "scaleY(-1)" : ""].filter(Boolean).join(" ")}`];
        }
        return "rotation" in node && Math.abs(node.rotation) > 0.05 ? [`transform:rotate(${round(-node.rotation)}deg)`, "transform-origin:0 0"] : [];
      };
      appearanceOf = (node, { fill, box }) => {
        const look = { shadows: [], filters: [], backdrop: [], textShadows: [], extra: [] };
        if (box)
          strokeLook(node, look);
        effectLook(node, look);
        return [
          ...fill ? backgroundOf(node) : [],
          ...box ? radiusOf(node) : [],
          ...look.shadows.length ? [`box-shadow:${look.shadows.join(",")}`] : [],
          ...look.filters.length ? [`filter:${look.filters.join(" ")}`] : [],
          ...look.backdrop.length ? [`backdrop-filter:${look.backdrop.join(" ")}`] : [],
          ...look.textShadows.length ? [`text-shadow:${look.textShadows.join(",")}`] : [],
          ...look.extra,
          ...composeOf(node),
          ...transformOf(node)
        ];
      };
      flowOf = (ctx) => ctx.parent !== null && "layoutMode" in ctx.parent && isFlow(ctx.parent) ? ctx.parent.layoutMode === "HORIZONTAL" ? "row" : "column" : null;
      positionRules = (node, ctx) => {
        if (ctx.place)
          return ["position:absolute", `left:${px(ctx.place.x)}`, `top:${px(ctx.place.y)}`];
        const matrix = matrixOf(node);
        return ctx.parent !== null && matrix !== null && isMirrored(node) && !isAxisAligned(matrix) ? ["position:absolute", "left:0", "top:0"] : [];
      };
      sizeRules = (node, ctx, isRoot, modes) => {
        const flow = flowOf(ctx);
        const rule = (axis, mode, length) => {
          if (isRoot || mode === "FIXED")
            return [`${axis}:${px(length)}`];
          if (mode === "HUG")
            return [];
          if (flow === null)
            return [`${axis}:100%`];
          const main = flow === "row" && axis === "width" || flow === "column" && axis === "height";
          return main ? ["flex:1 1 0", `min-${axis}:0`] : ["align-self:stretch"];
        };
        return [...rule("width", modes.x, node.width), ...rule("height", modes.y, node.height)];
      };
      modesOf = (node) => "layoutSizingHorizontal" in node ? { x: node.layoutSizingHorizontal, y: node.layoutSizingVertical } : { x: "FIXED", y: "FIXED" };
      limitsOf = (node) => {
        if (!("minWidth" in node))
          return [];
        const limits = [["min-width", node.minWidth], ["max-width", node.maxWidth], ["min-height", node.minHeight], ["max-height", node.maxHeight]];
        return limits.map(([name, value]) => value === null ? "" : `${name}:${px(value)}`).filter(Boolean);
      };
      paddingOf = (node) => {
        const pads = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
        if (!pads.some(Boolean))
          return [];
        const [top, right, bottom, left] = pads;
        if (top === right && right === bottom && bottom === left)
          return [`padding:${px(top)}`];
        return [`padding:${top === bottom && right === left ? `${px(top)} ${px(right)}` : pads.map(px).join(" ")}`];
      };
      gapOf = (node) => {
        const between = node.counterAxisSpacing;
        if (node.layoutWrap === "WRAP" && between !== null && between !== node.itemSpacing) {
          const [row, column] = node.layoutMode === "HORIZONTAL" ? [between, node.itemSpacing] : [node.itemSpacing, between];
          return [`gap:${px(row)} ${px(column)}`];
        }
        return node.itemSpacing ? [`gap:${px(node.itemSpacing)}`] : [];
      };
      layoutOf = (node, ctx) => {
        var _a;
        if (isFlow(node) && "layoutMode" in node) {
          return [
            "display:flex",
            `flex-direction:${node.layoutMode === "HORIZONTAL" ? "row" : "column"}`,
            ...node.layoutWrap === "WRAP" ? ["flex-wrap:wrap"] : [],
            ...gapOf(node),
            ...paddingOf(node),
            ...JUSTIFY[node.primaryAxisAlignItems] && node.primaryAxisAlignItems !== "MIN" ? [`justify-content:${JUSTIFY[node.primaryAxisAlignItems]}`] : [],
            `align-items:${(_a = ALIGN[node.counterAxisAlignItems]) != null ? _a : "flex-start"}`
          ];
        }
        return ctx.placedChildren && ctx.place === null ? ["position:relative"] : [];
      };
      cssContainer = (node, ctx, isRoot) => {
        if (node.type === "GROUP")
          return "display:contents";
        const clips = "clipsContent" in node && node.clipsContent && childrenOf(node).length > 0;
        return [
          ...positionRules(node, ctx),
          ...sizeRules(node, ctx, isRoot, modesOf(node)),
          ...limitsOf(node),
          ...layoutOf(node, ctx),
          ...appearanceOf(node, { fill: true, box: true }),
          ...clips ? ["overflow:hidden"] : []
        ].join(";");
      };
      cssPlaceholder = (node, ctx, box) => [...positionRules(node, ctx), `width:${px(node.width)}`, `height:${px(node.height)}`, ...appearanceOf(node, { fill: false, box }), PLACEHOLDER_LOOK].join(";");
      cssTextBox = (node, ctx, isRoot) => {
        const resize = node.textAutoResize;
        const sizing = modesOf(node);
        const x = sizing.x === "FILL" ? "FILL" : resize === "WIDTH_AND_HEIGHT" ? "HUG" : "FIXED";
        const y = sizing.y === "FILL" ? "FILL" : resize === "WIDTH_AND_HEIGHT" || resize === "HEIGHT" ? "HUG" : "FIXED";
        const lines = node.characters.includes("\n");
        const space = resize === "WIDTH_AND_HEIGHT" ? [lines ? "white-space:pre" : "white-space:nowrap"] : resize === "TRUNCATE" ? ["white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"] : lines ? ["white-space:pre-wrap"] : [];
        const fixedHeight = resize === "NONE" || resize === "TRUNCATE";
        const down = fixedHeight && node.textAlignVertical !== "TOP" ? ["display:flex", "flex-direction:column", `justify-content:${node.textAlignVertical === "CENTER" ? "center" : "flex-end"}`] : [];
        const across = TEXT_ALIGN[node.textAlignHorizontal] ? [`text-align:${TEXT_ALIGN[node.textAlignHorizontal]}`] : [];
        return [...positionRules(node, ctx), ...sizeRules(node, ctx, isRoot, { x, y }), ...space, ...down, ...across, ...appearanceOf(node, { fill: false, box: false })].join(";");
      };
      cssRunStyle = (style, italic) => {
        const paints = visiblePaints(style.fills);
        const top = paints && paints.length ? paints[paints.length - 1] : null;
        const lineHeight = style.lineHeight.unit === "AUTO" ? "normal" : style.lineHeight.unit === "PIXELS" ? px(style.lineHeight.value) : `${round(style.lineHeight.value)}%`;
        const spacing = style.letterSpacing.value ? style.letterSpacing.unit === "PIXELS" ? px(style.letterSpacing.value) : `${fine(style.letterSpacing.value / 100)}em` : "";
        return [
          `font-size:${px(style.fontSize)}`,
          `font-weight:${style.fontWeight}`,
          `line-height:${lineHeight}`,
          spacing ? `letter-spacing:${spacing}` : "",
          top ? `color:${colorOfPaint(top)}` : "",
          italic ? "font-style:italic" : "",
          TEXT_DECORATION[style.textDecoration] ? `text-decoration:${TEXT_DECORATION[style.textDecoration]}` : "",
          TEXT_CASE[style.textCase] ? `text-transform:${TEXT_CASE[style.textCase]}` : "",
          style.textCase === "SMALL_CAPS" || style.textCase === "SMALL_CAPS_FORCED" ? "font-variant:small-caps" : ""
        ].filter(Boolean).join(";");
      };
    }
  });

  // plugin/src/outline.ts
  var seal, CHUNK_CHARS, ART_TYPES, TYPE_TAGS, DECORATIONS, CASES, TEXT_RESIZE, LEGEND_START, LEGEND_END, QUOTED, LEGEND_ENTRIES, placeholderIds, CSS_LEGEND, useCss, legendFor, isPresent, quote, withAlpha, describeGradient, describePaint, NO_BOX, describePaints, hasPaint, isImage, isAnyPaint, sizeOf, flexOf, dimsOf, describeFilling, isAutoLayout, positionOf, placeOf, pageAt, DEFAULT_NAME, nameOf, refOf, originOf, fine2, describeTransform, describeSizing, describeLimits, describeLayout, describeFill, describeStrokeWeight, describeDash, describeStroke, describeRadius, describeOpacity, describeBlend, describeMask, describeCompose, describeClip, describeEffect, describeEffects, describeLineHeight, describeLetterSpacing, describeTypeStyle, fontOf, isItalic, countFont, textNode, isArtLeaf, placeholder, hasOwnLook, build, renderLine, SAME, repeatLine, render, renderedChars, compress, countPlaceholders, weigh, sizeAt, planChunks, approxTokens, chunkChars, brief, renderManifest, renderChunk, describeFonts, outlineSelection;
  var init_outline = __esm({
    "plugin/src/outline.ts"() {
      "use strict";
      init_css();
      init_gradient();
      init_shared();
      seal = (draft, shape) => {
        var _a;
        return __spreadProps(__spreadValues({}, draft), {
          sig: `${shape}${(_a = draft.font) != null ? _a : ""}[${draft.children.map((child) => child.sig).join("|")}]`,
          texts: [...draft.tail ? [draft.tail.trim()] : [], ...draft.children.reduce((all, child) => all.concat(child.texts), [])]
        });
      };
      CHUNK_CHARS = 16e3;
      ART_TYPES = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON"]);
      TYPE_TAGS = {
        INSTANCE: "INST",
        COMPONENT: "COMP",
        COMPONENT_SET: "COMPSET",
        RECTANGLE: "RECT"
      };
      DECORATIONS = { UNDERLINE: " underline", STRIKETHROUGH: " strike" };
      CASES = { UPPER: " upper", LOWER: " lower", TITLE: " title", SMALL_CAPS: " small-caps", SMALL_CAPS_FORCED: " small-caps" };
      TEXT_RESIZE = { HEIGHT: " wrap", NONE: " fixed", TRUNCATE: " ellipsis" };
      LEGEND_START = "# FrameLink outline (px). [n] = number of children, copies included. Frames clip unless noclip; groups never.";
      LEGEND_END = 'If one node looks incomplete, get_node_info(nodeId=<its @id>, format="json") returns its raw tree (large, never for a whole frame).';
      QUOTED = /"(?:[^"\\]|\\.)*"/g;
      LEGEND_ENTRIES = [
        { when: /^\s*\+\d+ copies/m, text: "+N copies = N more identical copies of the node above (same layout and style); each (...) holds that copy's texts in order, = meaning the same as the first copy." },
        { when: /^\s*IMG /m, text: "IMG = image/vector placeholder, same size. Draw it visibly: background #e6e6e6 with outline:1px dashed #9a9a9a;outline-offset:-1px." },
        { when: /~|\bhug[xy]\b|\bfill[xy]\b/, text: "~ = size set by content or siblings (hugx/hugy/fillx/filly); no size at all = both axes." },
        { when: / xy-?\d/, text: "xy = position in parent, only where auto-layout does not place it (group children: from the nearest frame above)." },
        { when: / at-?\d/, text: "at = page position of a selected root." },
        { when: / rot-?\d/, text: "rot = clockwise degrees about the top-left (xy is where that corner lands)." },
        { when: / flip[xy]| matrix\(/, text: "flipx/flipy = mirrored; matrix(a,b,c,d,tx,ty) = CSS matrix, origin 0 0, replaces xy/rot." },
        { when: / (row|col)\b/, text: "row/col = auto-layout direction; gap, pad (t/r/b/l), align (main/cross axis)." },
        { when: / flexwrap/, text: "flexwrap = wraps onto new rows, rowgapN = space between rows." },
        { when: / (min|max)[wh]\d/, text: "minw/maxw/minh/maxh = size limits." },
        { when: /fill:|stroke:/, text: "fill/stroke = #hex[@alpha] or img." },
        { when: /linear-grad\(/, text: "linear-grad(angle stops), stops are color pos%." },
        { when: /radial-grad\(/, text: "radial-grad(at cx%,cy% rx,ry [rot deg] stops) = an ellipse; radii in px." },
        { when: /angular-grad\(/, text: "angular-grad(at cx%,cy% fromNdeg stops) = conic, clockwise." },
        { when: /stroke:/, text: "stroke = color/width (t/r/b/l if sides differ), inside unless stroke-center/stroke-outside, dashN,M = dashed." },
        { when: / r\d/, text: "r = radius (tl/tr/br/bl if mixed)." },
        { when: / fx:/, text: "fx = shadow(x y blur spread color) | inner-shadow(...) | blur(r) | bg-blur(r)." },
        { when: /dropshadow\(/, text: "dropshadow = CSS filter drop-shadow: follows the content, not the box." },
        { when: /(?:fx:|;)(?:bg-)?blur\(/, text: `blur(r) and bg-blur(r) give Figma's blur radius; in CSS use blur(${BLUR_SCALE} x r px), and backdrop-filter for bg-blur.` },
        { when: / blend:/, text: "blend:mode = mix-blend-mode." },
        { when: / mask\b/, text: "mask = not drawn, clips the siblings listed after it." },
        { when: / op\d/, text: "op = opacity." },
        { when: /^\s*TEXT /m, text: "TEXT = size/lineHeight wWeight ls=letterSpacing, underline/strike/upper/lower/title; wrap = wraps at width, fixed = fixed box, ellipsis = truncated, none of these = hugs, never wraps (\\n = line break)." },
        { when: / t[av]:/, text: "ta/tv = text align (tv only in fixed-height boxes)." },
        { when: /^\s*SPAN /m, text: "SPAN = a styled run inside mixed text." },
        { when: / font:/, text: "font:Name only where it differs from the default font in the summary." }
      ];
      placeholderIds = (root) => {
        const stats = { visited: 0, hidden: 0, fonts: {}, placeholders: /* @__PURE__ */ new Set() };
        build(root, stats, null, null);
        return stats.placeholders;
      };
      CSS_LEGEND = "# FrameLink css (px). Each line is a layer with its CSS declarations in {\u2026}, same tree as the outline. Assume box-sizing:border-box. position:absolute is relative to the nearest ancestor with position:relative, which is already set. Fill is background; strokes are inset or spread box-shadows because they take no layout room; image fills are #e6e6e6 placeholders. IMG = image/vector placeholder: size it exactly and keep the light fill and dashed outline it comes with, so it is visible. --figma-stroke:W gradient = a gradient stroke: draw it as an overlay (for example a ::before with that gradient as its background, cut to a W-wide inside ring with mask-composite:exclude); the box-shadow shows only its first colour. --figma-mask = not drawn, clips the siblings listed after it. [n] = number of children, copies included. +N copies = N more identical copies of the node above; each (...) holds that copy's texts in order, = meaning the same as the first copy. Text uses the default font in the summary unless font:Name is shown. " + LEGEND_END;
      useCss = (node) => {
        var _a;
        return __spreadProps(__spreadValues({}, node), { line: (_a = node.css) != null ? _a : node.line, children: node.children.map(useCss) });
      };
      legendFor = (lines) => {
        const bare = lines.map((line) => line.replace(QUOTED, '""')).join("\n");
        const used = LEGEND_ENTRIES.filter((entry) => entry.when.test(bare)).map((entry) => entry.text);
        return [LEGEND_START, ...used, LEGEND_END].join(" ");
      };
      isPresent = (value) => value !== null;
      quote = (text) => JSON.stringify(text);
      withAlpha = (color, alpha) => {
        const rounded = Math.round(alpha * 100) / 100;
        return `#${shorten(`${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`)}${rounded === 1 ? "" : `@${rounded}`}`;
      };
      describeGradient = (paint, box) => {
        var _a;
        const opacity = (_a = paint.opacity) != null ? _a : 1;
        const stops = paint.gradientStops.map((stop) => `${withAlpha(stop.color, stop.color.a * opacity)} ${Math.round(stop.position * 100)}%`).join(",");
        if (paint.type === "GRADIENT_LINEAR")
          return `linear-grad(${gradientAngle(paint.gradientTransform, box)}deg ${stops})`;
        const handles = gradientHandles(paint.gradientTransform, box);
        const centre = handles ? `at${round(handles.cx * 100)}%,${round(handles.cy * 100)}% ` : "";
        const wrapped = handles ? (handles.turn % 180 + 180) % 180 : 0;
        const turned = wrapped > 90 ? wrapped - 180 : wrapped;
        if (paint.type === "GRADIENT_RADIAL") {
          const radii = handles ? `r${round(handles.rx)},${round(handles.ry)} ` : "";
          return `radial-grad(${centre}${radii}${Math.abs(turned) > 1 ? `rot${round(turned)} ` : ""}${stops})`;
        }
        if (paint.type === "GRADIENT_ANGULAR") {
          return `angular-grad(${centre}${handles ? `from${Math.round(((90 + handles.turn) % 360 + 360) % 360)}deg ` : ""}${stops})`;
        }
        return `${paint.type.slice("GRADIENT_".length).toLowerCase()}-grad(${stops})`;
      };
      describePaint = (paint, box) => {
        var _a;
        if (paint.type === "SOLID")
          return withAlpha(paint.color, (_a = paint.opacity) != null ? _a : 1);
        if (paint.type === "IMAGE")
          return "img";
        if ("gradientStops" in paint)
          return describeGradient(paint, box);
        return paint.type.toLowerCase();
      };
      NO_BOX = { width: 1, height: 1 };
      describePaints = (paints, box = NO_BOX) => {
        const list = visiblePaints(paints);
        return list === null ? "mixed" : list.map((paint) => describePaint(paint, box)).join(",");
      };
      hasPaint = (paints, test) => {
        const list = visiblePaints(paints);
        return list !== null && list.some(test);
      };
      isImage = (paint) => paint.type === "IMAGE";
      isAnyPaint = () => true;
      sizeOf = (node) => `${round(node.width)}x${round(node.height)}`;
      flexOf = (node) => "layoutSizingHorizontal" in node ? { x: node.layoutSizingHorizontal !== "FIXED", y: node.layoutSizingVertical !== "FIXED" } : { x: false, y: false };
      dimsOf = (node, flexible) => flexible.x && flexible.y ? "" : ` ${flexible.x ? "~" : round(node.width)}x${flexible.y ? "~" : round(node.height)}`;
      describeFilling = (node) => "layoutSizingHorizontal" in node ? `${node.layoutSizingHorizontal === "FILL" ? " fillx" : ""}${node.layoutSizingVertical === "FILL" ? " filly" : ""}` : "";
      isAutoLayout = isFlow;
      positionOf = (node, parent) => {
        if (parent === null)
          return null;
        const absolute = "layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE";
        if (isAutoLayout(parent) && !absolute)
          return null;
        const matrix = matrixOf(node);
        if (matrix !== null && isMirrored(node)) {
          if (!isAxisAligned(matrix))
            return null;
          return { x: matrix[0][2] + Math.min(0, matrix[0][0]) * node.width, y: matrix[1][2] + Math.min(0, matrix[1][1]) * node.height };
        }
        return { x: node.x, y: node.y };
      };
      placeOf = (at) => at ? ` xy${round(at.x)},${round(at.y)}` : "";
      pageAt = (node) => {
        const [[, , x], [, , y]] = "absoluteTransform" in node ? node.absoluteTransform : [[0, 0, 0], [0, 0, 0]];
        return ` at${round(x)},${round(y)}`;
      };
      DEFAULT_NAME = /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Polygon|Star|Component|Instance|Slice) \d+$/;
      nameOf = (node) => DEFAULT_NAME.test(node.name) ? "" : `${quote(node.name)} `;
      refOf = (node) => `${nameOf(node)}@${node.id}`;
      originOf = (node) => {
        const [[, , x], [, , y]] = "absoluteTransform" in node ? node.absoluteTransform : [[0, 0, 0], [0, 0, 0]];
        return { ref: refOf(node), x, y };
      };
      fine2 = (value) => String(Math.round(value * 1e3) / 1e3);
      describeTransform = (node) => {
        const matrix = matrixOf(node);
        if (matrix !== null && isMirrored(node)) {
          if (!isAxisAligned(matrix))
            return ` matrix(${[matrix[0][0], matrix[1][0], matrix[0][1], matrix[1][1], matrix[0][2], matrix[1][2]].map(fine2).join(",")})`;
          return `${matrix[0][0] < 0 ? " flipx" : ""}${matrix[1][1] < 0 ? " flipy" : ""}`;
        }
        return "rotation" in node && Math.abs(node.rotation) > 0.05 ? ` rot${round(-node.rotation)}` : "";
      };
      describeSizing = (node) => {
        if (!("layoutSizingHorizontal" in node))
          return "";
        const parts = [];
        if (node.layoutSizingHorizontal !== "FIXED")
          parts.push(`${node.layoutSizingHorizontal.toLowerCase()}x`);
        if (node.layoutSizingVertical !== "FIXED")
          parts.push(`${node.layoutSizingVertical.toLowerCase()}y`);
        return parts.length ? ` ${parts.join(" ")}` : "";
      };
      describeLimits = (node) => {
        if (!("minWidth" in node))
          return "";
        const limits = [["minw", node.minWidth], ["maxw", node.maxWidth], ["minh", node.minHeight], ["maxh", node.maxHeight]];
        return limits.map(([name, value]) => value === null ? "" : ` ${name}${round(value)}`).join("");
      };
      describeLayout = (node) => {
        if (!("layoutMode" in node) || !isAutoLayout(node))
          return "";
        const parts = [node.layoutMode === "HORIZONTAL" ? "row" : "col"];
        if ("layoutWrap" in node && node.layoutWrap === "WRAP") {
          parts.push("flexwrap");
          if (node.counterAxisSpacing && node.counterAxisSpacing !== node.itemSpacing)
            parts.push(`rowgap${round(node.counterAxisSpacing)}`);
        }
        if (node.itemSpacing)
          parts.push(`gap${round(node.itemSpacing)}`);
        const pads = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
        if (pads.some(Boolean))
          parts.push(`pad${pads.map(round).join("/")}`);
        if (node.primaryAxisAlignItems !== "MIN" || node.counterAxisAlignItems !== "MIN") {
          parts.push(`align:${node.primaryAxisAlignItems}/${node.counterAxisAlignItems}`);
        }
        return ` ${parts.join(" ")}`;
      };
      describeFill = (node) => {
        const fills = describePaints(paintsOf(node, "fills"), node);
        return fills ? ` fill:${fills}` : "";
      };
      describeStrokeWeight = (node) => {
        if (!("strokeWeight" in node))
          return "";
        if (typeof node.strokeWeight === "number")
          return `/${round(node.strokeWeight)}`;
        if (!("strokeTopWeight" in node))
          return "";
        return `/${[node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight].map(round).join("/")}`;
      };
      describeDash = (node) => "dashPattern" in node && node.dashPattern.length ? ` dash${node.dashPattern.map(round).join(",")}` : "";
      describeStroke = (node) => {
        const strokes = describePaints(paintsOf(node, "strokes"), node);
        if (!strokes)
          return "";
        const align = "strokeAlign" in node && node.strokeAlign !== "INSIDE" && node.type !== "LINE" ? ` stroke-${node.strokeAlign.toLowerCase()}` : "";
        return ` stroke:${strokes}${describeStrokeWeight(node)}${align}${describeDash(node)}`;
      };
      describeRadius = (node) => {
        if (!("cornerRadius" in node))
          return "";
        if (typeof node.cornerRadius === "number")
          return node.cornerRadius ? ` r${round(node.cornerRadius)}` : "";
        if (!("topLeftRadius" in node))
          return "";
        const corners = [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius];
        return ` r${corners.map(round).join("/")}`;
      };
      describeOpacity = (node) => "opacity" in node && node.opacity < 1 ? ` op${Math.round(node.opacity * 100) / 100}` : "";
      describeBlend = (node) => "blendMode" in node && node.blendMode !== "PASS_THROUGH" && node.blendMode !== "NORMAL" ? ` blend:${node.blendMode.toLowerCase().replace(/_/g, "-")}` : "";
      describeMask = (node) => {
        if (!("isMask" in node) || !node.isMask)
          return "";
        return "maskType" in node && node.maskType !== "ALPHA" ? ` mask:${node.maskType.toLowerCase()}` : " mask";
      };
      describeCompose = (node) => `${describeOpacity(node)}${describeBlend(node)}${describeMask(node)}`;
      describeClip = (node) => "clipsContent" in node && node.clipsContent === false ? " noclip" : "";
      describeEffect = (effect, followsContent) => {
        var _a;
        if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
          const name = effect.type === "INNER_SHADOW" ? "inner-shadow" : followsContent ? "dropshadow" : "shadow";
          const values = [effect.offset.x, effect.offset.y, effect.radius, (_a = effect.spread) != null ? _a : 0].map(round).join(" ");
          return `${name}(${values} ${withAlpha(effect.color, effect.color.a)})`;
        }
        if (effect.type === "LAYER_BLUR")
          return `blur(${round(effect.radius)})`;
        if (effect.type === "BACKGROUND_BLUR")
          return `bg-blur(${round(effect.radius)})`;
        return "";
      };
      describeEffects = (node) => {
        if (!("effects" in node))
          return "";
        const followsContent = node.type !== "TEXT" && !hasPaint(paintsOf(node, "fills"), isAnyPaint);
        const effects = node.effects.filter((effect) => effect.visible !== false).map((effect) => describeEffect(effect, followsContent)).filter(Boolean);
        return effects.length ? ` fx:${effects.join(";")}` : "";
      };
      describeLineHeight = (lineHeight) => lineHeight.unit === "AUTO" ? "auto" : `${round(lineHeight.value)}${lineHeight.unit === "PERCENT" ? "%" : ""}`;
      describeLetterSpacing = (letterSpacing) => letterSpacing.value ? ` ls${round(letterSpacing.value)}${letterSpacing.unit === "PERCENT" ? "%" : ""}` : "";
      describeTypeStyle = (style) => {
        var _a, _b;
        const fill = describePaints(style.fills);
        const base = `${round(style.fontSize)}/${describeLineHeight(style.lineHeight)} w${style.fontWeight}`;
        const marks = `${(_a = DECORATIONS[style.textDecoration]) != null ? _a : ""}${(_b = CASES[style.textCase]) != null ? _b : ""}`;
        return `${base}${describeLetterSpacing(style.letterSpacing)}${marks}${fill ? ` fill:${fill}` : ""}`;
      };
      fontOf = (font) => `${font.family}${font.style.toLowerCase().includes("italic") ? "/italic" : ""}`;
      isItalic = (font) => font.style.toLowerCase().includes("italic");
      countFont = (stats, font) => {
        var _a;
        stats.fonts[font] = ((_a = stats.fonts[font]) != null ? _a : 0) + 1;
      };
      textNode = (node, place, stats, isRoot, ctx) => {
        var _a;
        const fixedHeight = node.textAutoResize === "NONE" || node.textAutoResize === "TRUNCATE";
        const across = node.textAlignHorizontal !== "LEFT" ? ` ta:${node.textAlignHorizontal}` : "";
        const down = fixedHeight && node.textAlignVertical !== "TOP" ? ` tv:${node.textAlignVertical}` : "";
        const align = `${across}${down}`;
        const flex = flexOf(node);
        const hugs = node.textAutoResize === "WIDTH_AND_HEIGHT";
        const dims = isRoot ? ` ${sizeOf(node)}` : dimsOf(node, { x: hugs || flex.x, y: hugs || node.textAutoResize === "HEIGHT" || flex.y });
        const box = `${dims}${place}${describeFilling(node)}${describeTransform(node)}${(_a = TEXT_RESIZE[node.textAutoResize]) != null ? _a : ""}${describeCompose(node)}${describeEffects(node)}`;
        const { fontSize, fontWeight, lineHeight, letterSpacing, fills, fontName, textDecoration, textCase } = node;
        if (typeof fontSize === "number" && typeof fontWeight === "number" && !isMixed(lineHeight) && !isMixed(letterSpacing) && !isMixed(fills) && !isMixed(fontName) && !isMixed(textDecoration) && !isMixed(textCase)) {
          const font = fontOf(fontName);
          countFont(stats, font);
          const style = describeTypeStyle({ fontSize, fontWeight, lineHeight, letterSpacing, fills, textDecoration, textCase });
          const line2 = `TEXT${box} ${style}${align}`;
          const css = `TEXT {${cssTextBox(node, ctx, isRoot)};${cssRunStyle({ fontSize, fontWeight, lineHeight, letterSpacing, fills, textDecoration, textCase }, isItalic(fontName))}}`;
          return seal({ kind: "text", children: [], font, line: line2, css, tail: ` ${quote(node.characters)}` }, line2);
        }
        const segments = node.getStyledTextSegments(["fontSize", "fontWeight", "lineHeight", "letterSpacing", "fills", "fontName", "textDecoration", "textCase"]);
        const children = segments.map((segment) => {
          const font = fontOf(segment.fontName);
          countFont(stats, font);
          const line2 = `SPAN ${describeTypeStyle(segment)}`;
          const css = `SPAN {${cssRunStyle(segment, isItalic(segment.fontName))}}`;
          return seal({ kind: "text", children: [], font, line: line2, css, tail: ` ${quote(segment.characters)}` }, line2);
        });
        const line = `TEXT${box} mixed${align}`;
        return seal({ kind: "text", children, line, css: `TEXT {${cssTextBox(node, ctx, isRoot)}}` }, line);
      };
      isArtLeaf = (node) => {
        if (ART_TYPES.has(node.type))
          return true;
        return hasPaint(paintsOf(node, "fills"), isImage) && childrenOf(node).length === 0;
      };
      placeholder = (node, place, ctx, stats) => {
        stats.placeholders.add(node.id);
        const shape = node.type === "ELLIPSE" ? " ellipse" : "";
        const box = ART_TYPES.has(node.type) ? "" : `${describeStroke(node)}${describeRadius(node)}`;
        const look = `${describeCompose(node)}${describeTransform(node)}${describeEffects(node)}`;
        const rest = `${sizeOf(node)}${place}${shape}${box}${look}`;
        const css = `IMG ${nameOf(node)}{${cssPlaceholder(node, ctx, !ART_TYPES.has(node.type))}}`;
        return seal({ kind: "placeholder", ref: refOf(node), children: [], line: `IMG ${nameOf(node)}${rest}`, css }, `IMG ${rest}`);
      };
      hasOwnLook = (node) => hasPaint(paintsOf(node, "fills"), isAnyPaint) || hasPaint(paintsOf(node, "strokes"), isAnyPaint) || describeRadius(node) !== "" || describeEffects(node) !== "";
      build = (node, stats, parent, parentOrigin, rootPlace = "") => {
        var _a;
        stats.visited += 1;
        if (!node.visible && parent !== null) {
          stats.hidden += 1;
          return null;
        }
        const at = positionOf(node, parent);
        const place = parent === null ? rootPlace : placeOf(at);
        const ctx = { parent, place: at, placedChildren: childrenOf(node).some((child) => child.visible && positionOf(child, node) !== null) };
        if (node.type === "TEXT")
          return textNode(node, place, stats, parent === null, ctx);
        if (isArtLeaf(node))
          return placeholder(node, place, ctx, stats);
        const origin = node.type === "GROUP" && parentOrigin ? parentOrigin : originOf(node);
        const children = childrenOf(node).map((child) => build(child, stats, node, origin)).filter(isPresent);
        const isIcon = children.length === 1 || !isAutoLayout(node);
        if (children.length > 0 && isIcon && !hasOwnLook(node) && children.every((child) => child.kind === "placeholder")) {
          return placeholder(node, place, ctx, stats);
        }
        const tag = (_a = TYPE_TAGS[node.type]) != null ? _a : node.type;
        const count = children.length ? ` [${children.length}]` : "";
        const dims = parent === null ? ` ${sizeOf(node)}` : dimsOf(node, flexOf(node));
        const style = `${describeFill(node)}${describeStroke(node)}${describeRadius(node)}${describeCompose(node)}${describeTransform(node)}${describeClip(node)}${describeEffects(node)}`;
        const rest = `${count}${dims}${place}${describeSizing(node)}${describeLimits(node)}${describeLayout(node)}${style}`;
        const css = `${tag} ${refOf(node)}${count} {${cssContainer(node, ctx, parent === null)}}`;
        return seal({ kind: "container", ref: refOf(node), origin, children, line: `${tag} ${refOf(node)}${rest}`, css }, `${tag}${rest}`);
      };
      renderLine = (node, defaultFont) => {
        var _a;
        const font = node.font && node.font !== defaultFont ? ` font:${node.font}` : "";
        return `${node.line}${font}${(_a = node.tail) != null ? _a : ""}`;
      };
      SAME = "=";
      repeatLine = (node) => {
        if (!node.repeat)
          return "";
        const differs = node.repeat.texts.some((texts) => texts.some((text) => text !== SAME));
        const tuples = differs ? node.repeat.texts.map((texts) => `(${texts.join(",")})`) : [];
        return `+${node.repeat.count} copies${tuples.length ? ` ${tuples.join(" ")}` : ""}`;
      };
      render = (node, depth, lines, defaultFont) => {
        lines.push(`${"  ".repeat(depth)}${renderLine(node, defaultFont)}`);
        node.children.forEach((child) => render(child, depth + 1, lines, defaultFont));
        if (node.repeat)
          lines.push(`${"  ".repeat(depth)}${repeatLine(node)}`);
      };
      renderedChars = (node) => {
        const out = [];
        render(node, 0, out, void 0);
        return out.join("\n").length + 1;
      };
      compress = (nodes) => {
        const out = [];
        let start = 0;
        while (start < nodes.length) {
          let end = start + 1;
          while (end < nodes.length && nodes[end].sig === nodes[start].sig)
            end += 1;
          const run = nodes.slice(start, end);
          const folded = __spreadProps(__spreadValues({}, run[0]), { repeat: { count: run.length - 1, texts: run.slice(1).map((copy) => copy.texts.map((text, index) => text === run[0].texts[index] ? SAME : text)) } });
          const saved = run.slice(1).reduce((sum, copy) => sum + renderedChars(copy), 0) - repeatLine(folded).length - 1;
          if (run.length > 1 && saved > 0)
            out.push(folded);
          else
            out.push(...run.map((node) => __spreadProps(__spreadValues({}, node), { children: compress(node.children) })));
          start = end;
        }
        return out;
      };
      countPlaceholders = (nodes) => nodes.reduce((sum, node) => sum + (node.kind === "placeholder" ? 1 : 0) + countPlaceholders(node.children), 0);
      weigh = (node, defaultFont, memo) => {
        const repeat = node.repeat ? repeatLine(node).length + 1 : 0;
        let chars = renderLine(node, defaultFont).length + 1 + repeat;
        let lines = node.repeat ? 2 : 1;
        node.children.forEach((child) => {
          var _a;
          weigh(child, defaultFont, memo);
          const weight = (_a = memo.get(child)) != null ? _a : { chars: 0, lines: 0 };
          chars += weight.chars + 2 * weight.lines;
          lines += weight.lines;
        });
        memo.set(node, { chars, lines });
      };
      sizeAt = (node, depth, memo) => {
        var _a;
        const weight = (_a = memo.get(node)) != null ? _a : { chars: 0, lines: 0 };
        return weight.chars + 2 * depth * weight.lines;
      };
      planChunks = (roots, defaultFont, memo, budget) => {
        const chunks = [];
        const pack = (parent, siblings, path) => {
          const depth = parent ? 1 : 0;
          const headerChars = parent ? renderLine(parent, defaultFont).length + 1 : 0;
          let start = 0;
          let used = headerChars;
          const flush = (end) => {
            if (end > start)
              chunks.push({ path, parent, siblings, start, count: end - start });
            start = end;
            used = headerChars;
          };
          siblings.forEach((sibling, index) => {
            const size = sizeAt(sibling, depth, memo);
            if (size > budget && sibling.children.length > 0) {
              flush(index);
              start = index + 1;
              pack(sibling, sibling.children, [...path, sibling]);
              return;
            }
            if (used + size > budget)
              flush(index);
            used += size;
          });
          flush(siblings.length);
        };
        pack(null, roots, []);
        return chunks;
      };
      approxTokens = (chars) => `~${Math.round(chars / 400) / 10}K`;
      chunkChars = (chunk, defaultFont, memo) => {
        const depth = chunk.parent ? 1 : 0;
        const header = chunk.parent ? renderLine(chunk.parent, defaultFont).length + 1 : 0;
        return chunk.siblings.slice(chunk.start, chunk.start + chunk.count).reduce((sum, node) => sum + sizeAt(node, depth, memo), header);
      };
      brief = (node) => {
        var _a;
        return (_a = node.ref) != null ? _a : node.line.length > 40 ? `${node.line.slice(0, 40)}...` : node.line;
      };
      renderManifest = (chunks, header, defaultFont, memo) => {
        const out = [
          ...header,
          `# Too large for one response: ${chunks.length} chunks. Call again with chunk=1..${chunks.length}. Each chunk repeats its parent line so xy stay unambiguous; the chunks together cover everything once. The legend is in chunk 1, so read that first.`
        ];
        chunks.forEach((chunk, index) => {
          const nodes = chunk.siblings.slice(chunk.start, chunk.start + chunk.count);
          const names = nodes.slice(0, 4).map(brief).join(", ") + (nodes.length > 4 ? `, +${nodes.length - 4} more` : "");
          const where = chunk.parent ? `in ${chunk.path.map((node) => {
            var _a;
            return (_a = node.ref) != null ? _a : "";
          }).join(" > ")}` : "at the top level";
          out.push(`chunk ${index + 1}/${chunks.length} ${approxTokens(chunkChars(chunk, defaultFont, memo))} tokens, ${where}: ${names}`);
        });
        return out.join("\n");
      };
      renderChunk = (chunks, number, header, defaultFont) => {
        const chunk = chunks[number - 1];
        const out = [...header, `# chunk ${number}/${chunks.length}`];
        const depth = chunk.parent ? 1 : 0;
        const indent = "  ".repeat(depth);
        if (chunk.parent) {
          out.push(`# in: ${chunk.path.map((node) => {
            var _a;
            return (_a = node.ref) != null ? _a : "";
          }).join(" > ")}`);
          const origin = chunk.parent.origin;
          if (origin)
            out.push(`# xy below are measured from ${origin.ref}, which sits at page ${round(origin.x)},${round(origin.y)}`);
          out.push(renderLine(chunk.parent, defaultFont));
        }
        if (chunk.start > 0)
          out.push(`${indent}# ... ${chunk.start} earlier sibling(s) are in other chunks`);
        chunk.siblings.slice(chunk.start, chunk.start + chunk.count).forEach((node) => render(node, depth, out, defaultFont));
        const after = chunk.siblings.length - chunk.start - chunk.count;
        if (after > 0)
          out.push(`${indent}# ... ${after} later sibling(s) are in other chunks`);
        return out.join("\n");
      };
      describeFonts = (fonts) => {
        const names = Object.keys(fonts).sort((a, b) => fonts[b] - fonts[a]);
        const listed = names.map((name, index) => `${name} (${fonts[name]}${index === 0 ? ", default" : ""})`);
        return names.length ? `. Fonts: ${listed.join(", ")}` : "";
      };
      outlineSelection = (selection, chunk, budget = CHUNK_CHARS, format = "outline") => {
        const stats = { visited: 0, hidden: 0, fonts: {}, placeholders: /* @__PURE__ */ new Set() };
        const several = selection.length > 1;
        const built = selection.map((node) => build(node, stats, null, null, several ? pageAt(node) : "")).filter(isPresent);
        const defaultFont = Object.keys(stats.fonts).sort((a, b) => stats.fonts[b] - stats.fonts[a])[0];
        const placeholders = countPlaceholders(built);
        const folded = compress(built);
        const trees = format === "css" ? folded.map(useCss) : folded;
        const lines = [];
        trees.forEach((tree) => render(tree, 0, lines, defaultFont));
        const summary = `# ${stats.visited} nodes read, ${placeholders} placeholders, ${stats.hidden} hidden skipped${describeFonts(stats.fonts)}`;
        const header = [format === "css" ? CSS_LEGEND : legendFor(lines), summary];
        if (lines.join("\n").length <= budget) {
          if (chunk !== void 0 && chunk !== 1)
            return `# chunk ${chunk} does not exist: this selection fits in one response, so only chunk 1 (or no chunk) is valid`;
          return [...header, ...lines].join("\n");
        }
        const memo = /* @__PURE__ */ new Map();
        trees.forEach((tree) => weigh(tree, defaultFont, memo));
        const chunks = planChunks(trees, defaultFont, memo, budget);
        if (chunk === void 0)
          return renderManifest(chunks, [summary], defaultFont, memo);
        if (!Number.isInteger(chunk) || chunk < 1 || chunk > chunks.length)
          return `# chunk ${chunk} does not exist: this selection has ${chunks.length} chunks`;
        const continued = `# FrameLink outline, continued: the legend is in chunk 1${defaultFont ? `; default font ${defaultFont}` : ""}`;
        return renderChunk(chunks, chunk, chunk === 1 ? header : [continued], defaultFont);
      };
    }
  });

  // plugin/src/boxes.ts
  var MAX_BOXES, boxesOf;
  var init_boxes = __esm({
    "plugin/src/boxes.ts"() {
      "use strict";
      MAX_BOXES = 5e3;
      boxesOf = (root, scale, placeholders = /* @__PURE__ */ new Set()) => {
        const origin = root.absoluteBoundingBox;
        const boxes = [];
        if (!origin)
          return boxes;
        const visit = (node, parent, inStub) => {
          if (boxes.length >= MAX_BOXES)
            return;
          const stub2 = inStub || placeholders.has(node.id);
          const bounds = node.absoluteBoundingBox;
          if (bounds) {
            boxes.push(__spreadValues({
              id: node.id,
              name: node.name,
              type: node.type,
              parent,
              x: Math.round((bounds.x - origin.x) * scale),
              y: Math.round((bounds.y - origin.y) * scale),
              w: Math.round(bounds.width * scale),
              h: Math.round(bounds.height * scale)
            }, stub2 ? { placeholder: true } : {}));
          }
          if ("children" in node) {
            const owner = bounds ? node.id : parent;
            node.children.forEach((child) => {
              if (child.visible)
                visit(child, owner, stub2);
            });
          }
        };
        visit(root, null, false);
        return boxes;
      };
    }
  });

  // plugin/src/code.ts
  var require_code = __commonJS({
    "plugin/src/code.ts"(exports) {
      init_serializer();
      init_outline();
      init_boxes();
      figma.showUI(__html__, { width: 300, height: 220 });
      console.log("[Plugin Main] Started");
      function respond(requestId, data) {
        figma.ui.postMessage({ type: "RESPONSE", requestId, data });
      }
      function respondError(requestId, message) {
        figma.ui.postMessage({ type: "ERROR", requestId, message });
      }
      var serializeSelection = (selection) => selection.length === 1 ? serializeNode(selection[0]) : selection.map((node) => serializeNode(node));
      var chunkOf = (value) => typeof value === "number" ? value : void 0;
      var formatOf = (value) => value === "css" ? "css" : "outline";
      var isSceneNode = (node) => node.type !== "DOCUMENT" && node.type !== "PAGE";
      var isPresentScene = (node) => node !== null && isSceneNode(node);
      figma.ui.onmessage = (msg) => __async(exports, null, function* () {
        var _a;
        const { type, requestId } = msg;
        console.log("[Plugin Main] Received:", type);
        try {
          switch (type) {
            case "GET_SELECTION": {
              const selection = figma.currentPage.selection;
              if (selection.length === 0)
                return respondError(requestId, "NO_SELECTION");
              respond(requestId, msg.format === "json" ? serializeSelection(selection) : outlineSelection(selection, chunkOf(msg.chunk), void 0, formatOf(msg.format)));
              break;
            }
            case "GET_DOCUMENT_INFO": {
              const doc = figma.root;
              const page = figma.currentPage;
              respond(requestId, {
                documentId: doc.id,
                documentName: doc.name,
                pageId: page.id,
                pageName: page.name,
                pageCount: doc.children.length,
                pages: doc.children.map((p) => ({ id: p.id, name: p.name }))
              });
              break;
            }
            case "GET_NODE_INFO": {
              const node = yield figma.getNodeByIdAsync(msg.nodeId);
              if (!node)
                return respondError(requestId, `Node not found: ${msg.nodeId}`);
              if (msg.format === "json")
                return respond(requestId, serializeNode(node));
              if (!isSceneNode(node))
                return respondError(requestId, `Node ${msg.nodeId} is a page or document, pass a frame id or use format "json"`);
              respond(requestId, outlineSelection([node], chunkOf(msg.chunk), void 0, formatOf(msg.format)));
              break;
            }
            case "GET_NODES_INFO": {
              const nodeIds = msg.nodeIds || [];
              const found = yield Promise.all(nodeIds.map((id) => figma.getNodeByIdAsync(id)));
              if (msg.format === "json")
                return respond(requestId, found.map((node) => node ? serializeNode(node) : null));
              respond(requestId, outlineSelection(found.filter(isPresentScene), chunkOf(msg.chunk), void 0, formatOf(msg.format)));
              break;
            }
            case "GET_ANNOTATIONS": {
              const target = msg.nodeId ? yield figma.getNodeByIdAsync(msg.nodeId) : figma.currentPage.selection[0];
              if (!target)
                return respondError(requestId, "No target node");
              respond(requestId, (_a = target.annotations) != null ? _a : []);
              break;
            }
            case "EXPORT_NODE": {
              const selection = figma.currentPage.selection;
              if (!msg.nodeId && selection.length === 0)
                return respondError(requestId, "NO_SELECTION");
              if (!msg.nodeId && selection.length > 1)
                return respondError(requestId, "Select one node to export, or pass a node id");
              const target = msg.nodeId ? yield figma.getNodeByIdAsync(msg.nodeId) : selection[0];
              if (!target || !isSceneNode(target))
                return respondError(requestId, `Node not found or not exportable: ${msg.nodeId}`);
              const scale = typeof msg.scale === "number" && msg.scale > 0 ? msg.scale : 1;
              const bytes = yield target.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale }, useAbsoluteBounds: true });
              respond(requestId, { id: target.id, name: target.name, png: figma.base64Encode(bytes), boxes: boxesOf(target, scale, placeholderIds(target)) });
              break;
            }
            default:
              respondError(requestId, `Unknown message type: ${type}`);
          }
        } catch (error) {
          console.error("[Plugin Main] Error handling", type, ":", error);
          respondError(requestId, String(error));
        }
      });
    }
  });
  require_code();
})();

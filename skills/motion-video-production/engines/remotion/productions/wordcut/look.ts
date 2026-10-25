// The lens: depth-of-field blur on the top/bottom bands (design px), window-light streaks and the shadow bands between
// them, vignette and grain opacity, and a colour grade on the whole frame (a gamma curve that darkens mid-tones without
// clipping paper white, a cool lift of the blue channel in the shadows, then contrast / saturate / brightness).
// Fit it to a reference with look-fit.mjs and paste the best result here. This is the neutral pre-fit lens.
export type Look = { dof: number; light: number; shade: number; vignette: number; grain: number; gamma: number; shadowTint: number; contrast: number; saturate: number; brightness: number };
export const LOOK: Look = { dof: 2, light: 0.45, shade: 0, vignette: 0.28, grain: 0.05, gamma: 1, shadowTint: 0, contrast: 1, saturate: 1, brightness: 1 };

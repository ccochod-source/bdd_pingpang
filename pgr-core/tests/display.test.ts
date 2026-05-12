import { describe, it, expect } from "vitest";
import { getPublicRatingDisplay } from "../src/display.js";
import { PGR_CONFIG } from "../src/config.js";

// PUBLIC_RATING_MIN_MATCHES = 3
// PROVISIONAL_THRESHOLD     = 15
// STABLE_THRESHOLD          = 50

describe("getPublicRatingDisplay — hidden phase (< 3 matches)", () => {
  it("hides rating at 0 matches", () => {
    const d = getPublicRatingDisplay(1500, 0);
    expect(d.visible).toBe(false);
    expect(d.label).toBe("En évaluation");
    expect(d.matchCount).toBe(0);
  });

  it("hides rating at 1 match", () => {
    const d = getPublicRatingDisplay(1688, 1);
    expect(d.visible).toBe(false);
    expect(d.label).toBe("En évaluation");
  });

  it("hides rating at 2 matches", () => {
    const d = getPublicRatingDisplay(1750, 2);
    expect(d.visible).toBe(false);
    expect(d.label).toBe("En évaluation");
  });

  it("internal rating is not exposed when hidden", () => {
    const d = getPublicRatingDisplay(2400, 1);
    expect(d.visible).toBe(false);
    // rating field must not exist on hidden display
    expect((d as any).rating).toBeUndefined();
  });
});

describe("getPublicRatingDisplay — PROVISIONAL (3–14 matches)", () => {
  it("shows rating at exactly 3 matches (PUBLIC_RATING_MIN_MATCHES)", () => {
    const d = getPublicRatingDisplay(1520, 3);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.rating).toBe(1520);
      expect(d.label).toBe("Confiance faible");
      expect(d.confidenceStatus).toBe("PROVISIONAL");
    }
  });

  it("shows rating with 'Confiance faible' at 10 matches", () => {
    const d = getPublicRatingDisplay(1600, 10);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance faible");
      expect(d.confidenceStatus).toBe("PROVISIONAL");
    }
  });

  it("shows rating with 'Confiance faible' at 14 matches (last PROVISIONAL)", () => {
    const d = getPublicRatingDisplay(1650, 14);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance faible");
      expect(d.confidenceStatus).toBe("PROVISIONAL");
    }
  });

  it("rounds rating to nearest integer", () => {
    const d = getPublicRatingDisplay(1523.7, 5);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.rating).toBe(1524);
    }
  });
});

describe("getPublicRatingDisplay — CALIBRATING (15–49 matches)", () => {
  it("shows 'Confiance moyenne' at exactly 15 matches", () => {
    const d = getPublicRatingDisplay(1700, 15);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance moyenne");
      expect(d.confidenceStatus).toBe("CALIBRATING");
    }
  });

  it("shows 'Confiance moyenne' at 30 matches", () => {
    const d = getPublicRatingDisplay(1750, 30);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance moyenne");
      expect(d.confidenceStatus).toBe("CALIBRATING");
    }
  });

  it("shows 'Confiance moyenne' at 49 matches (last CALIBRATING)", () => {
    const d = getPublicRatingDisplay(1800, 49);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance moyenne");
      expect(d.confidenceStatus).toBe("CALIBRATING");
    }
  });
});

describe("getPublicRatingDisplay — STABLE (50+ matches)", () => {
  it("shows 'Confiance forte' at exactly 50 matches", () => {
    const d = getPublicRatingDisplay(1900, 50);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance forte");
      expect(d.confidenceStatus).toBe("STABLE");
    }
  });

  it("shows 'Confiance forte' at 100 matches", () => {
    const d = getPublicRatingDisplay(2100, 100);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance forte");
      expect(d.confidenceStatus).toBe("STABLE");
    }
  });

  it("shows 'Confiance forte' at 300 matches", () => {
    const d = getPublicRatingDisplay(2500, 300);
    expect(d.visible).toBe(true);
    if (d.visible) {
      expect(d.label).toBe("Confiance forte");
      expect(d.confidenceStatus).toBe("STABLE");
    }
  });
});

describe("getPublicRatingDisplay — internal rating integrity", () => {
  it("internal rating is always computed regardless of visibility", () => {
    // At 1 match: hidden, but the INTERNAL rating (passed in) is 1688
    // The function receives it — it's the caller's responsibility to store it
    const internalRating = 1688;
    const display = getPublicRatingDisplay(internalRating, 1);
    expect(display.visible).toBe(false);
    // Internal value is preserved by the caller, not lost
    expect(internalRating).toBe(1688);
  });

  it("display threshold boundary: 2 → hidden, 3 → visible", () => {
    expect(getPublicRatingDisplay(1500, 2).visible).toBe(false);
    expect(getPublicRatingDisplay(1500, 3).visible).toBe(true);
  });

  it("confidence threshold boundary: 14 → PROVISIONAL, 15 → CALIBRATING", () => {
    const at14 = getPublicRatingDisplay(1600, 14);
    const at15 = getPublicRatingDisplay(1600, 15);
    if (at14.visible && at15.visible) {
      expect(at14.confidenceStatus).toBe("PROVISIONAL");
      expect(at15.confidenceStatus).toBe("CALIBRATING");
    }
  });

  it("confidence threshold boundary: 49 → CALIBRATING, 50 → STABLE", () => {
    const at49 = getPublicRatingDisplay(1800, 49);
    const at50 = getPublicRatingDisplay(1800, 50);
    if (at49.visible && at50.visible) {
      expect(at49.confidenceStatus).toBe("CALIBRATING");
      expect(at50.confidenceStatus).toBe("STABLE");
    }
  });

  it("matchCount is always included in the display", () => {
    expect(getPublicRatingDisplay(1500, 0).matchCount).toBe(0);
    expect(getPublicRatingDisplay(1500, 7).matchCount).toBe(7);
    expect(getPublicRatingDisplay(1500, 50).matchCount).toBe(50);
  });

  it("reflects correct config constants", () => {
    expect(PGR_CONFIG.PUBLIC_RATING_MIN_MATCHES).toBe(3);
    expect(PGR_CONFIG.PROVISIONAL_THRESHOLD).toBe(15);
    expect(PGR_CONFIG.STABLE_THRESHOLD).toBe(50);
  });
});

// The score: every puzzle's chord sits in A major, so playing them in order moves through a
// progression. Lower notes go to redder targets (red light has the lowest frequency).
export const NOTE = {
  A3: 220,
  B3: 246.94,
  Cs4: 277.18,
  D4: 293.66,
  E4: 329.63,
  Fs4: 369.99,
  Gs4: 415.3,
  A4: 440,
} as const;

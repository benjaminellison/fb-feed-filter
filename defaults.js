var DEFAULT_THRESHOLD = 0.7;

var DEFAULT_RULES = [
  {
    name: "shock-words",
    type: "regex",
    pattern: "\\b(shocking|unbelievable|insane|crazy|jaw[- ]dropping)\\b",
    flags: "i",
    weight: 0.4,
    enabled: true
  },
  {
    name: "clickbait-phrases",
    type: "regex",
    pattern: "\\b(you won.?t believe|i can.?t believe|this changed everything|what happens next|will blow your mind|gone wrong|gone sexual|nobody is talking about)\\b",
    flags: "i",
    weight: 0.6,
    enabled: true
  },
  {
    name: "must-watch",
    type: "regex",
    pattern: "\\b(must watch|must see|do not miss|stop scrolling)\\b",
    flags: "i",
    weight: 0.5,
    enabled: true
  },
  {
    name: "only-never-again",
    type: "regex",
    pattern: "(?=.*\\b(?:only|just)\\b)(?=.*\\bnever\\b.*\\bagain\\b)",
    flags: "i",
    weight: 0.75,
    enabled: true
  },
  {
    name: "all-caps-title",
    type: "caps_ratio",
    threshold: 0.7,
    minLetters: 15,
    weight: 0.5,
    enabled: true
  },
  {
    name: "excessive-emoji",
    type: "emoji_count",
    threshold: 3,
    weight: 0.4,
    enabled: true
  },
  {
    name: "exclamation-marks",
    type: "regex",
    pattern: "!",
    flags: "g",
    weight: 0.15,
    perMatch: true,
    enabled: true
  },
  {
    name: "question-marks",
    type: "regex",
    pattern: "\\?",
    flags: "g",
    weight: 0.1,
    perMatch: true,
    enabled: true
  }
];

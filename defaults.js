var DEFAULT_RULES = [
  {
    name: "shock-words",
    type: "regex",
    pattern: "\\b(shocking|unbelievable|insane|crazy|jaw[- ]dropping)\\b",
    flags: "i",
    enabled: true
  },
  {
    name: "clickbait-phrases",
    type: "regex",
    pattern: "\\b(you won.?t believe|i can.?t believe|this changed everything|what happens next|will blow your mind|gone wrong|gone sexual|nobody is talking about)\\b",
    flags: "i",
    enabled: true
  },
  {
    name: "must-watch",
    type: "regex",
    pattern: "\\b(must watch|must see|do not miss|stop scrolling)\\b",
    flags: "i",
    enabled: true
  },
  {
    name: "all-caps-title",
    type: "caps_ratio",
    threshold: 0.7,
    minLetters: 15,
    enabled: true
  },
  {
    name: "excessive-emoji",
    type: "emoji_count",
    threshold: 3,
    enabled: true
  }
];

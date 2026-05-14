var DEFAULT_THRESHOLD = 1.0;

var DEFAULT_RULES = [
  {
    name: "sponsored-cta",
    type: "selector",
    selector: "[data-ad-rendering-role='cta-']",
    weight: 1.0,
    enabled: true
  },
  {
    name: "follow-suggestion",
    type: "text_selector",
    selector: "div[role='button']",
    text: "Follow",
    weight: 1.0,
    enabled: true
  },
  {
    name: "join-suggestion",
    type: "text_selector",
    selector: "div[role='button']",
    text: "Join",
    weight: 1.0,
    enabled: true
  }
];

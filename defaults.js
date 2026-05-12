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
    name: "sponsored-redirect",
    type: "selector",
    selector: "a[href*='l.facebook.com/l.php']",
    weight: 1.0,
    enabled: true
  },
  {
    name: "follow-suggestion",
    type: "text_selector",
    selector: "h4 div[role='button'], h3 div[role='button']",
    text: "Follow",
    weight: 1.0,
    enabled: true
  }
];

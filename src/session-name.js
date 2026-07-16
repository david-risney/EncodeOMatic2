const ADJECTIVES = [
  'amber', 'autumn', 'breezy', 'bright', 'calm', 'cheerful', 'clever', 'cozy',
  'crisp', 'curious', 'dapper', 'eager', 'fair', 'fancy', 'festive', 'gentle',
  'golden', 'grand', 'happy', 'hardy', 'hazy', 'honest', 'jolly', 'kind',
  'lively', 'lucky', 'mellow', 'merry', 'misty', 'nimble', 'noble', 'peaceful',
  'playful', 'pleasant', 'proud', 'quiet', 'radiant', 'rapid', 'rosy', 'round',
  'sunny', 'swift', 'tidy', 'tranquil', 'vivid', 'warm', 'wise', 'zesty',
];

const NOUNS = [
  'acorn', 'apple', 'badger', 'beacon', 'birch', 'brook', 'canyon', 'cedar',
  'cherry', 'cloud', 'comet', 'coral', 'creek', 'dawn', 'dolphin', 'dream',
  'eagle', 'ember', 'falcon', 'fern', 'field', 'finch', 'forest', 'fox',
  'garden', 'grove', 'harbor', 'heron', 'hill', 'island', 'lake', 'lantern',
  'maple', 'meadow', 'moon', 'mountain', 'oak', 'ocean', 'otter', 'owl',
  'pebble', 'pine', 'river', 'robin', 'sparrow', 'star', 'summit', 'willow',
];

export function randomSessionName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}-${noun}`;
}

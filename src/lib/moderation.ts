const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

function leet(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9@$!|+]/g, (char) => LEET[char] ?? char);
}

function squash(value: string): string {
  return leet(value)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

export function sanitize(value: string, multiline: boolean): string {
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const control = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
    : /[\u0000-\u001f\u007f]/g;

  let text = withoutTags.replace(control, "");
  text = multiline
    ? text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : text.replace(/\s+/g, " ");

  return text.trim();
}

export function containsBlocked(value: string, blocked: string[]): boolean {
  const words = new Set(leet(value).split(/[^a-z]+/).filter(Boolean));
  if (words.size === 0) {
    return false;
  }

  const joined = squash(value);

  return blocked.some((entry) => {
    const word = leet(entry).replace(/[^a-z]/g, "");
    if (!word) {
      return false;
    }

    if (words.has(word)) {
      return true;
    }

    const squashed = squash(entry);
    return squashed.length >= 5 && joined.includes(squashed);
  });
}

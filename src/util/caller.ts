export function getCallerMethodName(level = 3): string | undefined {
  const stack = new Error().stack;
  if (!stack) return undefined;
  const lines = stack.split("\n");
  if (lines.length > level) {
    const callerLine = lines[level];

    const asMatch = callerLine.match(/ \[as ([\w_]+)\]/);
    if (asMatch) return asMatch[1];
    const match = callerLine.match(/at (?:(?:[\w<>_]+\.)?get |(?:[\w<>_]+\.)?)([\w_]+) [\[(]/);
    if (match) return match[1];
  }
  return undefined;
}

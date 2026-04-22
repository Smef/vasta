import { describe, it, expect } from "vitest";
import { getCallerMethodName } from "@src/util/caller";

const RealError = globalThis.Error;

function withMockedStack<T>(stack: string | undefined, fn: () => T): T {
  class MockError {
    stack: string | undefined = stack;
    message: string;
    name = "Error";
    constructor(message?: string) {
      this.message = message ?? "";
    }
  }
  globalThis.Error = MockError as unknown as ErrorConstructor;
  try {
    return fn();
  } finally {
    globalThis.Error = RealError;
  }
}

function stackWith(callerLine: string): string {
  return ["Error", "    at frame1 (/file.ts:1:1)", "    at frame2 (/file.ts:1:1)", callerLine].join("\n");
}

describe("getCallerMethodName stack-line parsing", () => {
  it("extracts method name from 'at ClassName.methodName (file)'", () => {
    const result = withMockedStack(stackWith("    at ClassName.methodName (/path/file.ts:1:1)"), () =>
      getCallerMethodName(),
    );
    expect(result).toBe("methodName");
  });

  it("extracts alias from 'at get methodName [as alias] (file)'", () => {
    const result = withMockedStack(stackWith("    at get methodName [as alias] (/path/file.ts:1:1)"), () =>
      getCallerMethodName(),
    );
    expect(result).toBe("alias");
  });

  it("extracts method name from 'at get methodName (file)' via the second regex", () => {
    const result = withMockedStack(stackWith("    at get methodName (/path/file.ts:1:1)"), () => getCallerMethodName());
    expect(result).toBe("methodName");
  });

  it("extracts method name from 'at ClassName.get methodName (file)' via the second regex", () => {
    const result = withMockedStack(stackWith("    at ClassName.get methodName (/path/file.ts:1:1)"), () =>
      getCallerMethodName(),
    );
    expect(result).toBe("methodName");
  });

  it("returns undefined for non-matching stack lines", () => {
    const result = withMockedStack(stackWith("    completely garbage line that does not match"), () =>
      getCallerMethodName(),
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when stack is missing", () => {
    const result = withMockedStack(undefined, () => getCallerMethodName());
    expect(result).toBeUndefined();
  });

  it("returns undefined when stack has fewer lines than the requested level", () => {
    const result = withMockedStack("Error\n    at onlyOneFrame (/file.ts:1:1)", () => getCallerMethodName());
    expect(result).toBeUndefined();
  });
});

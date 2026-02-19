# TypeScript/Jest Unit Testing Style Guide (v2)

## Goal

This is your testing style guide. Follow these conventions when writing Jest/TypeScript unit tests. For working examples that demonstrate these patterns, see `.ai/UnitTestExamples.md`.

## Pre-Writing Checklist

Before generating any tests, complete these steps in order:

1. **Branch analysis** (Coverage-Driven Test Planning): Read the source, enumerate every branch, map each to a test scenario.
2. **Superfluous test check** (Superfluous Test Prevention): Verify each planned scenario covers a distinct branch, not the same branch with different values.
3. **Execution location check** (CRITICAL RULE #1): Execute methods under test in `beforeEach()`, not in `it()` blocks.
4. **Mock configuration check** (CRITICAL RULE #2): Configure mock behavior in `beforeEach`, not at module level.
5. **Callback invocation check** (CRITICAL RULE #3): Use `mockImplementation` for callbacks, not `mock.calls[N][M]()`.

Once tests are generated:

- verify that you haven't fallen into one of the pitfalls described in this guide
- you can run the test to see if the output has errors

---

## CRITICAL RULE #1: Test Execution Location

⚠️ **NON-NEGOTIABLE RULE** ⚠️

**Execute the method under test in `beforeEach()` blocks.**
**Assert against results in `it()` blocks.**

This is mandatory. Do NOT execute the method under test inside `it()` blocks under ANY circumstances.

### Why This Pattern Matters

1. **Single execution per scenario**: Method runs once per `describe` block, not once per assertion
2. **Clear separation**: Setup vs. verification are distinct phases
3. **Performance**: Avoids redundant executions when multiple assertions test the same result
4. **Refactoring**: Changing method call location affects one place, not every test
5. **Readability**: `it()` blocks become pure assertions about behavior

### The Pattern

```typescript
// ✅ CORRECT: Execute in beforeEach, assert in it blocks
describe("when calculating discount", () => {
    let result: number;

    beforeEach(() => {
        result = calculateDiscount(100); // ✅ Execution here
    });

    it("should return 10% discount", () => {
        expect(result).toBe(10); // ✅ Pure assertion
    });

    it("should return a positive number", () => {
        expect(result).toBeGreaterThan(0); // ✅ Pure assertion
    });
});

// ❌ WRONG: Executing in it blocks
describe("when calculating discount", () => {
    it("should return 10% discount", () => {
        const result = calculateDiscount(100); // ❌ NO! Don't execute here
        expect(result).toBe(10);
    });

    it("should return a positive number", () => {
        const result = calculateDiscount(100); // ❌ NO! Redundant execution
        expect(result).toBeGreaterThan(0);
    });
});
```

### Decision Tree

Is this an it() block?

- YES
    - Do NOT execute the method under test here
    - Only write assertions (expect statements)
    - Use variables declared outside and populated in beforeEach
- NO (it's a beforeEach)
    - Execute the method under test here
    - Store results in variables for it() blocks to assert
    - async and sync Errors can be captured in a catch() or try/catch to be used in an assertion elsewhere

### Self-Check Before Generating Tests

Before writing any test suite, verify:

- [ ] Is the method under test called in `beforeEach()`?
- [ ] Do `it()` blocks contain ONLY assertions (expect statements)?
- [ ] Are result variables declared with `let` above `beforeEach()`?

**If you cannot answer YES to all of these, revise your test structure.**

---

## CRITICAL RULE #2: Mock Configuration Location

⚠️ **NON-NEGOTIABLE RULE** ⚠️

**Declare `jest.fn()` mock references at module level. Configure mock _behavior_ (return values, implementations) inside `beforeEach` or `beforeAll` blocks — NEVER at module level.**

Module-level code runs once when the file loads. If you configure return values or implementations at module level, those configurations are consumed on the first test and are gone for all subsequent tests, causing unpredictable failures.

### The Pattern

```typescript
// ✅ CORRECT: Declare at module level, configure in beforeEach
const mockGetUser = jest.fn();
jest.mock("./userService", () => ({
    getUser: mockGetUser,
}));

describe("when fetching user profile", () => {
    beforeEach(() => {
        mockGetUser.mockResolvedValue({ id: "42", name: "Cal Zone" }); // ✅ Configured per test
    });

    it("should return the user", () => {
        expect(result.name).toBe("Cal Zone");
    });
});

// ❌ WRONG: Configuring behavior at module level
const mockGetUser = jest.fn().mockResolvedValue({ id: "42", name: "Cal Zone" }); // ❌ Consumed on first test only
jest.mock("./userService", () => ({
    getUser: mockGetUser,
}));
```

### Exceptions

The only acceptable module-level mock configuration is `mockReturnThis()` for builder/chaining patterns where the mock needs to return itself for `jest.mock()` factory resolution:

```typescript
// ✅ OK: mockReturnThis at module level for chaining
const mockLuxon = {
    DateTime: {
        utc: jest.fn().mockReturnThis(),
        toISO: jest.fn(), // but configure toISO's return value in beforeEach!
    },
};
```

### Self-Check

- [ ] Are all `mockResolvedValue`, `mockReturnValue`, `mockImplementation` calls inside `beforeEach`/`beforeAll`?
- [ ] Do module-level mock declarations use only bare `jest.fn()` (or `jest.fn().mockReturnThis()` for chaining)?

---

## CRITICAL RULE #3: Callback Invocation via mockImplementation

⚠️ **NON-NEGOTIABLE RULE** ⚠️

**When testing code that passes a callback to a dependency, use `mockImplementation` (or `mockImplementationOnce`) to invoke that callback. NEVER use `mock.calls[N][M]()` to reach into the call record and imperatively invoke a callback.**

The `mock.calls` approach is fragile: it depends on call ordering, breaks when calls are added/removed, and separates the invocation from the setup that makes it meaningful.

### The Pattern

```typescript
// ✅ CORRECT: Invoke callback via mockImplementation
describe("when the event handler callback fires", () => {
    beforeEach(() => {
        mockEventEmitter.on.mockImplementationOnce((_event: any, cb: any) => {
            cb("EVENT_DATA"); // ✅ Callback invoked as part of mock behavior
        });
        result = initializeListener();
    });

    it("should process the event data", () => {
        expect(mockProcess).toHaveBeenCalledWith("EVENT_DATA");
    });
});

// ❌ WRONG: Imperatively calling into mock.calls
describe("when the event handler callback fires", () => {
    beforeEach(() => {
        initializeListener();
        // ❌ Fragile: depends on call index, separated from setup context
        const callback = mockEventEmitter.on.mock.calls[0][1];
        callback("EVENT_DATA");
    });

    it("should process the event data", () => {
        expect(mockProcess).toHaveBeenCalledWith("EVENT_DATA");
    });
});
```

### Why This Matters

1. **Coupling to call order**: `mock.calls[0][1]` breaks if a new call is added before it
2. **Readability**: The callback's purpose is invisible — you must trace back to understand what `calls[0][1]` refers to
3. **Timing**: `mockImplementation` fires the callback at the natural execution point; `mock.calls` fires it after-the-fact, which can mask timing bugs

---

## Coverage-Driven Test Planning

⚠️ **MANDATORY PRE-WRITING STEP** ⚠️

Before writing any test code, you MUST perform a systematic branch analysis of the source module. This prevents the common failure of finishing a test suite only to discover uncovered lines.

### The Process

1. **Read the source file** and identify every branch point:
    - `if`/`else if`/`else` blocks
    - `switch` cases (including `default`)
    - Ternary expressions
    - Short-circuit evaluations (`&&`, `||`, `??`)
    - `try`/`catch`/`finally` blocks
    - Early returns
    - Loop bodies (at least: zero iterations, one iteration, multiple iterations where behavior differs)

2. **Create a branch map** — a mental or written list of every distinct code path:

    ```
    Path 1: input is null → early return
    Path 2: input valid, cache hit → return cached
    Path 3: input valid, cache miss, fetch succeeds → return fetched
    Path 4: input valid, cache miss, fetch fails → throw ServiceError
    ```

3. **Map each path to a test scenario** (a `describe` block). Verify that every path has at least one corresponding scenario.

4. **Check for gaps** before writing any `describe`/`it` blocks. If a path has no scenario, add one.

### Self-Check

- [ ] Have I read the entire source file before writing tests?
- [ ] Have I identified every branch point (if/else, switch, try/catch, ternary, short-circuit, early return)?
- [ ] Does every identified path have a corresponding test scenario?
- [ ] Are there any lines that none of my planned scenarios will execute?

---

## Superfluous Test Prevention

Do NOT write multiple test scenarios that exercise the same code path with different literal values. A new `describe` block is warranted only when it exercises a **different branch** in the source code.

### When a New Describe Block IS Warranted

- A different `if`/`else` branch is taken
- A different `switch` case is matched
- A different error path is triggered
- A different early return is hit
- A dependency returns a structurally different response (e.g., empty array vs. populated array) that causes different downstream behavior

### When a New Describe Block is NOT Warranted

- The same branch is taken with a different string value
- The same branch is taken with a different numeric value
- The same error is thrown with a different message
- The same path is taken with a different but structurally equivalent input

### Example

```typescript
// ❌ SUPERFLUOUS: Two describes that exercise the same branch
describe("when status is 'active'", () => {
    beforeEach(() => {
        result = getLabel("active");
    });
    it("should return 'Currently Active'", () => {
        expect(result).toBe("Currently Active");
    });
});
describe("when status is 'enabled'", () => {
    // ❌ If 'enabled' hits the same if-branch as 'active', this is redundant
    beforeEach(() => {
        result = getLabel("enabled");
    });
    it("should return 'Currently Active'", () => {
        expect(result).toBe("Currently Active");
    });
});

// ✅ CORRECT: One describe per branch
describe("when status is active", () => {
    beforeEach(() => {
        result = getLabel("active"); // covers the "active" branch
    });
    it("should return 'Currently Active'", () => {
        expect(result).toBe("Currently Active");
    });
});
describe("when status is inactive", () => {
    beforeEach(() => {
        result = getLabel("inactive"); // covers a DIFFERENT branch
    });
    it("should return 'Not Active'", () => {
        expect(result).toBe("Not Active");
    });
});
```

---

## File Structure and Naming

- **File naming**: Module name + `.test.ts` extension
- **Coverage goal**: Aim for 100% line coverage, with focus on:
    - All exported functions/methods
    - All conditional branches and error paths
    - Edge cases and boundary conditions
    - Integration points between functions
- **Eslint pragmas**: since we use `any` types, include the `@typescript-eslint/no-explicit-any` pragma. If the file uses `export default {};`, also include the `import/no-anonymous-default-export` pragma.
- **Default exports**: our test modules require an `export default {};` to prevent global collision with other tests. Place this export at the top of the test module, underneath any file-level pragmas. **Forgetting this causes hard-to-debug global collision failures between test files.**

## Error Testing Strategy

- **Comprehensive error coverage**: Test all _explicit_ error paths, not just happy paths - explicit error paths are try/catch blocks and promise rejections, etc. _do not invent error paths and then test them!_
- **Error propagation**: Verify errors bubble up correctly through the call stack
- **Error logging verification**: Assert that errors are logged with expected context
- **Graceful degradation**: Test fallback behaviors when dependencies fail
- **Input validation**: Test with invalid, missing, and malformed inputs
- Fun fake error codes are great ("E_COLD_CALZONE", "E_SOGGY_STROMBOLI")

## Test Suite Organization

- **Hierarchical describe blocks**:
    - Outer `describe` identifies the module
    - Individual exported methods get their own `describe` block
    - Inner `describe` blocks handle specific scenarios ("when X condition")
- **Test descriptions**:
    - `describe` blocks handle the "when" conditions/scenarios
    - `it` blocks focus purely on "should" assertions (no conditions). See **CRITICAL RULE #1** above.
    - Avoid redundancy - don't repeat conditions in both `describe` and `it`
- **Grouping logic**:
    - Group related test cases under shared setup scenarios
    - Keep setup complexity minimal - prefer multiple simple setups over one complex one
    - Use nested describes sparingly - max 3 levels deep for readability

## Test Data Patterns

- **Consistent naming**: Use UPPER_CASE for test-specific values to distinguish from real data
- **Realistic data**: Use plausible values that reflect real-world usage
- **Playfulness is GOOD**: fake-but-realistic data values can be fun. For example
    - "Cal Zone" for a name
    - "cal@zone.com" for an email address
    - numeric or ID values like "8675309" or zip codes like "90210"
    - fun, light-hearted pop-culture, geeky, or literary references keep things fun
- **Minimal fixtures**: Include only the fields necessary for the test scenario
- **Isolation**: Each test should create its own data - avoid shared mutable test data

⚠️ **DATA SAFETY RULE** ⚠️

**NEVER include in tests or examples:**

- Real customer data, names, or contact information
- Production database values, IDs, or records
- Actual API keys, credentials, or connection strings
- Real business financial data or metrics
- Internal IP addresses or production URLs

**ALWAYS use clearly fake/playful test data as demonstrated in this guide.**

## State Management

- **Variable declarations**: Chain `let` declarations with commas above `beforeEach`
- **State initialization**: Variables initialized in `beforeEach`
- **Fresh state guarantee**:
    - Call `jest.clearAllMocks()` and `jest.resetModules()` in outer `beforeEach`
    - **Do NOT use `jest.resetAllMocks()`** in the outer `beforeEach` — it wipes implementations, which breaks module-level `mockReturnThis()` chains (see CRITICAL RULE #2 exception)
    - Use `mockReset()` on **individual mocks** when a nested `beforeEach` needs to replace behavior already configured by an outer `beforeEach`
    - **Never use `mockRestore()`** — it only applies to `jest.spyOn`, which this codebase does not use

### Mock Reset Decision Tree

Am I in the **outer** `beforeEach`?

- YES → Use `jest.clearAllMocks()` + `jest.resetModules()`. Then configure default mock behaviors for this suite.
- NO (nested `beforeEach` for a specific scenario) →
    - Does the mock already have behavior from an outer `beforeEach` that I need to **override**?
        - YES → Call `mockName.mockReset()` on that specific mock, then configure its new behavior
        - NO → Just configure the mock (the outer `beforeEach` hasn't set conflicting behavior)
- **Dynamic vs. static imports**:
    - **Static import** — Use for stateless utilities, types, enums, and constants (no module-level singletons, no cached state)
    - **Dynamic import** (`await import("./module")` inside `beforeEach`) — Use for everything else, especially modules that hold state, use singletons, or have mocked dependencies. This only works because `jest.resetModules()` in the outer `beforeEach` busts the module cache — without it, repeated dynamic imports return the same cached instance

## Mocking Strategy

- **Module-level mock declarations**: Dependencies mocked above test suites with bare `jest.fn()` — see **CRITICAL RULE #2** for configuration rules
- **Mock behavior configuration**: Configured per scenario in `beforeEach` blocks
- **Mock naming**: Consistent mock prefix (e.g., `mockLogger`, `mockGetMessageBroker`)
- **Selective mocking**: Mock only the methods being used unless it significantly raises complexity
- **Mock verification**: Always verify mock calls when behavior depends on them
- **Mock realism**: Ensure mocks behave like real implementations (same async patterns, error types)
- **Mock methods**:
    - Use `mockImplementation` when invoking callbacks passed to the mocked function — see **CRITICAL RULE #3**
    - Use `mockResolvedValue` for async returns
    - Use `mockReturnValue` for sync returns
    - Prefer "Once" versions when appropriate (`mockResolvedValueOnce`, etc.)
- **Special cases**:
    - Do NOT mock lodash unless uniquely warranted
    - Do NOT mock luxon - use jest's fake timers instead (restore real timers in `afterEach`)
- **Empty mocks**: Use only when necessary (not common)
- **Types**: Don't mock types/enums unless instructed to do so

## Async Testing Patterns

- **Preferred**: `async/await` pattern
- **`done` callback** — Last resort only. Use `done` when the method under test does not return a promise and completion depends on a mock callback firing (e.g., calling `done()` inside a `mockImplementation`). In all other cases, use `async/await`. Never mix `done` with `async` — Jest will hang or produce misleading errors.
- **Promise handling**: Use `.then()` and `.catch()` for result capture when needed

## Assertions and Testing Patterns

- **Call verification**:
    - Always assert **count first**, then **arguments**: `toHaveBeenCalledTimes` before `toHaveBeenCalledWith`
    - Use `toHaveBeenNthCalledWith` for multiple calls with different args
- **Equality matchers**:
    - Use `toBe` for primitives (strings, numbers, booleans, null, undefined) — it checks reference equality
    - Use `toEqual` for objects and arrays — it checks deep equality
    - Never use `toBe` on objects (it will fail even if the contents match) or `toEqual` on primitives (it works but is imprecise)
- **Assertion granularity** (in order of preference):
    1. **Full match** with `toEqual` — assert the entire object/array when possible
    2. **Partial match** with `expect.objectContaining` / `expect.arrayContaining` — when the full shape is impractical or irrelevant to the test
    3. **Individual property assertions** — last resort only. Never assert properties deep in an array one at a time when a full or partial match would work.
- **String matching**: Prefer matching full strings
- **Strings vs enumerations**: If an enum is used, the assertion comparing values should use the enumeration, not the equivalent string
- **Test data**: Use UPPER_CASE strings to indicate test data intent
- **Error testing**:
    - Comprehensive error scenario coverage
    - Verify error logging calls
    - Test error propagation and handling strategies
- **Logging**:
    - I do not write assertions for logs at any log level below "warn" (e.g., info, debug, silly, etc.), except if the log statement is the only thing executed as part of the code path (for example - an "else" block that _only_ has a logger.debug)
    - Log levels of critical, error, and warn are asserted in unit tests

## Variable Naming

- No strict preferences, but:
    - Match real method/argument names where possible for readability
    - Use descriptive names for test-specific variables (e.g., `result`, `upsertResult`)

## Import and Module Management

- **Dynamic imports**: Use in `beforeEach` for modules that need fresh instances between tests
- **Static imports**: Can be used for types, constants, and utilities that don't maintain state
- **Mock placement**: All `jest.mock()` calls must be at the top level, before any imports unless otherwise required
- **Module isolation**: Use `jest.resetModules()` in outer `beforeEach` to ensure clean module state

## Test Quality Guidelines

- **Readability first**: Tests serve as living documentation - prioritize clarity over cleverness
- **Single responsibility**: Each test should verify one specific behavior
- **Descriptive names**: Test names should clearly state the expected behavior
- **Avoid test interdependence**: Tests should be runnable in any order
- **Performance consideration**: Avoid unnecessary async operations or complex computations in tests
- **Assertion clarity**: Use specific matchers (toHaveBeenCalledWith vs toHaveBeenCalled)

---

## Common Pitfalls to Avoid

These pitfalls are not covered by the critical rules or earlier sections. Pay close attention.

- **Complex test setup**: If setup is complex, consider breaking into smaller, focused tests
- **Unused arguments**: If a mock (for example mockImplementation) has a method with unused arguments, be sure to prefix them with "\_" to prevent eslint/typescript compiler errors related to unused arguments.
- **Missing cleanup**: Always restore mocked timers, global variables, and environment changes
- **Snapshot overuse**: Use snapshots sparingly - prefer explicit assertions for critical data
- **Over-engineering test cases**: do not over-engineer test scenarios that don't exist in the actual implementation. For example, if a method takes a callback (like expresses app.listen()), don't test for cases like "if app.listen returns without calling callback" unless you are specifically told to do so.
- **Do not invent error paths**: Do not invent error paths when there aren't explicit try/catch or promise rejections. Before writing error tests, verify that the function actually has try/catch blocks, explicit error handling, or promise rejection handling. If none exist, do NOT write error tests.

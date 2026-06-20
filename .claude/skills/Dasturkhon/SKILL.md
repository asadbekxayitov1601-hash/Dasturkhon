```markdown
# Dasturkhon Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill guides you through the core development patterns and conventions used in the Dasturkhon TypeScript codebase. You'll learn about file organization, code style, commit message standards, and testing approaches. These patterns help maintain clarity, consistency, and ease of collaboration in projects without a specific framework.

## Coding Conventions

### File Naming
- **PascalCase** is used for file names.
  - Example:  
    ```
    UserProfile.ts
    OrderManager.test.ts
    ```

### Import Style
- **Relative imports** are preferred.
  - Example:
    ```typescript
    import { UserService } from './UserService';
    import { calculateTotal } from '../utils/Calculator';
    ```

### Export Style
- **Named exports** are used instead of default exports.
  - Example:
    ```typescript
    // In UserProfile.ts
    export function getUserProfile(id: string) { ... }
    export const USER_ROLE = 'admin';
    ```

### Commit Messages
- **Conventional commits** with the `feat` prefix.
  - Example:
    ```
    feat: add user authentication middleware
    ```

## Workflows

### Feature Development
**Trigger:** When adding a new feature  
**Command:** `/feature-development`

1. Create a new TypeScript file using PascalCase.
2. Write your code using named exports.
3. Use relative imports for dependencies.
4. Add or update corresponding test files (`*.test.ts`).
5. Commit changes with a message starting with `feat:`, following the conventional commit style.

### Testing
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Locate or create test files matching the pattern `*.test.ts`.
2. Write tests for new or changed functionality.
3. Run the test suite using your project's test runner (framework not specified; refer to project docs or scripts).
4. Ensure all tests pass before committing.

## Testing Patterns

- **Test Files:** Named with the `.test.` infix, e.g., `OrderManager.test.ts`.
- **Framework:** Not specified; check project documentation or scripts for details.
- **Example Test File:**
  ```typescript
  import { calculateTotal } from './OrderManager';

  test('calculateTotal returns correct sum', () => {
    expect(calculateTotal([1, 2, 3])).toBe(6);
  });
  ```

## Commands
| Command              | Purpose                                   |
|----------------------|-------------------------------------------|
| /feature-development | Start a new feature with code conventions |
| /run-tests           | Run all test files                        |
```

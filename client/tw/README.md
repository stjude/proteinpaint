# Term Wrapper Routers and Handlers

## Goals for Refactoring

1. Replace fillTermWrapper() with router-style code that fully resolves to a specific tw data shape,
and has a lot more type annotations and unit/integration tests.
2. Minimize the need for consumer code to know about tw types, hide data-shape related
details from app, plot, or component code.
3. Code tw handlers as 'plugins'. Within term wrapper handler code/methods, specialize to
one instance type/context, so that 
- there will be less need for static and runtime checks as related to the tw term type,
q.type, and q.mode data instance.
- it will be easy to share common logic within the instance to support different consumer code,
since data processing should not change for the same tw data shape.

## Replace fillTW()
![Screenshot 2024-08-23 at 9 25 23 AM](https://github.com/user-attachments/assets/ba98482e-cfed-4685-9c41-43d0063742b1)

## Plugin-style TW Handlers

![Screenshot 2024-08-24 at 10 42 45 PM](https://github.com/user-attachments/assets/cd6ee372-6fa2-453a-9b9d-698f476e22d1)

## Code Examples

See example usage in `tw/test/fake/app.ts` and its imported code, which are used in the `test('handler by class')`
in `TwRouter.integration.spec.ts`.

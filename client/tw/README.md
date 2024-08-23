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

## Replace fillTermWrapper()

![Screenshot 2024-08-22 at 9 20 35 PM](https://github.com/user-attachments/assets/02e342fc-c041-4d29-8e99-e388b9dedded)

## Plugin-style TW Handlers

![Screenshot 2024-08-22 at 9 36 29 PM](https://github.com/user-attachments/assets/47754d30-436e-4386-b9c2-291b86386a10)

## Code Examples

See the detailed instructions in the `test('handler addons')` in `TwRouter.integration.spec.ts`.

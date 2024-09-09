# Term Wrapper Routers and Handlers

## Goals for Refactoring

1. Replace fillTermWrapper() with router-style code that fully resolves to a specific tw data shape,
with unit/integration tests and built-in type safety while also minimizing the need for type annotations
in class methods and consumer code.
2. Minimize the need for consumer code to know about tw types, hide data-shape related
details from app, plot, or component code.
3. Code custom tw methods either as addons (recommended) or extended subclass. Within term wrapper handler code/methods, can use union of classes, or specialize to
one instance type/context, so that 
- there will be less need for static and runtime checks as related to the tw term type,
q.type, and q.mode data instance.
- it will be easy to share common logic within the instance to support different consumer code,
since data processing should not change for the same tw data shape.

## Replace fillTW()
![Screenshot 2024-08-23 at 9 25 23 AM](https://github.com/user-attachments/assets/ba98482e-cfed-4685-9c41-43d0063742b1)

## Addon instance methods or extend a subclass

![TwRouter init() (1)](https://github.com/user-attachments/assets/3ea57125-a5db-4fdf-8133-8ab35e09e160)

## Code Examples

See example usage in `tw/test/fake/app.ts` and its imported code, which are used in the `test('handler by class')`
in `TwRouter.integration.spec.ts`.

// window.d.ts

// By declaring this interface, you are "merging" your definition
// with the existing 'Window' definition from TypeScript.
interface Window {
  // We are telling TypeScript that window.ethereum may exist and, if it does,
  // it has the type 'any'. Using 'any' is a quick and easy way to get started.
  ethereum?: any;
}
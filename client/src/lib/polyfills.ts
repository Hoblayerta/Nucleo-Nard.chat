// Este archivo contiene polyfills para que Web3 y otras bibliotecas funcionen correctamente en el navegador

// Polyfill para global
// @ts-ignore
window.global = window;

// Polyfill para process
// @ts-ignore
window.process = window.process || { env: {} };

// Dummy Buffer para evitar errores
class BufferPolyfill {
  static from() {
    return [];
  }
  static alloc() {
    return [];
  }
  static allocUnsafe() {
    return [];
  }
  static allocUnsafeSlow() {
    return [];
  }
  static isBuffer() {
    return false;
  }
  static concat() {
    return [];
  }
  static byteLength() {
    return 0;
  }
}

// @ts-ignore
window.Buffer = window.Buffer || BufferPolyfill;

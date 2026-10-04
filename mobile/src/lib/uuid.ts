/**
 * RFC 4122 version 4 UUID.
 *
 * Hermes does not provide `crypto.randomUUID()`, and the guest cart id is an
 * opaque identifier rather than a security token: the backend only checks that
 * it is a well-formed UUID, then uses it to find the caller's own cart. Math
 * .random is therefore sufficient and avoids adding a native crypto dependency
 * purely for this.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

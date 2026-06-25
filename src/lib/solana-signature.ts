export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

export function privyErrorCode(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return null;

  const source = error as Record<string, unknown>;
  for (const key of ["privyErrorCode", "code", "errorCode"]) {
    const value = source[key];
    if (typeof value === "string") return value;
  }

  const message = typeof source.message === "string" ? source.message.toLowerCase() : "";
  if (message.includes("linked") && message.includes("another")) {
    return "linked_to_another_user";
  }

  return null;
}

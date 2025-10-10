import { ZodError } from "zod";

export const isZodError = (error: unknown): error is ZodError => {
  if (!(error instanceof Error)) return false;

  if (error instanceof ZodError) return true;
  if (error.constructor.name === "ZodError") return true;
  if ("issues" in error && error.issues instanceof Array) return true;

  return false;
};

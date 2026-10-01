import { z } from 'zod';
import { ValidationError } from './errors';

/** A single field-level problem, in the shape the API returns to clients. */
export interface FieldIssue {
  path: string;
  message: string;
}

export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates `input` and returns the parsed value, or throws a ValidationError
 * carrying every field problem at once.
 *
 * Routes use this so that request validation is a single line and clients get
 * an actionable list of issues instead of a bare 400.
 */
export function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  context: string,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(`${context} is invalid.`, { issues: toFieldIssues(result.error) });
  }
  return result.data;
}

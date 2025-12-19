export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  issues?: Array<{ path: string; message: string }>;
  current?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? `Request failed (${status})`));
  }

  get isConflict() {
    return this.status === 409 && this.body.error === 'version_conflict';
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.issues ?? []).map((i) => [i.path, i.message]));
  }
}

// Augments Express's Request with the `user` property that authMiddleware
// attaches after verifying the JWT, so JSDoc-typed route handlers (files
// opted in via `// @ts-check`) see `req.user` without casts.
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

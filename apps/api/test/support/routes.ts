import type { INestApplication } from '@nestjs/common';

export interface RouteInfo {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Reads the registered routes off the underlying Express 5 router. */
export function listRoutes(app: INestApplication): RouteInfo[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: Layer[] } };
  const routes: RouteInfo[] = [];
  for (const layer of express.router.stack) {
    if (!layer.route) continue;
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (enabled && ['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
        routes.push({ method: method as RouteInfo['method'], path: layer.route.path });
      }
    }
  }
  return routes;
}

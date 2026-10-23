import type { BaseAPIRequestOptions } from './HTTPError.js';

export interface RouteManager {
  versioned: boolean;
  request(method: string, path: string, options?: BaseAPIRequestOptions): Promise<unknown>;
}

const noop = (): void => {};
const methods = ['get', 'post', 'delete', 'patch', 'put'];
const reflectors: (string | symbol)[] = [
  'toString',
  'valueOf',
  'inspect',
  'constructor',
  Symbol.toPrimitive,
  Symbol.for('nodejs.util.inspect.custom'),
];

export type RouteCallable = {
  (...args: unknown[]): RouteProxy;
  [key: string]: RouteProxy;
};

export type RouteProxy = RouteCallable;

export function buildRoute(manager: RouteManager): RouteProxy {
  const route: string[] = [''];
  const handler: ProxyHandler<typeof noop> = {
    get(_target, name: string | symbol) {
      if (reflectors.includes(name)) {
        return () => route.join('/');
      }
      if (typeof name === 'string' && methods.includes(name)) {
        const routeBucket: string[] = [];
        for (let i = 0; i < route.length; i++) {
          if (route[i - 1] === 'reactions') break;
          if (/\d{16,19}/g.test(route[i]) && !/channels|guilds/.test(route[i - 1] ?? '')) {
            routeBucket.push(':id');
          } else {
            routeBucket.push(route[i]);
          }
        }
        return (options?: Record<string, unknown>) =>
          manager.request(
            name,
            route.join('/'),
            Object.assign(
              {
                versioned: manager.versioned,
                route: routeBucket.join('/'),
              },
              options,
            ),
          );
      }
      if (typeof name === 'string') {
        route.push(name);
      }
      return new Proxy(noop, handler) as RouteProxy;
    },
    apply(_target, _, args: unknown[]) {
      route.push(
        ...args
          .filter(x => x !== null && typeof x !== 'undefined')
          .map(x => String(x)),
      );
      return new Proxy(noop, handler) as RouteProxy;
    },
  };

  return new Proxy(noop, handler) as RouteProxy;
}

export default buildRoute;

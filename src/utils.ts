import { RequestEvent } from "./request_event.ts";
import {
  Cookie,
  Handler,
  NextFunction,
  TObject,
  TRet,
  TSizeList,
} from "./types.ts";

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
type EArr = [string, string | TObject];

export const decURI = (str: string) => {
  try {
    return decodeURI(str);
  } catch (_e) {
    return str;
  }
};
export const decURIComponent = (str: string) => {
  try {
    return decodeURIComponent(str);
  } catch (_e) {
    return str;
  }
};

export function findFn(fn: TRet) {
  if (fn.length === 3) {
    const newFn: TRet = (rev: RequestEvent, next: NextFunction) => {
      const res = rev.response;
      rev.method = rev.request.method;
      if (!rev.__wrapMiddleware) {
        rev.__wrapMiddleware = true;
        rev.getHeaders = () =>
          Object.fromEntries(rev.request.headers.entries());
        res.append = (a: string, b: string) => res.headers.append(a, b);
        res.setHeader = res.set = res.header;
        res.getHeader = res.get = (a: string) => res.header(a);
        res.hasHeader = (a: string) => res.header(a) !== undefined;
        res.removeHeader = (a: string) => res.headers.delete(a);
        res.end = res.send;
        res.writeHead = (a: number, ...b: TRet) => {
          res.status(a);
          for (let i = 0; i < b.length; i++) {
            if (typeof b[i] === "object") res.header(b[i]);
          }
        };
        rev.respond = ({ body, status, headers }: TObject) =>
          rev.respondWith(
            new Response(body as BodyInit, { status, headers } as TObject),
          );
      }
      return fn(rev, res, next);
    };
    return newFn;
  }
  return fn;
}

export function findFns(arr: TObject[]): Handler[] {
  let ret: Handler[] = [], i = 0;
  const len = arr.length;
  for (; i < len; i++) {
    const fn: TRet = arr[i];
    if (Array.isArray(fn)) {
      ret = ret.concat(findFns(fn as TObject[]));
    } else if (typeof fn === "function") {
      ret.push(findFn(fn));
    }
  }
  return ret;
}

export function toBytes(arg: string | number) {
  const sizeList: TSizeList = {
    b: 1,
    kb: 1 << 10,
    mb: 1 << 20,
    gb: 1 << 30,
    tb: Math.pow(1024, 4),
    pb: Math.pow(1024, 5),
  };
  if (typeof arg === "number") return arg;
  const arr = (/^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i).exec(arg);
  let val, unt = "b";
  if (!arr) {
    val = parseInt(arg as unknown as string, 10);
    unt = "b";
  } else {
    val = parseFloat(arr[1]);
    unt = arr[4].toLowerCase();
  }
  return Math.floor(sizeList[unt] as number * val);
}

export function toPathx(path: string | RegExp, isAny: boolean) {
  if (path instanceof RegExp) return { pathx: path, wild: true };
  if (/\?|\*|\.|\:/.test(path) === false && isAny === false) {
    return {};
  }
  let wild = false;
  const pathx = new RegExp(`^${
    path
      .replace(/\/$/, "")
      .replace(/:(\w+)(\?)?(\.)?/g, "$2(?<$1>[^/]+)$2$3")
      .replace(/(\/?)\*/g, (_, p) => {
        wild = true;
        return `(${p}.*)?`;
      })
      .replace(/\.(?=[\w(])/, "\\.")
  }/*$`);
  return { pathx, path, wild };
}

export function needPatch(
  data: TObject | TObject[],
  keys: number[],
  value: string,
) {
  if (keys.length === 0) {
    return value;
  }
  let key = keys.shift() as number;
  if (!key) {
    data = data || [];
    if (Array.isArray(data)) {
      key = data.length;
    }
  }
  const index = +key;
  if (!isNaN(index)) {
    data = data || [];
    key = index;
  }
  data = (data || {}) as TObject;
  const val = needPatch(data[key] as TObject, keys, value);
  data[key] = val;
  return data;
}

export function myParse(arr: EArr[]) {
  const obj = arr.reduce((red: TObject, [field, value]) => {
    if (red[field]) {
      if (Array.isArray(red[field])) {
        red[field] = [...red[field], value];
      } else {
        red[field] = [red[field], value];
      }
    } else {
      let [_, prefix, keys]: TRet = field.match(/^([^\[]+)((?:\[[^\]]*\])*)/);
      if (keys) {
        keys = Array.from(
          keys.matchAll(/\[([^\]]*)\]/g),
          (m: Array<number>) => m[1],
        );
        value = needPatch(red[prefix], keys, value as string);
      }
      red[prefix] = value;
    }
    return red;
  }, {});
  return obj;
}

export function parseQuery(query: unknown | string) {
  if (query === null) return {};
  if (typeof query === "string") {
    let i = 0;
    const arr = query.split("&") as EArr;
    const data = [] as EArr[], len = arr.length;
    while (i < len) {
      const el = arr[i].split("=");
      data.push([decURI(el[0]), decURI(el[1] || "")]);
      i++;
    }
    return myParse(data);
  }
  return myParse(Array.from((query as FormData).entries()));
}

export function concatRegexp(prefix: string | RegExp, path: RegExp) {
  if (prefix === "") return path;
  prefix = new RegExp(prefix);
  let flags = prefix.flags + path.flags;
  flags = Array.from(new Set(flags.split(""))).join();
  return new RegExp(prefix.source + path.source, flags);
}

/**
 * Wrapper middleware for framework express like (req, res, next)
 * @deprecated
 * auto added to Nhttp.use
 * @example
 * ...
 * import cors from "https://esm.sh/cors?no-check";
 * import helmet from "https://esm.sh/helmet?no-check";
 * ...
 * app.use(expressMiddleware([
 *    cors(),
 *    helmet(),
 * ]));
 */
export function expressMiddleware(...middlewares: TRet): TRet {
  return findFns(middlewares);
}

export function middAssets(str: string) {
  return [
    ((rev, next) => {
      rev.url = rev.url.substring(str.length) || "/";
      rev.path = rev.path.substring(str.length) || "/";
      return next();
    }) as Handler,
  ];
}

export function getUrl(url: string) {
  return url.substring(url.indexOf("/", 8));
}

export function serializeCookie(
  name: string,
  value: string,
  cookie: Cookie = {},
) {
  cookie.encode = !!cookie.encode;
  if (cookie.encode) {
    value = "E:" + btoa(encoder.encode(value).toString());
  }
  let ret = `${name}=${value}`;
  if (name.startsWith("__Secure")) {
    cookie.secure = true;
  }
  if (name.startsWith("__Host")) {
    cookie.path = "/";
    cookie.secure = true;
    delete cookie.domain;
  }
  if (cookie.secure) {
    ret += `; Secure`;
  }
  if (cookie.httpOnly) {
    ret += `; HttpOnly`;
  }
  if (typeof cookie.maxAge === "number") {
    ret += `; Max-Age=${cookie.maxAge}`;
  }
  if (cookie.domain) {
    ret += `; Domain=${cookie.domain}`;
  }
  if (cookie.sameSite) {
    ret += `; SameSite=${cookie.sameSite}`;
  }
  if (cookie.path) {
    ret += `; Path=${cookie.path}`;
  }
  if (cookie.expires) {
    ret += `; Expires=${cookie.expires.toUTCString()}`;
  }
  if (cookie.other) {
    ret += `; ${cookie.other.join("; ")}`;
  }
  return ret;
}

function tryDecode(str: string) {
  try {
    str = str.substring(2);
    const dec = atob(str);
    const uint = Uint8Array.from(dec.split(",") as Iterable<number>);
    const ret = decoder.decode(uint) || str;
    if (ret !== str) {
      if (ret.startsWith("j:{") || ret.startsWith("j:[")) {
        const json = ret.substring(2);
        return JSON.parse(decURIComponent(json));
      }
    }
    return decURIComponent(ret);
  } catch (_e) {
    return decURIComponent(str);
  }
}

export function getReqCookies(req: Request, decode?: boolean, i = 0) {
  const str = req.headers.get("Cookie");
  if (str === null) return {};
  const ret = {} as Record<string, string>;
  const arr = str.split(";");
  const len = arr.length;
  while (i < len) {
    const [key, ...oriVal] = arr[i].split("=");
    let val = oriVal.join("=");
    if (decode) {
      ret[key.trim()] = val.startsWith("E:")
        ? tryDecode(val)
        : decURIComponent(val);
    } else {
      val = decURIComponent(val);
      if (val.startsWith("j:{") || val.startsWith("j:[")) {
        const json = val.substring(2);
        ret[key.trim()] = JSON.parse(json);
      } else {
        ret[key.trim()] = val;
      }
    }
    i++;
  }
  return ret;
}

export const list_status: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Not Allowed",
  406: "Not Acceptable",
  408: "Request Time-out",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Request Entity Too Large",
  414: "Request-URI Too Large",
  415: "Unsupported Media Type",
  416: "Requested Range Not Satisfiable",
  421: "Misdirected Request",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Temporarily Unavailable",
  504: "Gateway Time-out",
  505: "HTTP Version Not Supported",
  507: "Insufficient Storage",
};

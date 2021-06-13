import { BadRequestError } from "./error.ts";
import { Handler, NextFunction, RequestEvent, TBodyLimit } from "./types.ts";
import { parseQuery } from "./utils.ts";

const decoder = new TextDecoder();

type TMultipartUpload = {
  name: string;
  maxCount?: number;
  maxSize?: number | string;
  accept?: string;
  callback?: (file: File & { filename: string }) => void;
  dest?: string;
  required?: boolean;
};

type TMultipartHandler = {
  parse?: (data: any, ...args: any) => any;
};

type TSizeList = {
  b: number;
  kb: number;
  mb: number;
  gb: number;
  tb: number;
  pb: number;
  [key: string]: any;
};

async function getBody(request: Request, limit?: number | string) {
  const arrBuff = await request.arrayBuffer();
  if (limit && (arrBuff.byteLength > toBytes(limit))) {
    throw new BadRequestError(`Body is too large. max limit ${limit}`);
  }
  const body = decoder.decode(arrBuff);
  return body;
}

export const withBody = async (
  rev: RequestEvent,
  next: NextFunction,
  parse: (query: any) => any,
  opts?: TBodyLimit,
) => {
  rev.body = {};
  if (rev.request.body && rev.request.bodyUsed === false) {
    const headers = rev.request.headers;
    if (headers.get("content-type") === "application/json") {
      try {
        const body = await getBody(rev.request, opts?.json || "1mb");
        rev.body = JSON.parse(body);
      } catch (error) {
        return next(error);
      }
    } else if (
      headers.get("content-type") === "application/x-www-form-urlencoded"
    ) {
      try {
        const body = await getBody(rev.request, opts?.urlencoded || "1mb");
        rev.body = parse(body);
      } catch (error) {
        return next(error);
      }
    }
  }
  next();
};

const getBodyMultipart = async (
  formData: FormData,
  { parse }: TMultipartHandler = {},
) => {
  return parse
    ? parse(Object.fromEntries(
      Array.from(formData.keys()).map((key) => [
        key,
        formData.getAll(key).length > 1
          ? formData.getAll(key)
          : formData.get(key),
      ]),
    ))
    : parseQuery(formData);
};

const cleanUpBodyMultipart = (body: any) => {
  for (const key in body) {
    if (Array.isArray(body[key])) {
      for (let i = 0; i < body[key].length; i++) {
        const el = body[key][i];
        if (el instanceof File) {
          delete body[key];
          break;
        }
      }
    } else if (body[key] instanceof File) {
      delete body[key];
    }
  }
};

export const multipart = {
  default: (): Handler => {
    return async (rev, next) => {
      if (rev.body === void 0) rev.body = {};
      if (
        rev.request.body && rev.request.bodyUsed === false &&
        rev.request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const formData = await rev.request.formData();
        rev.body = await getBodyMultipart(formData, {
          parse: rev.__parseQuery,
        });
      }
      next();
    };
  },
  upload: (options: TMultipartUpload | TMultipartUpload[]): Handler => {
    return async (rev, next) => {
      if (rev.body === void 0) rev.body = {};
      if (rev.file === void 0) rev.file = {};
      if (
        rev.request.body &&
        rev.request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        if (rev.request.bodyUsed === false) {
          const formData = await rev.request.formData();
          rev.body = await getBodyMultipart(formData, {
            parse: rev.__parseQuery,
          });
        }

        const validateFiles = async (files: File[], opts: TMultipartUpload) => {
          let j = 0, len = files.length;
          if (opts?.maxCount) {
            if (len > opts.maxCount) {
              throw new BadRequestError(
                `${opts.name} no more than ${opts.maxCount} file`,
              );
            }
          }
          while (j < len) {
            const file = files[j] as File;
            const ext = file.name.substring(file.name.lastIndexOf(".") + 1);
            if (opts?.accept) {
              if (!opts.accept.includes(ext)) {
                throw new BadRequestError(
                  `${opts.name} only accept ${opts.accept}`,
                );
              }
            }
            if (opts?.maxSize) {
              if (file.size > toBytes(opts.maxSize)) {
                throw new BadRequestError(
                  `${opts.name} to large, maxSize = ${opts.maxSize}`,
                );
              }
            }
            j++;
          }
        };
        const uploadFiles = async (files: File[], opts: TMultipartUpload) => {
          const cwd = Deno.cwd();
          let i = 0, len = files.length;
          while (i < len) {
            const file = files[i] as File & { filename: string; path: string };
            const ext = file.name.substring(file.name.lastIndexOf(".") + 1);
            if (opts?.callback) opts.callback(file);
            let dest = opts.dest || "";
            if (dest.lastIndexOf("/") === -1) {
              dest += "/";
            }
            file.filename = file.filename ||
              Date.now() + file.lastModified.toString() + "_" +
                file.name.substring(0, 16).replace(/\./g, "") + "." + ext;
            file.path = file.path ||
              ((dest !== "/" ? dest : "") + file.filename);
            const arrBuff = await file.arrayBuffer();
            await Deno.writeFile(
              cwd + "/" + dest + file.filename,
              new Uint8Array(arrBuff),
            );
            i++;
          }
        };
        if (Array.isArray(options)) {
          let j = 0, i = 0, len = options.length;
          while (j < len) {
            const obj = options[j] as TMultipartUpload;
            if (obj.required && rev.body[obj.name] === void 0) {
              throw new BadRequestError(
                `Field ${obj.name} is required`,
              );
            }
            if (rev.body[obj.name]) {
              rev.file[obj.name] = rev.body[obj.name];
              const objFile = rev.file[obj.name];
              const files = Array.isArray(objFile) ? objFile : [objFile];
              await validateFiles(files, obj);
            }
            j++;
          }
          while (i < len) {
            const obj = options[i] as TMultipartUpload;
            if (rev.body[obj.name]) {
              rev.file[obj.name] = rev.body[obj.name];
              const objFile = rev.file[obj.name];
              const files = Array.isArray(objFile) ? objFile : [objFile];
              await uploadFiles(files, obj);
              delete rev.body[obj.name];
            }
            i++;
          }
          cleanUpBodyMultipart(rev.body);
        } else if (typeof options === "object") {
          const obj = options as TMultipartUpload;
          if (obj.required && rev.body[obj.name] === void 0) {
            throw new BadRequestError(
              `Field ${obj.name} is required`,
            );
          }
          if (rev.body[obj.name]) {
            rev.file[obj.name] = rev.body[obj.name];
            const objFile = rev.file[obj.name];
            const files = Array.isArray(objFile) ? objFile : [objFile];
            await validateFiles(files, obj);
            await uploadFiles(files, obj);
            delete rev.body[obj.name];
          }
          cleanUpBodyMultipart(rev.body);
        }
      }
      next();
    };
  },
};

function toBytes(arg: string | number) {
  let sizeList: TSizeList = {
    b: 1,
    kb: 1 << 10,
    mb: 1 << 20,
    gb: 1 << 30,
    tb: Math.pow(1024, 4),
    pb: Math.pow(1024, 5),
  };
  if (typeof arg === "number") return arg;
  let arr = (/^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i).exec(arg),
    val: any,
    unt = "b";
  if (!arr) {
    val = parseInt(val, 10);
    unt = "b";
  } else {
    val = parseFloat(arr[1]);
    unt = arr[4].toLowerCase();
  }
  return Math.floor(sizeList[unt] * val);
}

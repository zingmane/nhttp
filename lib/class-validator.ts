import {
  validateOrReject,
  ValidatorOptions,
} from "https://esm.sh/class-validator@0.14.0";
import { Handler, HttpError, RequestEvent, TRet } from "./deps.ts";
import { joinHandlers, TDecorator } from "./controller.ts";
export * from "https://esm.sh/class-validator@0.14.0";

type Class = { new (...args: TRet[]): TRet };

type TOptions = ValidatorOptions & {
  plainToClass?: (...args: TRet) => TRet;
  onError?: (err: TRet, rev: RequestEvent) => TRet;
};
/**
 * validate using `class-validator`.
 * @example
 * app.post("/save", validate(UserDto), ...handlers);
 */
export function validate<
  S extends string = "body",
  T extends Class = Class,
>(
  cls: T,
  opts: TOptions = {},
  target = <S> "body",
): Handler<{ [k in S]: InstanceType<T> }> {
  return async (rev, next) => {
    try {
      let obj;
      if (opts.plainToClass) {
        obj = opts.plainToClass(cls, rev[target]);
        delete opts.plainToClass;
      } else {
        obj = new cls();
        Object.assign(obj, rev[target]);
      }
      await validateOrReject(obj, opts);
    } catch (error) {
      if (opts.onError) {
        return opts.onError(error, rev);
      }
      throw new HttpError(422, error);
    }
    return next();
  };
}

/**
 * validate using `class-validator` for decorators.
 */
export function Validate(
  cls: Class,
  opts: TOptions = {},
  target = "body",
): TDecorator {
  return (tgt: TRet, prop: string, des: PropertyDescriptor) => {
    joinHandlers(tgt.constructor.name, prop, [validate(cls, opts, target)]);
    return des;
  };
}

export default validate;

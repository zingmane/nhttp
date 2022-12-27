import { TObject, TRet } from "./types";
export type RespondWith = (r: Response | Promise<Response>) => Promise<void> | Response;
export declare class RequestEvent {
    request: Request;
    /**
     * conn
     * @deprecated
     * Use `rev.info()` instead.
     * @example
     * const [conn] = rev.info();
     * console.log(conn);
     */
    conn: TObject | undefined;
    /**
     * lookup info as array
     * @example
     * const [conn] = rev.info();
     * console.log(conn);
     */
    info: () => TObject[];
    respondWith: RespondWith;
    search: string | undefined;
    constructor(request: Request);
    get response(): any;
    /**
     * lookup info responseInit.
     * @example
     * const { headers, status, statusText } = rev.responseInit;
     * console.log(headers, status, statusText);
     */
    get responseInit(): ResponseInit;
    /**
     * file.
     * @example
     * const file = rev.file;
     * console.log(file);
     */
    get file(): TObject;
    set file(val: TObject);
    /**
     * get cookies from request.
     * @example
     * const cookie = rev.cookies;
     * console.log(cookie);
     */
    get cookies(): TObject;
    set cookies(val: TObject);
    /**
     * params as json object.
     * @example
     * // get "/hello/:name/:user"
     * const params = rev.params;
     * console.log(params);
     * // => { name: "john", user: "john" }
     */
    get params(): TObject;
    set params(val: TObject);
    /**
     * body as json object.
     * @example
     * const body = rev.body;
     * console.log(body);
     */
    get body(): TObject;
    set body(val: TObject);
    /**
     * url
     * @example
     * // get "/hello?name=john" in browser.
     * const url = rev.url;
     * console.log(url);
     * // => /hello?name=john
     */
    get url(): string;
    set url(val: string);
    /**
     * originalUrl
     * @example
     * // get "/hello?name=john" in browser.
     * const url = rev.originalUrl;
     * console.log(url);
     * // => /hello?name=john
     */
    get originalUrl(): string;
    /**
     * lookup path
     * @example
     * // get "/hello" in browser.
     * const path = rev.path;
     * console.log(path);
     * // => /hello
     */
    get path(): string;
    set path(val: string);
    /**
     * lookup query parameter
     * @example
     * // get "/hello?name=john" in browser.
     * const query = rev.query;
     * console.log(query);
     * // => { name: "john" }
     */
    get query(): TObject;
    set query(val: TObject);
    /**
     * get cookies from request
     * @deprecated
     * Use `rev.cookies` instead. `rev.cookies`, auto decode when cookie is encode.
     * @example
     * const object = rev.getCookies();
     * const objectWithDecode = rev.getCookies(true);
     */
    getCookies: (decode?: boolean) => TObject;
    [k: string]: TRet;
}

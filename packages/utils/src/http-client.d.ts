export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type Config = {
    cache: 'no-store';
} | {
    cache: 'force-cache';
};
interface Params {
    cache?: Config;
    params?: Record<string, any>;
    headers?: Record<string, any>;
}
interface Props extends Params {
    url: string;
    method: Method;
}
export declare class HttpClient {
    private baseUrl;
    constructor(baseUrl: string);
    /**
     * 请求拦截器
     */
    interceptorsRequest({ url, method, params, cache, headers }: Props): {
        url: string;
        options: RequestInit;
    };
    /**
     * 响应拦截器
     */
    interceptorsResponse<T>(res: Response): Promise<T>;
    httpFactory<T>({ url, params, method }: Props): Promise<T>;
    request<T>(method: Method, url: string, params?: Params): Promise<T>;
    get<T>(url: string, params?: Params): Promise<T>;
    post<T>(url: string, params?: Params): Promise<T>;
    put<T>(url: string, params?: Params): Promise<T>;
    delete<T>(url: string, params?: Params): Promise<T>;
    patch<T>(url: string, params?: Params): Promise<T>;
}
export {};

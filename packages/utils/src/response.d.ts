export declare class Response<T> {
    constructor(code?: number, msg?: string, data?: T);
    code: number;
    msg?: string;
    data?: T;
    static ok<T>(data?: T): Response<T>;
}

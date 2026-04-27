"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
class HttpClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    /**
     * 请求拦截器
     */
    interceptorsRequest({ url, method, params, cache, headers = {} }) {
        // url参数
        let queryParams = '';
        // 请求体数据
        let requestPayload = '';
        const config = cache || { cache: 'no-store' };
        if (method === 'GET' || method === 'DELETE') {
            // fetch对GET请求, 拼接url参数
            if (params) {
                const searchParams = new URLSearchParams(params);
                // 删除值为 undefined、null 或空字符串的参数
                Object.keys(params).forEach((key) => {
                    const value = params[key];
                    if (value === undefined || value === null || value === '') {
                        searchParams.delete(key);
                    }
                });
                queryParams = searchParams.toString();
                url = `${url}?${queryParams}`;
            }
        }
        else {
            // 非form-data传输JSON数据格式
            if (!['[object FormData]', '[object URLSearchParams]'].includes(Object.prototype.toString.call(params))) {
                Object.assign(headers, { 'Content-Type': 'application/json' });
                requestPayload = JSON.stringify(params);
            }
        }
        return {
            url,
            options: {
                method,
                headers,
                body: method !== 'GET' && method !== 'DELETE' ? requestPayload : undefined,
                ...config,
            },
        };
    }
    /**
     * 响应拦截器
     */
    async interceptorsResponse(res) {
        return new Promise((resolve, reject) => {
            const requestUrl = res.url;
            if (res.ok) {
                return resolve(res.json());
            }
            else {
                res
                    .clone()
                    .text()
                    .then((text) => {
                    try {
                        return resolve(JSON.parse(text));
                    }
                    catch {
                        return reject({
                            code: 500,
                            msg: text,
                            url: requestUrl,
                        });
                    }
                });
            }
        });
    }
    async httpFactory({ url = '', params = {}, method }) {
        const req = this.interceptorsRequest({
            url: url.startsWith('http') ? url : this.baseUrl + url,
            method,
            params: params.params,
            cache: params.cache,
            headers: params.headers,
        });
        const res = await fetch(req.url, req.options);
        return this.interceptorsResponse(res);
    }
    async request(method, url, params) {
        return this.httpFactory({ url, params, method });
    }
    get(url, params) {
        return this.request('GET', url, params);
    }
    post(url, params) {
        return this.request('POST', url, params);
    }
    put(url, params) {
        return this.request('PUT', url, params);
    }
    delete(url, params) {
        return this.request('DELETE', url, params);
    }
    patch(url, params) {
        return this.request('PATCH', url, params);
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map
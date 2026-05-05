import { FileEnvType } from "@prisma/client";

/** Minimal request shape for isWeChatMiniProgram — avoids FastifyRequest version conflicts across workspaces */
interface MinimalRequest {
  headers: Record<string, string | string[] | undefined>;
}

function convertToDockerHost(url: string): string {
  return url
    .replace(/127\.0\.0\.1/g, "host.docker.internal")
    .replace(/localhost/g, "host.docker.internal");
}

export default {
  getBaseZone() {
    return process.env?.BASE_ZONE || "cn";
  },
  getNeedSsoLogin() {
    return process.env?.NEED_SSO_LOGIN || "true";
  },
  getDevDebug() {
    return process.env?.LOCAL_DEV_DEBUG || "true";
  },
  getDevConnectProdDB() {
    return process.env?.DEV_USE_PRODDB || "false";
  },

  getEnv(): FileEnvType {
    if (
      process.env?.NODE_ENV === "prod" ||
      process.env?.NODE_ENV === "production"
    ) {
      return FileEnvType.prod;
    }
    if (process.env?.NODE_ENV === "produs") {
      return FileEnvType.produs;
    }
    if (process.env?.NODE_ENV === "prodap") {
      return FileEnvType.prodap;
    }
    if (process.env?.NODE_ENV === "test") {
      return FileEnvType.test;
    }
    return FileEnvType.dev;
  },

  isDevDebug() {
    return this.isDev() && this.getDevDebug() === "true";
  },

  isDevConnectProdDB() {
    return this.isDevDebug() && this.getDevConnectProdDB() === "true";
  },

  isDev() {
    // return false
    return this.getEnv() === "dev";
  },

  isTest() {
    return this.getEnv() === "test";
  },

  isProduction() {
    return this.getEnv().startsWith("prod");
  },

  isCheckSha256() {
    return this.isProduction();
  },

  isCnProduction() {
    return this.getEnv() === "prod";
  },

  isApProduction() {
    return this.getEnv() === "prodap";
  },

  checkEnvCanSso() {
    return ["dev", "test", "prod"].indexOf(this.getEnv()) !== -1;
  },

  isWeChatMiniProgram(req: MinimalRequest) {
    const raw = req.headers["user-agent"];
    const userAgent = (Array.isArray(raw) ? raw[0] : raw || "").toLowerCase();
    return (
      userAgent.includes("micromessenger") &&
      (userAgent.includes("miniprogram") ||
        userAgent.includes("wechatdevtools"))
    );
  },

  generateEnvironmentUrls(options?: {
    domain?: string;
    subDomain?: string;
    apiSubDomain?: string;
  }): {
    web: string;
    api: string;
    internalApi: string;
    short: string;
    corsDomains: string[];
  } {
    const domain = options?.domain ?? "dofe.ai";
    const subDomain = options?.subDomain ?? "www";
    const apiSubDomain = options?.apiSubDomain ?? "api";
    const protocol = this.isProduction() ? "https" : "http";
    const corsDomains = ["*", `*.${domain}`];

    const web = `${protocol}://${subDomain ? `${subDomain}.` : ""}${domain}/`;
    let api = `${protocol}://${apiSubDomain ? `${apiSubDomain}.` : ""}${domain}/api`;
    let internalApi = api;

    const short = `${web}s/`;
    return { web, api, internalApi, short, corsDomains };
  },

  getContainerAccessibleInternalApiUrl(options?: {
    domain?: string;
    subDomain?: string;
    apiSubDomain?: string;
  }): string {
    const internalApi = this.generateEnvironmentUrls(options).internalApi;
    return convertToDockerHost(internalApi);
  },
};

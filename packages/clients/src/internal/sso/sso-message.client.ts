import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

@Injectable()
export class SsoMessageClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get ssoInternalUrl(): string {
    return (
      this.configService.get<string>("SSO_INTERNAL_API_URL") ||
      "http://localhost:3102/api"
    );
  }

  private get serviceName(): string {
    return this.configService.get<string>("SSO_SERVICE_NAME") || "";
  }

  async createSystemMessage(
    title: string | null,
    content: unknown,
    recipientIds: string[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.ssoInternalUrl}/message/internal/messages`,
          {
            type: "SYSTEM",
            title: title ?? undefined,
            content,
            recipientIds,
            metadata,
          },
          {
            headers: {
              Authorization: `Bearer ${this.getServiceToken()}`,
              "X-Service-Name": this.serviceName,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          },
        ),
      );
    } catch {
      // 降级：消息发送失败不阻塞主流程
    }
  }

  private getServiceToken(): string {
    return this.configService.get<string>("INTERNAL_API_SECRET") || "";
  }
}

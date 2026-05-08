import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SsoMessageProxyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get ssoBaseUrl(): string {
    return (
      this.configService.get<string>('SSO_API_URL') ||
      'http://localhost:3102/api'
    );
  }

  async forwardGet(
    path: string,
    params: Record<string, unknown>,
    authHeader?: string,
  ) {
    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await firstValueFrom(
      this.httpService.get(`${this.ssoBaseUrl}${path}`, { headers, params }),
    );
    return response.data;
  }

  async forwardPatch(path: string, body: unknown, authHeader?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await firstValueFrom(
      this.httpService.patch(`${this.ssoBaseUrl}${path}`, body, { headers }),
    );
    return response.data;
  }
}

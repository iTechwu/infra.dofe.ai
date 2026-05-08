import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { SsoMessageClient } from "./sso-message.client";
import { SsoMessageProxyService } from "./sso-message-proxy.service";
import { SsoAuthClient } from "./sso-auth.client";

@Module({
  imports: [HttpModule.register({ timeout: 5000 }), ConfigModule],
  providers: [SsoMessageClient, SsoMessageProxyService, SsoAuthClient],
  exports: [SsoMessageClient, SsoMessageProxyService, SsoAuthClient],
})
export class SsoClientModule {}

import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { SsoMessageClient } from "./sso-message.client";
import { SsoMessageProxyService } from "./sso-message-proxy.service";
import { SsoAuthClient } from "./sso-auth.client";
import { SsoRbacClient } from "./sso-rbac.client";

@Module({
  imports: [HttpModule.register({ timeout: 5000 }), ConfigModule],
  providers: [SsoMessageClient, SsoMessageProxyService, SsoAuthClient, SsoRbacClient],
  exports: [SsoMessageClient, SsoMessageProxyService, SsoAuthClient, SsoRbacClient],
})
export class SsoClientModule {}

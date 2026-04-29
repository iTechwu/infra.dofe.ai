/**
 * 飞书 API 客户端
 *
 * 职责：
 * - 获取和管理 Tenant Access Token
 * - 发送消息到飞书
 * - 不包含业务逻辑
 * - 不访问数据库
 */
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  FeishuCredentials,
  FeishuChannelConfig,
  TenantAccessTokenResponse,
  FeishuSendMessageRequest,
  FeishuSendMessageResponse,
  FeishuCardContent,
  FeishuUserInfo,
  FeishuChatInfo,
  FeishuImageData,
  FeishuFileData,
  FeishuDepartment,
  FeishuContactUser,
  FeishuDepartmentListResponse,
  FeishuUserListResponse,
  FeishuGetChildrenDepartmentsParams,
  FeishuGetDepartmentUsersParams,
  FeishuBitableTable,
  FeishuBitableRecord,
  FeishuListRecordsParams,
  FeishuBitableRecordListResponse,
  FeishuCreateRecordResponse,
  FeishuBatchCreateRecordsRequest,
  FeishuBatchCreateRecordsResponse,
  FeishuUpdateRecordResponse,
  FeishuDeleteRecordResponse,
} from './feishu.types';

export class FeishuApiClient {
  private tenantAccessToken: string | null = null;
  private tokenExpireAt: number = 0;
  private readonly baseUrl: string;

  constructor(
    private readonly credentials: FeishuCredentials,
    private readonly config: FeishuChannelConfig,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {
    // 根据配置选择飞书或 Lark 国际版
    this.baseUrl =
      config.domain === 'lark'
        ? 'https://open.larksuite.com/open-apis'
        : 'https://open.feishu.cn/open-apis';
  }

  /**
   * 获取 Tenant Access Token
   * 自动缓存和刷新
   */
  async getTenantAccessToken(): Promise<string> {
    // 检查缓存的 token 是否有效（提前 5 分钟刷新）
    if (this.tenantAccessToken && Date.now() < this.tokenExpireAt - 300000) {
      return this.tenantAccessToken;
    }

    const url = `${this.baseUrl}/auth/v3/tenant_access_token/internal`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<TenantAccessTokenResponse>(url, {
          app_id: this.credentials.appId,
          app_secret: this.credentials.appSecret,
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to get tenant access token: ${response.data.msg}`,
        );
      }

      this.tenantAccessToken = response.data.tenant_access_token!;
      // expire 是秒数，转换为毫秒时间戳
      this.tokenExpireAt = Date.now() + (response.data.expire || 7200) * 1000;

      this.logger.info('Feishu tenant access token refreshed', {
        expireAt: new Date(this.tokenExpireAt).toISOString(),
      });

      return this.tenantAccessToken;
    } catch (error) {
      this.logger.error('Failed to get Feishu tenant access token', { error });
      throw error;
    }
  }

  /**
   * 发送消息
   * @param receiveIdType 接收者 ID 类型：open_id, user_id, union_id, email, chat_id
   * @param request 消息请求
   */
  async sendMessage(
    receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id',
    request: FeishuSendMessageRequest,
  ): Promise<FeishuSendMessageResponse> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/im/v1/messages?receive_id_type=${receiveIdType}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<FeishuSendMessageResponse>(url, request, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
        }),
      );

      if (response.data.code !== 0) {
        this.logger.error('Failed to send Feishu message', {
          code: response.data.code,
          msg: response.data.msg,
        });
        throw new Error(`Failed to send message: ${response.data.msg}`);
      }

      this.logger.info('Feishu message sent', {
        messageId: response.data.data?.message_id,
        chatId: response.data.data?.chat_id,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to send Feishu message', { error });
      throw error;
    }
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(
    chatId: string,
    text: string,
  ): Promise<FeishuSendMessageResponse> {
    return this.sendMessage('chat_id', {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    });
  }

  /**
   * 回复消息
   */
  async replyMessage(
    messageId: string,
    text: string,
  ): Promise<FeishuSendMessageResponse> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/im/v1/messages/${messageId}/reply`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<FeishuSendMessageResponse>(
          url,
          {
            msg_type: 'text',
            content: JSON.stringify({ text }),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to reply message: ${response.data.msg}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error('Failed to reply Feishu message', { error });
      throw error;
    }
  }

  /**
   * 发送卡片消息
   */
  async sendCardMessage(
    chatId: string,
    card: FeishuCardContent,
  ): Promise<FeishuSendMessageResponse> {
    return this.sendMessage('chat_id', {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    });
  }

  /**
   * 更新卡片消息
   */
  async updateCardMessage(
    messageId: string,
    card: FeishuCardContent,
  ): Promise<FeishuSendMessageResponse> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/im/v1/messages/${messageId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.patch<FeishuSendMessageResponse>(
          url,
          {
            msg_type: 'interactive',
            content: JSON.stringify(card),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to update card message: ${response.data.msg}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error('Failed to update Feishu card message', { error });
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(
    userId: string,
    userIdType: 'open_id' | 'user_id' | 'union_id' = 'open_id',
  ): Promise<FeishuUserInfo> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/contact/v3/users/${userId}?user_id_type=${userIdType}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: { user: FeishuUserInfo };
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0 || !response.data.data?.user) {
        throw new Error(`Failed to get user info: ${response.data.msg}`);
      }

      return response.data.data.user;
    } catch (error) {
      this.logger.error('Failed to get Feishu user info', { error });
      throw error;
    }
  }

  /**
   * 获取群信息
   */
  async getChatInfo(chatId: string): Promise<FeishuChatInfo> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/im/v1/chats/${chatId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: FeishuChatInfo;
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(`Failed to get chat info: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get Feishu chat info', { error });
      throw error;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): FeishuChannelConfig {
    return this.config;
  }

  /**
   * 获取飞书文档（docx 类型）的纯文本内容
   * 使用飞书开放平台 docx v1 API
   *
   * @param documentId 文档 token（即 docToken）
   * @returns 文档纯文本内容
   */
  async getDocxRawContent(documentId: string): Promise<string> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/docx/v1/documents/${documentId}/raw_content`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: { content: string };
        }>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(
          `Failed to get document raw content: ${response.data.msg}`,
        );
      }

      return response.data.data.content;
    } catch (error) {
      this.logger.error('Failed to get Feishu docx raw content', {
        documentId,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取飞书 Wiki 节点信息
   * 用于将 wiki token 解析为底层文档的 obj_token
   *
   * @param wikiToken wiki 节点 token
   * @returns objToken（底层文档 token）和 objType（文档类型）
   */
  async getWikiNodeInfo(
    wikiToken: string,
  ): Promise<{ objToken: string; objType: string }> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/wiki/v2/spaces/get_node?token=${wikiToken}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: { node: { obj_token: string; obj_type: string } };
        }>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      if (response.data.code !== 0 || !response.data.data?.node) {
        throw new Error(`Failed to get wiki node info: ${response.data.msg}`);
      }

      return {
        objToken: response.data.data.node.obj_token,
        objType: response.data.data.node.obj_type,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu wiki node info', {
        wikiToken,
        error,
      });
      throw error;
    }
  }

  /**
   * 下载飞书图片并返回 Base64 编码数据
   *
   * 重要：飞书有两种图片下载 API：
   * 1. /im/v1/images/:image_key - 只能下载机器人自己上传的图片
   * 2. /im/v1/messages/:message_id/resources/:file_key - 下载用户发送的消息中的图片
   *
   * 此方法使用第二种 API 来下载用户发送的图片
   *
   * @param messageId 消息 ID（从事件中获取）
   * @param fileKey 文件 key（从消息内容中提取的 image_key）
   * @returns 图片数据（Base64、MIME 类型、大小）
   */
  async getImageDataFromMessage(
    messageId: string,
    fileKey: string,
  ): Promise<FeishuImageData> {
    const token = await this.getTenantAccessToken();
    // 使用获取消息资源文件 API（用于下载用户发送的图片）
    const url = `${this.baseUrl}/im/v1/messages/${messageId}/resources/${fileKey}?type=image`;

    this.logger.info('Downloading Feishu image from message', {
      url,
      messageId,
      fileKey,
      hasToken: !!token,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        }),
      );

      // 从响应头获取 MIME 类型
      const contentType =
        response.headers['content-type'] || 'application/octet-stream';

      // 转换为 Base64
      const base64 = Buffer.from(response.data).toString('base64');

      this.logger.info('Feishu image downloaded successfully', {
        messageId,
        fileKey,
        mimeType: contentType,
        size: response.data.byteLength,
      });

      return {
        base64,
        mimeType: contentType,
        size: response.data.byteLength,
      };
    } catch (error) {
      // 尝试解析错误响应体（Feishu 返回 JSON 错误信息）
      let errorDetail =
        error instanceof Error ? error.message : 'Unknown error';
      if (error?.response?.data) {
        try {
          const errorData = error.response.data;
          if (Buffer.isBuffer(errorData)) {
            const errorText = errorData.toString('utf-8');
            const errorJson = JSON.parse(errorText);
            errorDetail = `${errorJson.code}: ${errorJson.msg} (${error.message})`;
          } else if (errorData instanceof ArrayBuffer) {
            const errorText = Buffer.from(new Uint8Array(errorData)).toString(
              'utf-8',
            );
            const errorJson = JSON.parse(errorText);
            errorDetail = `${errorJson.code}: ${errorJson.msg} (${error.message})`;
          } else if (typeof errorData === 'object') {
            errorDetail = `${errorData.code}: ${errorData.msg} (${error.message})`;
          }
        } catch {
          // 解析失败，使用原始错误信息
        }
      }
      this.logger.error('Failed to download Feishu image from message', {
        messageId,
        fileKey,
        error: errorDetail,
        status: error?.response?.status,
      });
      throw error;
    }
  }

  /**
   * 下载飞书文件并返回 Base64 编码数据
   *
   * 使用获取消息资源文件 API 下载用户发送的文件
   *
   * @param messageId 消息 ID（从事件中获取）
   * @param fileKey 文件 key（从消息内容中提取的 file_key）
   * @param fileName 文件名（用于记录日志）
   * @returns 文件数据（Base64、MIME 类型、大小、文件名）
   */
  async getFileDataFromMessage(
    messageId: string,
    fileKey: string,
    fileName: string,
  ): Promise<FeishuFileData> {
    const token = await this.getTenantAccessToken();
    // 使用获取消息资源文件 API（用于下载用户发送的文件）
    const url = `${this.baseUrl}/im/v1/messages/${messageId}/resources/${fileKey}?type=file`;

    this.logger.info('Downloading Feishu file from message', {
      url,
      messageId,
      fileKey,
      fileName,
      hasToken: !!token,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        }),
      );

      // 从响应头获取 MIME 类型
      const contentType =
        response.headers['content-type'] || 'application/octet-stream';

      // 转换为 Base64
      const base64 = Buffer.from(response.data).toString('base64');

      this.logger.info('Feishu file downloaded successfully', {
        messageId,
        fileKey,
        fileName,
        mimeType: contentType,
        size: response.data.byteLength,
      });

      return {
        base64,
        mimeType: contentType,
        size: response.data.byteLength,
        fileName,
      };
    } catch (error) {
      // 尝试解析错误响应体（Feishu 返回 JSON 错误信息）
      let errorDetail =
        error instanceof Error ? error.message : 'Unknown error';
      if (error?.response?.data) {
        try {
          const errorData = error.response.data;
          if (Buffer.isBuffer(errorData)) {
            const errorText = errorData.toString('utf-8');
            const errorJson = JSON.parse(errorText);
            errorDetail = `${errorJson.code}: ${errorJson.msg} (${error.message})`;
          } else if (errorData instanceof ArrayBuffer) {
            const errorText = Buffer.from(new Uint8Array(errorData)).toString(
              'utf-8',
            );
            const errorJson = JSON.parse(errorText);
            errorDetail = `${errorJson.code}: ${errorJson.msg} (${error.message})`;
          } else if (typeof errorData === 'object') {
            errorDetail = `${errorData.code}: ${errorData.msg} (${error.message})`;
          }
        } catch {
          // 解析失败，使用原始错误信息
        }
      }
      this.logger.error('Failed to download Feishu file from message', {
        messageId,
        fileKey,
        fileName,
        error: errorDetail,
        status: error?.response?.status,
      });
      throw error;
    }
  }

  // ==================== 飞书通讯录 API ====================

  /**
   * 获取子部门列表
   * 参考: https://open.feishu.cn/document/server-docs/contact-v3/department/children
   *
   * @param params 请求参数
   * @returns 子部门列表
   */
  async getChildrenDepartments(
    params: FeishuGetChildrenDepartmentsParams,
  ): Promise<{
    departments: FeishuDepartment[];
    hasMore: boolean;
    pageToken?: string;
  }> {
    const token = await this.getTenantAccessToken();
    const {
      department_id,
      page_size = 50,
      page_token,
      user_id_type = 'open_id',
      department_id_type = 'department_id',
      fetch_child = false,
    } = params;

    const queryParams = new URLSearchParams({
      department_id,
      page_size: String(page_size),
      user_id_type,
      department_id_type,
      fetch_child: String(fetch_child),
    });

    if (page_token) {
      queryParams.append('page_token', page_token);
    }

    const url = `${this.baseUrl}/contact/v3/departments/${department_id}/children?${queryParams.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<FeishuDepartmentListResponse>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to get children departments: ${response.data.msg}`,
        );
      }

      return {
        departments: response.data.data?.items || [],
        hasMore: response.data.data?.has_more || false,
        pageToken: response.data.data?.page_token,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu children departments', {
        departmentId: department_id,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取部门信息
   * 参考: https://open.feishu.cn/document/server-docs/contact-v3/department/get
   *
   * @param departmentId 部门 ID
   * @returns 部门信息
   */
  async getDepartment(departmentId: string): Promise<FeishuDepartment> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/contact/v3/departments/${departmentId}?department_id_type=department_id&user_id_type=open_id`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: { department: FeishuDepartment };
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0 || !response.data.data?.department) {
        throw new Error(`Failed to get department: ${response.data.msg}`);
      }

      return response.data.data.department;
    } catch (error) {
      this.logger.error('Failed to get Feishu department', {
        departmentId,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取部门用户列表
   * 参考: https://open.feishu.cn/document/server-docs/contact-v3/user/find_by_department
   *
   * @param params 请求参数
   * @returns 用户列表
   */
  async getDepartmentUsers(params: FeishuGetDepartmentUsersParams): Promise<{
    users: FeishuContactUser[];
    hasMore: boolean;
    pageToken?: string;
  }> {
    const token = await this.getTenantAccessToken();
    const {
      department_id,
      page_size = 50,
      page_token,
      user_id_type = 'open_id',
      department_id_type = 'department_id',
    } = params;

    const queryParams = new URLSearchParams({
      department_id,
      page_size: String(page_size),
      user_id_type,
      department_id_type,
    });

    if (page_token) {
      queryParams.append('page_token', page_token);
    }

    const url = `${this.baseUrl}/contact/v3/users/find_by_department?${queryParams.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<FeishuUserListResponse>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get department users: ${response.data.msg}`);
      }

      return {
        users: response.data.data?.items || [],
        hasMore: response.data.data?.has_more || false,
        pageToken: response.data.data?.page_token,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu department users', {
        departmentId: department_id,
        error,
      });
      throw error;
    }
  }

  /**
   * 批量获取用户信息
   * 参考: https://open.feishu.cn/document/server-docs/contact-v3/user/batch_get_id
   *
   * @param userIds 用户 ID 列表
   * @param userIdType 用户 ID 类型
   * @returns 用户信息列表
   */
  async batchGetUsers(
    userIds: string[],
    userIdType: 'open_id' | 'user_id' | 'union_id' = 'open_id',
  ): Promise<FeishuContactUser[]> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/contact/v3/users/batch?user_id_type=${userIdType}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          code: number;
          msg: string;
          data?: { users?: FeishuContactUser[] };
        }>(
          url,
          { user_ids: userIds },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to batch get users: ${response.data.msg}`);
      }

      return response.data.data?.users || [];
    } catch (error) {
      this.logger.error('Failed to batch get Feishu users', {
        userIdCount: userIds.length,
        error,
      });
      throw error;
    }
  }

  /**
   * 递归获取所有部门（从根部门开始）
   *
   * @param onProgress 进度回调
   * @returns 所有部门列表
   */
  async getAllDepartments(
    onProgress?: (current: number, total: number) => void,
  ): Promise<FeishuDepartment[]> {
    const allDepartments: FeishuDepartment[] = [];
    let processedCount = 0;

    const fetchRecursively = async (parentId: string): Promise<void> => {
      const { departments, hasMore, pageToken } =
        await this.getChildrenDepartments({
          department_id: parentId,
          page_size: 50,
        });

      for (const dept of departments) {
        allDepartments.push(dept);
        processedCount++;
        onProgress?.(processedCount, allDepartments.length);

        // 递归获取子部门
        if (dept.has_child) {
          await fetchRecursively(dept.department_id);
        }
      }

      // 处理分页
      if (hasMore && pageToken) {
        let nextToken = pageToken;
        while (nextToken) {
          const {
            departments: moreDepts,
            hasMore: moreHasMore,
            pageToken: moreToken,
          } = await this.getChildrenDepartments({
            department_id: parentId,
            page_size: 50,
            page_token: nextToken,
          });

          for (const dept of moreDepts) {
            allDepartments.push(dept);
            processedCount++;
            onProgress?.(processedCount, allDepartments.length);

            if (dept.has_child) {
              await fetchRecursively(dept.department_id);
            }
          }

          nextToken = moreHasMore && moreToken ? moreToken : '';
        }
      }
    };

    // 从根部门开始获取
    await fetchRecursively('0');

    return allDepartments;
  }

  // ==================== 飞书 OAuth2 相关 API ====================

  /**
   * 获取用户 Access Token（通过授权码换取）
   * 参考: https://open.feishu.cn/document/common-capabilities/sso/web-application-sdk/web-app-overview
   *
   * @param code 授权码
   * @returns 用户 Access Token 信息
   */
  async getUserAccessToken(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expireIn: number;
    tokenType: string;
  }> {
    const url = `${this.baseUrl}/authen/v1/oidc/access_token`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          code: number;
          msg: string;
          data?: {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            token_type: string;
          };
        }>(
          url,
          {
            grant_type: 'authorization_code',
            code,
          },
          {
            headers: {
              Authorization: `Bearer ${await this.getTenantAccessToken()}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(
          `Failed to get user access token: ${response.data.msg}`,
        );
      }

      this.logger.info('Feishu user access token obtained', {
        expireIn: response.data.data.expires_in,
      });

      return {
        accessToken: response.data.data.access_token,
        refreshToken: response.data.data.refresh_token,
        expireIn: response.data.data.expires_in,
        tokenType: response.data.data.token_type,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu user access token', { error });
      throw error;
    }
  }

  /**
   * 获取用户信息（通过用户 Access Token）
   * 参考: https://open.feishu.cn/document/common-capabilities/sso/web-application-sdk/get-user-info
   *
   * @param userAccessToken 用户 Access Token
   * @returns 用户信息
   */
  async getUserInfoByAccessToken(userAccessToken: string): Promise<{
    openId: string;
    unionId: string;
    userId: string;
    name: string;
    avatarUrl: string;
    email: string;
    mobile: string;
  }> {
    const url = `${this.baseUrl}/authen/v1/user_info`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: {
            open_id: string;
            union_id: string;
            user_id: string;
            name: string;
            avatar_url: string;
            email: string;
            mobile: string;
          };
        }>(url, {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
          },
        }),
      );

      if (response.data.code !== 0 || !response.data.data) {
        throw new Error(`Failed to get user info: ${response.data.msg}`);
      }

      this.logger.info('Feishu user info obtained', {
        openId: response.data.data.open_id,
        name: response.data.data.name,
      });

      return {
        openId: response.data.data.open_id,
        unionId: response.data.data.union_id,
        userId: response.data.data.user_id,
        name: response.data.data.name,
        avatarUrl: response.data.data.avatar_url,
        email: response.data.data.email,
        mobile: response.data.data.mobile,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu user info', { error });
      throw error;
    }
  }

  // ==================== 飞书多维表格（Bitable）API ====================

  /**
   * 获取多维表格元数据
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-app/get
   *
   * @param appToken 多维表格 App Token
   * @returns 多维表格信息
   */
  async getBitable(appToken: string): Promise<{
    name: string;
    appToken: string;
  }> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: {
            app: {
              name: string;
              app_token: string;
            };
          };
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0 || !response.data.data?.app) {
        throw new Error(`Failed to get bitable: ${response.data.msg}`);
      }

      this.logger.info('Feishu bitable obtained', {
        appToken,
        name: response.data.data.app.name,
      });

      return {
        name: response.data.data.app.name,
        appToken: response.data.data.app.app_token,
      };
    } catch (error) {
      this.logger.error('Failed to get Feishu bitable', { appToken, error });
      throw error;
    }
  }

  /**
   * 获取多维表格表列表
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-table/list
   *
   * @param appToken 多维表格 App Token
   * @returns 表列表
   */
  async getBitableTables(appToken: string): Promise<FeishuBitableTable[]> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: {
            items?: FeishuBitableTable[];
          };
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get bitable tables: ${response.data.msg}`);
      }

      this.logger.info('Feishu bitable tables obtained', {
        appToken,
        count: response.data.data?.items?.length || 0,
      });

      return response.data.data?.items || [];
    } catch (error) {
      this.logger.error('Failed to get Feishu bitable tables', {
        appToken,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取表字段列表
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-field/list
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @returns 字段列表
   */
  async getBitableFields(
    appToken: string,
    tableId: string,
  ): Promise<
    Array<{
      field_id: string;
      field_name: string;
      type: number;
      property?: Record<string, unknown>;
    }>
  > {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          code: number;
          msg: string;
          data?: {
            items?: Array<{
              field_id: string;
              field_name: string;
              type: number;
              property?: Record<string, unknown>;
            }>;
          };
        }>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get bitable fields: ${response.data.msg}`);
      }

      return response.data.data?.items || [];
    } catch (error) {
      this.logger.error('Failed to get Feishu bitable fields', {
        appToken,
        tableId,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取记录列表
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/list
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param params 查询参数
   * @returns 记录列表
   */
  async listBitableRecords(
    appToken: string,
    tableId: string,
    params?: FeishuListRecordsParams,
  ): Promise<{
    records: FeishuBitableRecord[];
    hasMore: boolean;
    pageToken?: string;
    total?: number;
  }> {
    const token = await this.getTenantAccessToken();
    const queryParams = new URLSearchParams();

    if (params?.view_id) {
      queryParams.append('view_id', params.view_id);
    }
    if (params?.filter) {
      queryParams.append('filter', params.filter);
    }
    if (params?.page_token) {
      queryParams.append('page_token', params.page_token);
    }
    if (params?.page_size) {
      queryParams.append('page_size', String(params.page_size));
    }
    if (params?.field_names) {
      queryParams.append('field_names', JSON.stringify(params.field_names));
    }
    if (params?.automatic_fields) {
      queryParams.append('automatic_fields', params.automatic_fields);
    }
    if (params?.sort) {
      queryParams.append('sort', JSON.stringify(params.sort));
    }

    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${queryParams.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<FeishuBitableRecordListResponse>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to list bitable records: ${response.data.msg}`);
      }

      this.logger.info('Feishu bitable records listed', {
        appToken,
        tableId,
        count: response.data.data?.items?.length || 0,
        hasMore: response.data.data?.has_more,
      });

      return {
        records: response.data.data?.items || [],
        hasMore: response.data.data?.has_more || false,
        pageToken: response.data.data?.page_token,
        total: response.data.data?.total,
      };
    } catch (error) {
      this.logger.error('Failed to list Feishu bitable records', {
        appToken,
        tableId,
        error,
      });
      throw error;
    }
  }

  /**
   * 创建记录
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/create
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param fields 字段值
   * @returns 创建的记录
   */
  async createBitableRecord(
    appToken: string,
    tableId: string,
    fields: Record<string, unknown>,
  ): Promise<FeishuBitableRecord> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<FeishuCreateRecordResponse>(
          url,
          {
            fields,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0 || !response.data.data?.record) {
        throw new Error(
          `Failed to create bitable record: ${response.data.msg}`,
        );
      }

      this.logger.info('Feishu bitable record created', {
        appToken,
        tableId,
        recordId: response.data.data.record.record_id,
      });

      return response.data.data.record;
    } catch (error) {
      this.logger.error('Failed to create Feishu bitable record', {
        appToken,
        tableId,
        error,
      });
      throw error;
    }
  }

  /**
   * 批量创建记录
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/batch_create
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param records 记录列表
   * @returns 创建的记录列表
   */
  async batchCreateBitableRecords(
    appToken: string,
    tableId: string,
    records: Array<{ fields: Record<string, unknown> }>,
  ): Promise<FeishuBitableRecord[]> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<FeishuBatchCreateRecordsResponse>(
          url,
          {
            records,
          } as FeishuBatchCreateRecordsRequest,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0 || !response.data.data?.records) {
        throw new Error(
          `Failed to batch create bitable records: ${response.data.msg}`,
        );
      }

      this.logger.info('Feishu bitable records batch created', {
        appToken,
        tableId,
        count: response.data.data.records.length,
      });

      return response.data.data.records;
    } catch (error) {
      this.logger.error('Failed to batch create Feishu bitable records', {
        appToken,
        tableId,
        error,
      });
      throw error;
    }
  }

  /**
   * 更新记录
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/update
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param recordId 记录 ID
   * @param fields 字段值
   * @returns 更新后的记录
   */
  async updateBitableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<FeishuBitableRecord> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.put<FeishuUpdateRecordResponse>(
          url,
          {
            fields,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0 || !response.data.data?.record) {
        throw new Error(
          `Failed to update bitable record: ${response.data.msg}`,
        );
      }

      this.logger.info('Feishu bitable record updated', {
        appToken,
        tableId,
        recordId,
      });

      return response.data.data.record;
    } catch (error) {
      this.logger.error('Failed to update Feishu bitable record', {
        appToken,
        tableId,
        recordId,
        error,
      });
      throw error;
    }
  }

  /**
   * 删除记录
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/delete
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param recordId 记录 ID
   * @returns 是否删除成功
   */
  async deleteBitableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
  ): Promise<boolean> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.delete<FeishuDeleteRecordResponse>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to delete bitable record: ${response.data.msg}`,
        );
      }

      this.logger.info('Feishu bitable record deleted', {
        appToken,
        tableId,
        recordId,
      });

      return response.data.data?.deleted ?? true;
    } catch (error) {
      this.logger.error('Failed to delete Feishu bitable record', {
        appToken,
        tableId,
        recordId,
        error,
      });
      throw error;
    }
  }

  /**
   * 批量删除记录
   * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-record/batch_delete
   *
   * @param appToken 多维表格 App Token
   * @param tableId 表 ID
   * @param recordIds 记录 ID 列表
   * @returns 删除的记录数
   */
  async batchDeleteBitableRecords(
    appToken: string,
    tableId: string,
    recordIds: string[],
  ): Promise<number> {
    const token = await this.getTenantAccessToken();
    const url = `${this.baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          code: number;
          msg: string;
          data?: {
            records?: Array<{ record_id: string }>;
          };
        }>(
          url,
          {
            records: recordIds.map((id) => ({ record_id: id })),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        ),
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to batch delete bitable records: ${response.data.msg}`,
        );
      }

      const deletedCount = response.data.data?.records?.length || 0;
      this.logger.info('Feishu bitable records batch deleted', {
        appToken,
        tableId,
        count: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to batch delete Feishu bitable records', {
        appToken,
        tableId,
        error,
      });
      throw error;
    }
  }
}

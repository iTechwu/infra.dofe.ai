/**
 * 飞书 API 类型定义
 */

// 飞书凭证配置
export interface FeishuCredentials {
  appId: string;
  appSecret: string;
}

// 飞书渠道配置
export interface FeishuChannelConfig {
  requireMention?: boolean; // 群聊是否需要 @机器人
  replyInThread?: boolean; // 是否在话题中回复
  showTyping?: boolean; // 是否显示"正在输入"
  domain?: 'feishu' | 'lark'; // 飞书或 Lark 国际版
}

// 飞书 Tenant Access Token 响应
export interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

// 飞书消息事件
export interface FeishuMessageEvent {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: {
    sender: {
      sender_id: {
        union_id: string;
        user_id: string;
        open_id: string;
      };
      sender_type: string;
      tenant_key: string;
    };
    message: {
      message_id: string;
      root_id?: string;
      parent_id?: string;
      create_time: string;
      update_time?: string;
      chat_id: string;
      chat_type: 'p2p' | 'group';
      message_type: string;
      content: string;
      mentions?: Array<{
        key: string;
        id: {
          union_id: string;
          user_id: string;
          open_id: string;
        };
        name: string;
        tenant_key: string;
      }>;
    };
  };
}

// 飞书发送消息请求
export interface FeishuSendMessageRequest {
  receive_id: string;
  msg_type:
    | 'text'
    | 'post'
    | 'image'
    | 'interactive'
    | 'share_chat'
    | 'share_user'
    | 'audio'
    | 'media'
    | 'file'
    | 'sticker';
  content: string;
  uuid?: string;
}

// 飞书发送消息响应
export interface FeishuSendMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    msg_type: string;
    create_time: string;
    update_time?: string;
    deleted: boolean;
    updated: boolean;
    chat_id: string;
    sender: {
      id: string;
      id_type: string;
      sender_type: string;
      tenant_key: string;
    };
    body: {
      content: string;
    };
  };
}

// ==================== 以下类型已弃用（WebSocket 连接已迁移到 OpenClaw 原生 feishu 扩展）====================

// WebSocket 长连接消息（已弃用）
/** @deprecated WebSocket 连接已迁移到 OpenClaw 原生 feishu 扩展 */
export interface FeishuWsMessage {
  type: 'event' | 'card' | 'pong';
  data?: FeishuMessageEvent;
}

// 消息处理回调（已弃用）
/** @deprecated WebSocket 连接已迁移到 OpenClaw 原生 feishu 扩展 */
export type FeishuMessageHandler = (event: FeishuMessageEvent) => Promise<void>;

// 卡片交互事件处理回调
export type FeishuCardActionHandler = (
  event: FeishuCardActionEvent,
) => Promise<FeishuCardActionResponse | void>;

// 连接状态回调（已弃用）
/** @deprecated WebSocket 连接已迁移到 OpenClaw 原生 feishu 扩展 */
export interface FeishuConnectionCallbacks {
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
}

// 卡片消息内容
export interface FeishuCardContent {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
    template?:
      | 'blue'
      | 'wathet'
      | 'turquoise'
      | 'green'
      | 'yellow'
      | 'orange'
      | 'red'
      | 'carmine'
      | 'violet'
      | 'purple'
      | 'indigo'
      | 'grey';
  };
  elements: FeishuCardElement[];
}

// 卡片元素类型
export type FeishuCardElement =
  | FeishuCardDivElement
  | FeishuCardMarkdownElement
  | FeishuCardActionElement
  | FeishuCardNoteElement
  | FeishuCardHrElement;

export interface FeishuCardDivElement {
  tag: 'div';
  text?: {
    tag: 'plain_text' | 'lark_md';
    content: string;
  };
  fields?: Array<{
    is_short: boolean;
    text: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
  }>;
}

export interface FeishuCardMarkdownElement {
  tag: 'markdown';
  content: string;
}

export interface FeishuCardActionElement {
  tag: 'action';
  actions: Array<{
    tag: 'button';
    text: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
    type?: 'default' | 'primary' | 'danger';
    value?: Record<string, unknown>;
  }>;
}

export interface FeishuCardNoteElement {
  tag: 'note';
  elements: Array<{
    tag: 'plain_text' | 'lark_md';
    content: string;
  }>;
}

export interface FeishuCardHrElement {
  tag: 'hr';
}

// 卡片交互事件
export interface FeishuCardActionEvent {
  open_id: string;
  user_id?: string;
  open_message_id: string;
  open_chat_id: string;
  tenant_key: string;
  token: string;
  action: {
    value: Record<string, unknown>;
    tag: string;
    option?: string;
    timezone?: string;
  };
}

// 卡片交互响应
export interface FeishuCardActionResponse {
  toast?: {
    type: 'success' | 'info' | 'warning' | 'error';
    content: string;
  };
  card?: FeishuCardContent;
}

// 用户信息
export interface FeishuUserInfo {
  union_id?: string;
  user_id?: string;
  open_id?: string;
  name?: string;
  en_name?: string;
  nickname?: string;
  email?: string;
  mobile?: string;
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  status?: {
    is_frozen?: boolean;
    is_resigned?: boolean;
    is_activated?: boolean;
  };
}

// 群信息
export interface FeishuChatInfo {
  chat_id: string;
  avatar?: string;
  name?: string;
  description?: string;
  owner_id?: string;
  owner_id_type?: string;
  chat_mode?: string;
  chat_type?: string;
  external?: boolean;
  tenant_key?: string;
}

// ==================== 富文本消息解析类型 ====================

/**
 * 飞书富文本消息内容（post 类型）
 * 参考: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message-events/events/post
 */
export interface FeishuPostContent {
  title?: string;
  content: FeishuPostContentNode[][];
}

/**
 * 富文本节点类型
 */
export type FeishuPostContentNode =
  | FeishuPostTextNode
  | FeishuPostImageNode
  | FeishuPostLinkNode
  | FeishuPostAtNode
  | FeishuPostCodeNode;

export interface FeishuPostTextNode {
  tag: 'text';
  text: string;
  style?: FeishuPostStyle[];
}

export interface FeishuPostImageNode {
  tag: 'img';
  image_key: string;
  width?: number;
  height?: number;
}

export interface FeishuPostLinkNode {
  tag: 'a';
  text: string;
  href: string;
}

export interface FeishuPostAtNode {
  tag: 'at';
  user_id: string;
  text?: string;
}

export interface FeishuPostCodeNode {
  tag: 'code';
  text: string;
  style?: FeishuPostStyle[];
}

export interface FeishuPostStyle {
  key: 'bold' | 'italic' | 'underline' | 'lineThrough' | 'color';
  value?: string;
}

/**
 * 飞书图片消息内容（image 类型）
 */
export interface FeishuImageContent {
  image_key: string;
}

/**
 * 飞书文件消息内容（file 类型）
 */
export interface FeishuFileContent {
  file_key: string;
  file_name: string;
}

/**
 * 图片数据响应
 */
export interface FeishuImageData {
  /** 图片 Base64 编码数据 */
  base64: string;
  /** 图片 MIME 类型 */
  mimeType: string;
  /** 图片大小（字节） */
  size: number;
}

/**
 * 文件数据响应
 */
export interface FeishuFileData {
  /** 文件 Base64 编码数据 */
  base64: string;
  /** 文件 MIME 类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件名 */
  fileName: string;
}

/**
 * 解析后的消息内容
 */
export interface ParsedFeishuMessage {
  /** 提取的纯文本内容 */
  text: string;
  /** 是否包含图片 */
  hasImages: boolean;
  /** 图片信息列表 */
  images: Array<{
    imageKey: string;
    width?: number;
    height?: number;
  }>;
  /** 是否包含文件 */
  hasFiles: boolean;
  /** 文件信息列表 */
  files: Array<{
    fileKey: string;
    fileName: string;
  }>;
  /** 原始消息类型 */
  messageType: string;
}

// ==================== 飞书通讯录 API 类型 ====================

/**
 * 飞书部门信息
 * 参考: https://open.feishu.cn/document/server-docs/contact-v3/department/get
 */
export interface FeishuDepartment {
  /** 部门 ID */
  department_id: string;
  /** 父部门 ID（根部门为 "0"） */
  parent_department_id: string;
  /** 部门名称 */
  name: string;
  /** 部门英文名 */
  name_en?: string;
  /** 部门领导用户 ID */
  department_leader_ids?: string[];
  /** 部门群 ID */
  chat_id?: string;
  /** 排序 */
  order?: string;
  /** 创建时间 */
  create_time?: string;
  /** 部门类型（1=普通, 2=租户） */
  department_type?: string;
  /** 部门人数 */
  member_count?: number;
  /** 是否包含子部门 */
  has_child?: boolean;
  /** 部门负责人 */
  leader_user_id?: string;
  /** 单位 ID */
  unit_id?: string;
  /** 是否删除 */
  open_department_id?: string;
}

/**
 * 飞书用户信息（通讯录）
 * 参考: https://open.feishu.cn/document/server-docs/contact-v3/user/find_by_id
 */
export interface FeishuContactUser {
  /** 用户唯一标识 */
  union_id?: string;
  /** 用户 ID */
  user_id?: string;
  /** 用户开放 ID */
  open_id?: string;
  /** 用户姓名 */
  name?: string;
  /** 用户英文名 */
  en_name?: string;
  /** 用户昵称 */
  nickname?: string;
  /** 用户头像 */
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  /** 用户邮箱 */
  email?: string;
  /** 用户手机号 */
  mobile?: string;
  /** 性别（0=未知, 1=男, 2=女） */
  gender?: number;
  /** 员工工号 */
  employee_no?: string;
  /** 职位 */
  position?: string;
  /** 主部门 ID */
  main_department_id?: string;
  /** 部门 ID 列表 */
  department_ids?: string[];
  /** 用户状态 */
  status?: {
    is_frozen?: boolean;
    is_resigned?: boolean;
    is_activated?: boolean;
    is_unjoin?: boolean;
  };
  /** 入职时间 */
  join_time?: number;
  /** 离职时间 */
  resign_time?: number;
  /** 部门排序 */
  department_order?: Array<{
    department_id: string;
    order: number;
  }>;
  /** 城市信息 */
  city?: string;
  /** 国家代码 */
  country_code?: string;
}

/**
 * 获取部门列表响应
 */
export interface FeishuDepartmentListResponse {
  code: number;
  msg: string;
  data?: {
    /** 是否还有更多 */
    has_more?: boolean;
    /** 分页标记 */
    page_token?: string;
    /** 部门列表 */
    items?: FeishuDepartment[];
  };
}

/**
 * 获取用户列表响应
 */
export interface FeishuUserListResponse {
  code: number;
  msg: string;
  data?: {
    /** 是否还有更多 */
    has_more?: boolean;
    /** 分页标记 */
    page_token?: string;
    /** 用户列表 */
    items?: FeishuContactUser[];
  };
}

/**
 * 获取子部门列表请求参数
 */
export interface FeishuGetChildrenDepartmentsParams {
  /** 父部门 ID（根部门传 "0"） */
  department_id: string;
  /** 分页大小 */
  page_size?: number;
  /** 分页标记 */
  page_token?: string;
  /** 用户 ID 类型 */
  user_id_type?: 'open_id' | 'user_id' | 'union_id';
  /** 部门 ID 类型 */
  department_id_type?: 'department_id' | 'open_department_id';
  /** 获取数量 */
  fetch_child?: boolean;
}

/**
 * 获取部门用户列表请求参数
 */
export interface FeishuGetDepartmentUsersParams {
  /** 部门 ID */
  department_id: string;
  /** 分页大小 */
  page_size?: number;
  /** 分页标记 */
  page_token?: string;
  /** 用户 ID 类型 */
  user_id_type?: 'open_id' | 'user_id' | 'union_id';
  /** 部门 ID 类型 */
  department_id_type?: 'department_id' | 'open_department_id';
}

// ==================== 飞书多维表格（Bitable）API 类型 ====================

/**
 * 飞书多维表格字段类型
 * 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview
 */
export type FeishuBitableFieldType =
  | 'text'
  | 'number'
  | 'singleSelect'
  | 'multiSelect'
  | 'dateTime'
  | 'checkbox'
  | 'user'
  | 'url'
  | 'phone'
  | 'email'
  | 'attachment'
  | 'link'
  | 'formula'
  | 'lookup'
  | 'rollup'
  | 'currency'
  | 'percent'
  | 'rating'
  | 'location'
  | 'createdTime'
  | 'modifiedTime'
  | 'createdUser'
  | 'modifiedUser'
  | 'autoNumber'
  | 'barcode'
  | 'progress'
  | 'group';

/**
 * 飞书多维表格字段属性
 */
export interface FeishuBitableFieldProperty {
  /** 字段名称 */
  field_name: string;
  /** 字段 ID */
  field_id: string;
  /** 字段类型（数值） */
  type: number;
  /** 属性（根据类型不同） */
  property?: Record<string, unknown>;
}

/**
 * 飞书多维表格视图
 */
export interface FeishuBitableView {
  /** 视图 ID */
  view_id: string;
  /** 视图名称 */
  view_name: string;
  /** 视图类型 */
  view_type: 'grid' | 'kanban' | 'calendar' | 'gallery' | 'gantt';
}

/**
 * 飞书多维表格表
 */
export interface FeishuBitableTable {
  /** 表 ID */
  table_id: string;
  /** 表名称 */
  name: string;
  /** 字段列表 */
  fields?: FeishuBitableFieldProperty[];
  /** 视图列表 */
  views?: FeishuBitableView[];
}

/**
 * 飞书多维表格信息
 */
export interface FeishuBitable {
  /** 应用 Token */
  app_token: string;
  /** 名称 */
  name: string;
  /** 表列表 */
  tables?: FeishuBitableTable[];
  /** 是否自动授权 */
  is_advanced?: boolean;
}

/**
 * 飞书多维表格记录
 */
export interface FeishuBitableRecord {
  /** 记录 ID */
  record_id: string;
  /** 字段值 */
  fields: Record<string, unknown>;
  /** 创建时间 */
  created_time?: number;
  /** 修改时间 */
  modified_time?: number;
}

/**
 * 获取多维表格列表响应
 */
export interface FeishuBitableListResponse {
  code: number;
  msg: string;
  data?: {
    /** 是否还有更多 */
    has_more?: boolean;
    /** 分页标记 */
    page_token?: string;
    /** 表列表 */
    items?: FeishuBitableTable[];
  };
}

/**
 * 获取记录列表响应
 */
export interface FeishuBitableRecordListResponse {
  code: number;
  msg: string;
  data?: {
    /** 是否还有更多 */
    has_more?: boolean;
    /** 分页标记 */
    page_token?: string;
    /** 总数 */
    total?: number;
    /** 记录列表 */
    items?: FeishuBitableRecord[];
  };
}

/**
 * 获取记录列表请求参数
 */
export interface FeishuListRecordsParams {
  /** 视图 ID */
  view_id?: string;
  /** 过滤条件 */
  filter?: string;
  /** 排序规则 */
  sort?: Array<{
    field_id: string;
    desc?: boolean;
  }>;
  /** 字段名或 ID */
  field_names?: string[];
  /** 分页标记 */
  page_token?: string;
  /** 分页大小 */
  page_size?: number;
  /** 自动格式 */
  automatic_fields?: string;
}

/**
 * 创建记录请求
 */
export interface FeishuCreateRecordRequest {
  /** 字段值 */
  fields: Record<string, unknown>;
}

/**
 * 创建记录响应
 */
export interface FeishuCreateRecordResponse {
  code: number;
  msg: string;
  data?: {
    record: FeishuBitableRecord;
  };
}

/**
 * 批量创建记录请求
 */
export interface FeishuBatchCreateRecordsRequest {
  records: Array<{
    fields: Record<string, unknown>;
  }>;
}

/**
 * 批量创建记录响应
 */
export interface FeishuBatchCreateRecordsResponse {
  code: number;
  msg: string;
  data?: {
    records: FeishuBitableRecord[];
  };
}

/**
 * 更新记录请求
 */
export interface FeishuUpdateRecordRequest {
  /** 字段值 */
  fields: Record<string, unknown>;
}

/**
 * 更新记录响应
 */
export interface FeishuUpdateRecordResponse {
  code: number;
  msg: string;
  data?: {
    record: FeishuBitableRecord;
  };
}

/**
 * 删除记录响应
 */
export interface FeishuDeleteRecordResponse {
  code: number;
  msg: string;
  data?: {
    deleted: boolean;
  };
}

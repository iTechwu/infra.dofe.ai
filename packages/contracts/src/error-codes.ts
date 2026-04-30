/**
 * Unified Error Codes for @dofe/infra-contracts
 * Extracted from @repo/contracts — zero dependencies.
 */

// ============================================================================
// Common Error Codes (9xx prefix)
// ============================================================================

export const CommonErrorCode = {
  IdMustUUID: '911500',
  InnerError: '900500',
  InternalServerError: '900503',
  BadRequest: '900400',
  Unknown: '900501',
  GetStorageNull: '900404',
  DbCreateError: '900502',
  DbUpdateError: '901502',
  DbDeleteError: '902502',
  DbQueryError: '903502',
  TemplateNotFound: '904404',
  InvalidParameters: '901400',
  SignatureError: '902401',
  TooManyFolders: '903402',
  TooManyFiles: '904403',
  NotFound: '905404',
  PlanIsNotExist: '906404',
  PlanIsDeleted: '906405',
  RecommendPlanNotFound: '200',
  CreateOrderFail: '907406',
  OrderIsNotExist: '908407',
  SystemUnHealthy: '910500',
  ParameterError: '911400',
  GetProviderUserInfoError: '911408',
  RabbitmqQueueIsNotExist: '912409',
  StorageResponseFailed: '913510',
  BatchDeleteFolderFail: '914511',
  InitiateMultipartUploadError: '915412',
  QrcodeGenerateError: '916513',
  FileServiceUnsupportedVendor: '917414',
  QiniuZipDownloadError: '918515',
  QiniuQueryFopStatusError: '919516',
  QiniuUploaderError: '920517',
  S3NoSuchKey: '921518',
  S3NoSuchBucket: '922519',
  UnAuthorized: '923402',
  UnauthorizedByKey: '924403',
  TooFrequent: '925429',
  InvalidToken: '926404',
  InvalidEnv: '927505',
  InvalidRedis: '928506',
  TextCensorValidFailed: '928508',
  SessionExpired: '929410',
  FeatureAlreadyExists: '900403',
  FeatureNotFound: '901404',
  FeatureHasPermissions: '902404',
  SomeFeaturesHavePermissions: '903404',
  WechatAccessTokenError: '990404',
  WechatMiniProgramQRCodeError: '990405',
  LLMJinaAiEmbeddingError: '999001',
  LLMJinaAiRerankError: '999002',
  LLMJinaAiReadError: '999003',
  LLMJinaAiSearchError: '999004',
  LLMJinaAiClassifyError: '999005',
  LLMJinaAiSegmentError: '999006',
  LLMJinaAiGRelatedError: '999007',
  LLMJinaAiDeepsearchError: '999008',
  S3ClientInitializationError: '999010',
  InvalidVideoUri: '999011',
  InvalidTaskId: '999012',
  MissingVendor: '999013',
} as const;

export type CommonErrorCode =
  (typeof CommonErrorCode)[keyof typeof CommonErrorCode];

// ============================================================================
// User Error Codes (2xx prefix)
// ============================================================================

export const UserErrorCode = {
  OauthAccountAlreadyExist: '200409',
  UserNotFound: '200401',
  UserAlreadyExists: '200402',
  InvalidPassword: '200403',
  InvalidVerifyCode: '200400',
  WriteAccessTokenFail: '200500',
  SsoHostNameError: '200501',
  OauthTokenInvalid: '206407',
  NicknameIsTooLong: '207400',
  NicknameIsTooShort: '208400',
  EmailIsInvalid: '209400',
} as const;

export type UserErrorCode = (typeof UserErrorCode)[keyof typeof UserErrorCode];

// ============================================================================
// Unified API Error Code
// ============================================================================

export const ApiErrorCode = {
  ...UserErrorCode,
  ...CommonErrorCode,
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ============================================================================
// Error Type Keys (for i18n)
// ============================================================================

export const UserErrorTypes: Record<UserErrorCode, string> = {
  [UserErrorCode.OauthAccountAlreadyExist]: 'oauthAccountAlreadyExist',
  [UserErrorCode.UserNotFound]: 'userNotFound',
  [UserErrorCode.UserAlreadyExists]: 'userAlreadyExists',
  [UserErrorCode.InvalidPassword]: 'invalidPassword',
  [UserErrorCode.InvalidVerifyCode]: 'invalidVerifyCode',
  [UserErrorCode.WriteAccessTokenFail]: 'writeAccessTokenFail',
  [UserErrorCode.SsoHostNameError]: 'ssoHostNameError',
  [UserErrorCode.OauthTokenInvalid]: 'oauthTokenInvalid',
  [UserErrorCode.NicknameIsTooLong]: 'nicknameIsTooLong',
  [UserErrorCode.NicknameIsTooShort]: 'nicknameIsTooShort',
  [UserErrorCode.EmailIsInvalid]: 'emailIsInvalid',
};

export const CommonErrorTypes: Record<CommonErrorCode, string> = {
  [CommonErrorCode.IdMustUUID]: 'idMustUUID',
  [CommonErrorCode.InnerError]: 'innerError',
  [CommonErrorCode.InternalServerError]: 'internalServerError',
  [CommonErrorCode.BadRequest]: 'badRequest',
  [CommonErrorCode.Unknown]: 'unknown',
  [CommonErrorCode.GetStorageNull]: 'getStorageNull',
  [CommonErrorCode.DbCreateError]: 'dbCreateError',
  [CommonErrorCode.DbUpdateError]: 'dbUpdateError',
  [CommonErrorCode.DbDeleteError]: 'dbDeleteError',
  [CommonErrorCode.DbQueryError]: 'dbQueryError',
  [CommonErrorCode.TemplateNotFound]: 'templateNotFound',
  [CommonErrorCode.InvalidParameters]: 'invalidParameters',
  [CommonErrorCode.SignatureError]: 'signatureError',
  [CommonErrorCode.TooManyFolders]: 'tooManyFolders',
  [CommonErrorCode.TooManyFiles]: 'tooManyFiles',
  [CommonErrorCode.NotFound]: 'notFound',
  [CommonErrorCode.PlanIsNotExist]: 'planIsNotExist',
  [CommonErrorCode.PlanIsDeleted]: 'planIsDeleted',
  [CommonErrorCode.RecommendPlanNotFound]: 'recommendPlanNotFound',
  [CommonErrorCode.CreateOrderFail]: 'createOrderFail',
  [CommonErrorCode.OrderIsNotExist]: 'orderIsNotExist',
  [CommonErrorCode.SystemUnHealthy]: 'systemUnHealthy',
  [CommonErrorCode.ParameterError]: 'parameterError',
  [CommonErrorCode.GetProviderUserInfoError]: 'getProviderUserInfoError',
  [CommonErrorCode.RabbitmqQueueIsNotExist]: 'rabbitmqQueueIsNotExist',
  [CommonErrorCode.StorageResponseFailed]: 'storageResponseFailed',
  [CommonErrorCode.BatchDeleteFolderFail]: 'batchDeleteFolderFail',
  [CommonErrorCode.InitiateMultipartUploadError]: 'initiateMultipartUploadError',
  [CommonErrorCode.QrcodeGenerateError]: 'qrcodeGenerateError',
  [CommonErrorCode.FileServiceUnsupportedVendor]: 'fileServiceUnsupportedVendor',
  [CommonErrorCode.QiniuZipDownloadError]: 'qiniuZipDownloadError',
  [CommonErrorCode.QiniuQueryFopStatusError]: 'qiniuQueryFopStatusError',
  [CommonErrorCode.QiniuUploaderError]: 'qiniuUploaderError',
  [CommonErrorCode.S3NoSuchKey]: 's3NoSuchKey',
  [CommonErrorCode.S3NoSuchBucket]: 's3NoSuchBucket',
  [CommonErrorCode.UnAuthorized]: 'unAuthorized',
  [CommonErrorCode.UnauthorizedByKey]: 'unauthorizedByKey',
  [CommonErrorCode.TooFrequent]: 'tooFrequent',
  [CommonErrorCode.InvalidToken]: 'invalidToken',
  [CommonErrorCode.InvalidEnv]: 'invalidEnv',
  [CommonErrorCode.InvalidRedis]: 'invalidRedis',
  [CommonErrorCode.TextCensorValidFailed]: 'textCensorValidFailed',
  [CommonErrorCode.SessionExpired]: 'sessionExpired',
  [CommonErrorCode.FeatureAlreadyExists]: 'featureAlreadyExists',
  [CommonErrorCode.FeatureNotFound]: 'featureNotFound',
  [CommonErrorCode.FeatureHasPermissions]: 'featureHasPermissions',
  [CommonErrorCode.SomeFeaturesHavePermissions]: 'someFeaturesHavePermissions',
  [CommonErrorCode.WechatAccessTokenError]: 'wechatAccessTokenError',
  [CommonErrorCode.WechatMiniProgramQRCodeError]: 'wechatMiniProgramQRCodeError',
  [CommonErrorCode.LLMJinaAiEmbeddingError]: 'llmJinaAiEmbeddingError',
  [CommonErrorCode.LLMJinaAiRerankError]: 'llmJinaAiRerankError',
  [CommonErrorCode.LLMJinaAiReadError]: 'llmJinaAiReadError',
  [CommonErrorCode.LLMJinaAiSearchError]: 'llmJinaAiSearchError',
  [CommonErrorCode.LLMJinaAiClassifyError]: 'llmJinaAiClassifyError',
  [CommonErrorCode.LLMJinaAiSegmentError]: 'llmJinaAiSegmentError',
  [CommonErrorCode.LLMJinaAiGRelatedError]: 'llmJinaAiGRelatedError',
  [CommonErrorCode.LLMJinaAiDeepsearchError]: 'llmJinaAiDeepsearchError',
  [CommonErrorCode.S3ClientInitializationError]: 's3ClientInitializationError',
  [CommonErrorCode.InvalidVideoUri]: 'invalidVideoUri',
  [CommonErrorCode.InvalidTaskId]: 'invalidTaskId',
  [CommonErrorCode.MissingVendor]: 'missingVendor',
};

// Unified
export const AllErrorTypes: Record<string, string> = {
  ...UserErrorTypes,
  ...CommonErrorTypes,
};

// ============================================================================
// HTTP Status mappings
// ============================================================================

export const UserErrorHttpStatus: Record<UserErrorCode, number> = {
  [UserErrorCode.OauthAccountAlreadyExist]: 422,
  [UserErrorCode.UserNotFound]: 401,
  [UserErrorCode.UserAlreadyExists]: 200,
  [UserErrorCode.InvalidPassword]: 401,
  [UserErrorCode.InvalidVerifyCode]: 200,
  [UserErrorCode.WriteAccessTokenFail]: 200,
  [UserErrorCode.SsoHostNameError]: 200,
  [UserErrorCode.OauthTokenInvalid]: 401,
  [UserErrorCode.NicknameIsTooLong]: 200,
  [UserErrorCode.NicknameIsTooShort]: 200,
  [UserErrorCode.EmailIsInvalid]: 200,
};

export const CommonErrorHttpStatus: Record<CommonErrorCode, number> = {
  [CommonErrorCode.IdMustUUID]: 400,
  [CommonErrorCode.InnerError]: 500,
  [CommonErrorCode.InternalServerError]: 500,
  [CommonErrorCode.BadRequest]: 200,
  [CommonErrorCode.Unknown]: 500,
  [CommonErrorCode.GetStorageNull]: 200,
  [CommonErrorCode.DbCreateError]: 200,
  [CommonErrorCode.DbUpdateError]: 500,
  [CommonErrorCode.DbDeleteError]: 500,
  [CommonErrorCode.DbQueryError]: 500,
  [CommonErrorCode.TemplateNotFound]: 200,
  [CommonErrorCode.InvalidParameters]: 200,
  [CommonErrorCode.SignatureError]: 200,
  [CommonErrorCode.TooManyFolders]: 200,
  [CommonErrorCode.TooManyFiles]: 200,
  [CommonErrorCode.NotFound]: 200,
  [CommonErrorCode.PlanIsNotExist]: 200,
  [CommonErrorCode.PlanIsDeleted]: 200,
  [CommonErrorCode.RecommendPlanNotFound]: 200,
  [CommonErrorCode.CreateOrderFail]: 200,
  [CommonErrorCode.OrderIsNotExist]: 200,
  [CommonErrorCode.SystemUnHealthy]: 200,
  [CommonErrorCode.ParameterError]: 400,
  [CommonErrorCode.GetProviderUserInfoError]: 200,
  [CommonErrorCode.RabbitmqQueueIsNotExist]: 200,
  [CommonErrorCode.StorageResponseFailed]: 200,
  [CommonErrorCode.BatchDeleteFolderFail]: 200,
  [CommonErrorCode.InitiateMultipartUploadError]: 200,
  [CommonErrorCode.QrcodeGenerateError]: 200,
  [CommonErrorCode.FileServiceUnsupportedVendor]: 200,
  [CommonErrorCode.QiniuZipDownloadError]: 200,
  [CommonErrorCode.QiniuQueryFopStatusError]: 200,
  [CommonErrorCode.QiniuUploaderError]: 200,
  [CommonErrorCode.S3NoSuchKey]: 200,
  [CommonErrorCode.S3NoSuchBucket]: 200,
  [CommonErrorCode.UnAuthorized]: 401,
  [CommonErrorCode.UnauthorizedByKey]: 401,
  [CommonErrorCode.TooFrequent]: 200,
  [CommonErrorCode.InvalidToken]: 401,
  [CommonErrorCode.InvalidEnv]: 200,
  [CommonErrorCode.InvalidRedis]: 200,
  [CommonErrorCode.TextCensorValidFailed]: 200,
  [CommonErrorCode.SessionExpired]: 410,
  [CommonErrorCode.FeatureAlreadyExists]: 409,
  [CommonErrorCode.FeatureNotFound]: 404,
  [CommonErrorCode.FeatureHasPermissions]: 403,
  [CommonErrorCode.SomeFeaturesHavePermissions]: 405,
  [CommonErrorCode.WechatAccessTokenError]: 200,
  [CommonErrorCode.WechatMiniProgramQRCodeError]: 200,
  [CommonErrorCode.LLMJinaAiEmbeddingError]: 500,
  [CommonErrorCode.LLMJinaAiRerankError]: 500,
  [CommonErrorCode.LLMJinaAiReadError]: 500,
  [CommonErrorCode.LLMJinaAiSearchError]: 500,
  [CommonErrorCode.LLMJinaAiClassifyError]: 500,
  [CommonErrorCode.LLMJinaAiSegmentError]: 500,
  [CommonErrorCode.LLMJinaAiGRelatedError]: 500,
  [CommonErrorCode.LLMJinaAiDeepsearchError]: 500,
  [CommonErrorCode.S3ClientInitializationError]: 500,
  [CommonErrorCode.InvalidVideoUri]: 400,
  [CommonErrorCode.InvalidTaskId]: 400,
  [CommonErrorCode.MissingVendor]: 400,
};

export const AllErrorHttpStatus: Record<string, number> = {
  ...UserErrorHttpStatus,
  ...CommonErrorHttpStatus,
};

// ============================================================================
// Helper functions
// ============================================================================

export function getErrorType(errorCode: ApiErrorCode): string | undefined {
  return AllErrorTypes[errorCode];
}

export function getHttpStatus(errorCode: ApiErrorCode): number {
  if (errorCode in AllErrorHttpStatus) {
    return AllErrorHttpStatus[errorCode] ?? 500;
  }
  return 500;
}

// ============================================================================
// Default English error messages (fallback when i18n is not available)
// ============================================================================

const ErrorMessages: Record<string, Record<string, string>> = {
  user: {
    oauthAccountAlreadyExist: 'OAuth Account Already Exists',
    userNotFound: 'User Not Found',
    userAlreadyExists: 'User Already Exists',
    invalidPassword: 'Invalid Password',
    invalidVerifyCode: 'Invalid Verification Code',
    writeAccessTokenFail: 'Failed to write access token',
    ssoHostNameError: 'Invalid SSO hostname error',
    oauthTokenInvalid: 'OAuth Token Invalid',
    nicknameIsTooLong: 'Nickname is too long',
    nicknameIsTooShort: 'Nickname is too short',
    emailIsInvalid: 'Email is invalid',
  },
  common: {
    idMustUUID: 'ID must be a valid UUID',
    innerError: 'Internal Error',
    internalServerError: 'Internal Server Error',
    badRequest: 'Bad Request',
    unknown: 'Unknown Error',
    getStorageNull: 'Storage Object Not Found',
    dbCreateError: 'Database Create Error',
    dbUpdateError: 'Database Update Error',
    dbDeleteError: 'Database Delete Error',
    dbQueryError: 'Database Query Error',
    templateNotFound: 'Template Not Found',
    invalidParameters: 'Invalid Parameters',
    signatureError: 'Signature Error',
    tooManyFolders: 'Too Many Folders',
    tooManyFiles: 'Too Many Files',
    notFound: 'Not Found',
    planIsNotExist: 'Plan Does Not Exist',
    planIsDeleted: 'Plan Is Deleted',
    createOrderFail: 'Failed to Create Order',
    orderIsNotExist: 'Order Does Not Exist',
    systemUnHealthy: 'System Unhealthy',
    parameterError: 'Parameter Error',
    getProviderUserInfoError: 'Failed to Get Provider User Info',
    rabbitmqQueueIsNotExist: 'RabbitMQ Queue Does Not Exist',
    storageResponseFailed: 'Storage Response Failed',
    batchDeleteFolderFail: 'Failed to Batch Delete Folder',
    initiateMultipartUploadError: 'Failed to Initiate Multipart Upload',
    qrcodeGenerateError: 'QR Code Generation Failed',
    fileServiceUnsupportedVendor: 'Unsupported File Service Vendor',
    qiniuZipDownloadError: 'Qiniu Zip Download Failed',
    qiniuQueryFopStatusError: 'Qiniu Fop Status Query Failed',
    qiniuUploaderError: 'Qiniu Upload Failed',
    s3NoSuchKey: 'S3 Key Not Found',
    s3NoSuchBucket: 'S3 Bucket Not Found',
    unAuthorized: 'Unauthorized',
    unauthorizedByKey: 'Unauthorized by Key',
    tooFrequent: 'Too Frequent',
    invalidToken: 'Invalid Token',
    invalidEnv: 'Invalid Environment',
    invalidRedis: 'Invalid Redis Configuration',
    textCensorValidFailed: 'Text Censor Validation Failed',
    sessionExpired: 'Session Expired',
    featureAlreadyExists: 'Feature Already Exists',
    featureNotFound: 'Feature Not Found',
    featureHasPermissions: 'Feature Has Permissions',
    someFeaturesHavePermissions: 'Some Features Have Permissions',
    wechatAccessTokenError: 'WeChat Access Token Error',
    wechatMiniProgramQRCodeError: 'WeChat Mini Program QR Code Error',
    llmJinaAiEmbeddingError: 'Jina AI Embedding API Failed',
    llmJinaAiRerankError: 'Jina AI Rerank API Failed',
    llmJinaAiReadError: 'Jina AI Read API Failed',
    llmJinaAiSearchError: 'Jina AI Search API Failed',
    llmJinaAiClassifyError: 'Jina AI Classify API Failed',
    llmJinaAiSegmentError: 'Jina AI Segment API Failed',
    llmJinaAiGRelatedError: 'Jina AI Related Content API Failed',
    llmJinaAiDeepsearchError: 'Jina AI Deep Search API Failed',
    s3ClientInitializationError: 'S3 Client Initialization Failed',
    invalidVideoUri: 'Invalid video URI format',
    invalidTaskId: 'Task ID cannot be empty',
    missingVendor: 'Vendor must be provided',
  },
};

const AllErrorMessages: Record<string, string> = Object.entries(ErrorMessages).reduce(
  (acc, [, messages]) => {
    Object.entries(messages).forEach(([errorType, message]) => {
      acc[errorType] = message;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export function getErrorMessage(errorType: string): string {
  return AllErrorMessages[errorType] || errorType;
}

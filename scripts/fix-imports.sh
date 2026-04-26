#!/bin/bash
# Fix all legacy import paths across dofe-infra packages
# Run from dofe-infra root: bash scripts/fix-imports.sh
set -e

BASE="/Users/techwu/Documents/codes/dofe.ai/infra.dofe.ai/packages"

echo "=== Fixing imports across all packages ==="

# ============================================================
# Pattern 1: @/utils/* → @dofe/infra-utils
# Used in: common, prisma, rabbitmq, redis, shared-services, clients, shared-db
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@/utils/array\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/bigint\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/bcrypt\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/bytes\.convert\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/crypto\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/enviroment\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/ffmpeg\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/file\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/folder\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/frame\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/http-client'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/ip\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/json\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/load-env\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/logger\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/object\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/prisma-error\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/response'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/serialize\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/string\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/timer\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/urlencode\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/validate\.util'|from '@dofe/infra-utils'|g" \
  -e "s|from '@/utils/array-buffer\.util'|from '@dofe/infra-utils'|g"

echo "[1/6] Fixed @/utils/* imports"

# ============================================================
# Pattern 2: @/common/* → @dofe/infra-common
# Used in: prisma, redis, rabbitmq, shared-db, jwt, clients, shared-services
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@/config/configuration'|from '@dofe/infra-common'|g" \
  -e "s|from '@/config/constant/config\.constants'|from '@dofe/infra-common'|g" \
  -e "s|from '@/config/dto/config\.dto'|from '@dofe/infra-common'|g" \
  -e "s|from '@/config/validation'|from '@dofe/infra-common'|g" \
  -e "s|from '@/config/validation/keys\.validation'|from '@dofe/infra-common'|g" \
  -e "s|from '@/config/validation/env\.validation'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/rate-limit'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/transaction/transactional\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/ts-rest-controller\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/response\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/device-info\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/team-info\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/validation\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/decorators/skip-version-check\.decorator'|from '@dofe/infra-common'|g" \
  -e "s|from '@/filter/exception/api\.exception'|from '@dofe/infra-common'|g" \
  -e "s|from '@/filter/exception/exception'|from '@dofe/infra-common'|g" \
  -e "s|from '@/filter/exception/http\.exception'|from '@dofe/infra-common'|g" \
  -e "s|from '@/interceptor/transform/transform\.interceptor'|from '@dofe/infra-common'|g" \
  -e "s|from '@/middleware/request\.middleware'|from '@dofe/infra-common'|g" \
  -e "s|from '@/ts-rest/response\.helper'|from '@dofe/infra-common'|g" \
  -e "s|from '@/common/ts-rest'|from '@dofe/infra-common'|g" \
  -e "s|from '@/common/adapters'|from '@dofe/infra-common'|g" \
  -e "s|from '@/common/enums/error-codes'|from '@dofe/infra-common'|g" \
  -e "s|from '@/common/enums/role\.enum'|from '@dofe/infra-common'|g" \
  -e "s|from '@/common/enums/action\.enum'|from '@dofe/infra-common'|g"

echo "[2/6] Fixed @/common/* imports"

# ============================================================
# Pattern 3: @/prisma* → @dofe/infra-prisma
# Used in: shared-db, rabbitmq, shared-services
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@/prisma/prisma\.module'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma/prisma\.service'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma/types'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma-read/prisma-read\.module'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma-read/prisma-read\.service'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma-write/prisma-write\.module'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/prisma-write/prisma-write\.service'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@/shared-db'|from '@dofe/infra-shared-db'|g"

echo "[3/6] Fixed @/prisma* imports"

# ============================================================
# Pattern 4: @app/redis → @dofe/infra-redis
# Used in: common, prisma, shared-services
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@app/redis'|from '@dofe/infra-redis'|g" \
  -e "s|from '@app/redis/dto/redis\.dto'|from '@dofe/infra-redis'|g"

echo "[4/6] Fixed @app/redis imports"

# ============================================================
# Pattern 5: @app/clients/* → @dofe/infra-clients
# Used in: shared-services
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@app/clients/internal/ai'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/crypt'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/email'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/file-cdn'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/file-storage'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/ip-info'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/ocr'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/openai'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/openspeech'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/sms'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/sse'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/third-party-sse'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/verify'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/volcengine-tts'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/internal/wechat'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/plugin'|from '@dofe/infra-clients'|g" \
  -e "s|from '@app/clients/plugin/decorators/inject-client\.decorator'|from '@dofe/infra-clients'|g"

echo "[5/6] Fixed @app/clients/* imports"

# ============================================================
# Pattern 6: Other @app/* mappings
# ============================================================
find "$BASE" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs sed -i '' \
  -e "s|from '@app/prisma'|from '@dofe/infra-prisma'|g" \
  -e "s|from '@app/rabbitmq'|from '@dofe/infra-rabbitmq'|g" \
  -e "s|from '@app/jwt/jwt\.module'|from '@dofe/infra-jwt'|g" \
  -e "s|from '@app/shared-services/file-storage'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/ip-geo'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/streaming-asr'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/notification'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/sms'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/email'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/uploader'|from '@dofe/infra-shared-services'|g" \
  -e "s|from '@app/shared-services/system-health'|from '@dofe/infra-shared-services'|g"

echo "[6/6] Fixed other @app/* imports"

echo ""
echo "=== Checking for remaining unresolved imports ==="
echo "--- Remaining @/ imports ---"
grep -rn "from '@/" "$BASE" --include="*.ts" | grep -v node_modules | grep -v dist || echo "None found"
echo ""
echo "--- Remaining @app/ imports ---"
grep -rn "from '@app/" "$BASE" --include="*.ts" | grep -v node_modules | grep -v dist || echo "None found"
echo ""
echo "=== Done ==="

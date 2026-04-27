"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const redis_service_1 = require("./redis.service");
describe('RedisService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [redis_service_1.RedisService],
        }).compile();
        service = module.get(redis_service_1.RedisService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=redis.service.spec.js.map
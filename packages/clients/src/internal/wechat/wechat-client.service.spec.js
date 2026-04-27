"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const wechat_client_1 = require("./wechat.client");
describe('WechatClient', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [wechat_client_1.WechatClient],
        }).compile();
        service = module.get(wechat_client_1.WechatClient);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=wechat-client.service.spec.js.map
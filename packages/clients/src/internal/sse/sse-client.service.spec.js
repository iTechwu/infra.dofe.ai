"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const sse_client_1 = require("./sse.client");
describe('SseClient', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [sse_client_1.SseClient],
        }).compile();
        service = module.get(sse_client_1.SseClient);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=sse-client.service.spec.js.map
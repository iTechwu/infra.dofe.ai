"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const third_party_sse_client_1 = require("./third-party-sse.client");
describe('ThirdPartySseClient', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [third_party_sse_client_1.ThirdPartySseClient],
        }).compile();
        service = module.get(third_party_sse_client_1.ThirdPartySseClient);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=third-party-sse.service.spec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const file_cdn_client_1 = require("./file-cdn.client");
describe('FileCdnClient', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [file_cdn_client_1.FileCdnClient],
        }).compile();
        service = module.get(file_cdn_client_1.FileCdnClient);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=file-cdn-client.service.spec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const crypt_client_1 = require("./crypt.client");
describe('CryptClient', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [crypt_client_1.CryptClient],
        }).compile();
        service = module.get(crypt_client_1.CryptClient);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=crypt-client.service.spec.js.map
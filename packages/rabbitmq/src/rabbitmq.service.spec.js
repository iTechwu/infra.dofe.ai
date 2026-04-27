"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rabbitmq_service_1 = require("./rabbitmq.service");
describe('RabbitmqService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [rabbitmq_service_1.RabbitmqService],
        }).compile();
        service = module.get(rabbitmq_service_1.RabbitmqService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=rabbitmq.service.spec.js.map
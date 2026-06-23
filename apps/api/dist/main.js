"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: process.env.WEB_ORIGIN
            ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim())
            : true,
    });
    const port = process.env.PORT ? Number(process.env.PORT) : 3002;
    await app.listen(port);
    new common_1.Logger('Bootstrap').log(`ShadyExperiments API listening on :${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as cors from "cors";
import * as express from "express";
import * as https from "https";
import * as devCerts from "office-addin-dev-certs";
import * as usageDataHelper from './usagedata-helper';

export const defaultPort: number = 4201;

export class TestServer {
    private jsonData: any;
    private port: number;
    private testServerStarted: boolean;
    private app: express.Express;
    private resultsPromise: Promise<JSON>;
    private server: https.Server;

    constructor(port: number) {
        this.app = express();
        this.jsonData = {};
        this.port = port;
        this.resultsPromise = undefined;
        this.testServerStarted = false;
    }

    public async startTestServer(mochaTest: boolean = false): Promise<boolean> {
        try {
            if (mochaTest) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            }

            // create express server instance
            const options = await devCerts.getHttpsServerOptions();
            this.app.use(cors());
            this.server = https.createServer(options, this.app);

            // listen for 'ping'
            const platformName = this.getPlatformName();
            this.app.get("/ping", function(req: any, res: any, next: any) {
                res.send(platformName);
            });

            // listen for posting of test results
            this.resultsPromise = new Promise<JSON>(async (resolveResults) => {
                this.app.post("/results", async (req: any, res: any) => {
                    res.send("200");
                    this.jsonData = JSON.parse(req.query.data);
                    resolveResults(this.jsonData);
                });
            });
            usageDataHelper.sendUsageDataSuccessEvent('startTestServer');

            // start listening on specified port
            return await this.startListening();

        } catch (err) {
            usageDataHelper.sendUsageDataException('startTestServer', `${err}`);
            throw new Error(`Unable to start test server.\n${err}`);
        }
    }

    public async stopTestServer(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if (this.testServerStarted) {
                try {
                    this.server.close();
                    this.testServerStarted = false;
                    usageDataHelper.sendUsageDataSuccessEvent('stopTestServer')
                    resolve(true);
                } catch (err) {
                    usageDataHelper.sendUsageDataException('stopTestServer', `${err}`);
                    reject(new Error(`Unable to stop test server.\n${err}`));
                }
            } else {
                // test server not started
                resolve(false);
            }
        });
    }

    public async getTestResults(): Promise<JSON> {
        return this.resultsPromise;
    }

    public getTestServerState(): boolean {
        return this.testServerStarted;
    }

    public getTestServerPort(): number {
        return this.port;
    }

    public getPlatformName(): string {
        switch (process.platform) {
            case "win32":
                return "Windows";
            case "darwin":
                return "macOS";
            default:
                return process.platform;
        }
    }

    private async startListening(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                // set server to listen on specified port
                this.server.listen(this.port, () => {
                    this.testServerStarted = true;
                    resolve(true);
                });
                usageDataHelper.sendUsageDataSuccessEvent('startListening');

            } catch (err) {
                usageDataHelper.sendUsageDataException('startListening', `${err}`);
                reject(new Error(`Unable to start test server.\n${err}`));
            }
        });
    }
}

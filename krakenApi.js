const crypto = require('crypto');
const axios = require('axios');
const qs =require('querystring');
const fs = require('fs'); // Import the File System module

// --- Paste the complete KrakenFuturesApi class here ---
class KrakenFuturesApi {
    constructor(apiKey, apiSecret, baseUrl = 'https://futures.kraken.com') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
        this.nonceCounter = 0;
    }
    createNonce() {
        if (this.nonceCounter > 9999) this.nonceCounter = 0;
        return Date.now() + ('0000' + this.nonceCounter++).slice(-5);
    }
    signRequest(endpoint, nonce, postData = '') {
        const path = endpoint.startsWith('/derivatives') ? endpoint.slice('/derivatives'.length) : endpoint;
        const message = postData + nonce + path;
        const hash = crypto.createHash('sha256').update(message).digest();
        const secretDecoded = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha512', secretDecoded);
        return hmac.update(hash).digest('base64');
    }
    async request(method, endpoint, params = {}, isPrivate = false) {
        const url = this.baseUrl + endpoint;
        const requestConfig = { method, url };
        if (isPrivate) {
            const nonce = this.createNonce();
            let postData = '';
            const headers = { 'APIKey': this.apiKey, 'Nonce': nonce };
            if (method === 'POST') {
                postData = qs.stringify(params);
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                requestConfig.data = postData;
            } else {
                headers['Content-Type'] = 'application/json';
                if (Object.keys(params).length > 0) {
                    requestConfig.url += '?' + qs.stringify(params);
                }
            }
            headers['Authent'] = this.signRequest(endpoint, nonce, postData);
            requestConfig.headers = headers;
        } else {
            if (Object.keys(params).length > 0) {
                requestConfig.url += '?' + qs.stringify(params);
            }
        }
        try {
            const response = await axios(requestConfig);
            return response.data;
        } catch (error) {
            const errorMessage = error.response ? error.response.data : error.message;
            // We still log errors to the console for immediate visibility
            console.error(`Error with ${method} ${endpoint}:`, JSON.stringify(errorMessage, null, 2));
            throw { endpoint: `${method} ${endpoint}`, error: errorMessage };
        }
    }
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');
    getOrderbook = (symbol) => this.request('GET', '/derivatives/api/v3/orderbook', { symbol });
    getHistory = (symbol, lastTime) => this.request('GET', '/derivatives/api/v3/history', { symbol, lastTime });
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts', {}, true);
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions', {}, true);
    getOpenOrders = () => this.request('GET', '/derivatives/api/v3/openorders', {}, true);
    getRecentOrders = (symbol) => this.request('GET', '/derivatives/api/v3/recentorders', { symbol }, true);
    getFills = (lastFillTime) => this.request('GET', '/derivatives/api/v3/fills', { lastFillTime }, true);
    getAccountLog = () => this.request('GET', '/api/history/v2/account-log', {}, true);
    sendOrder = (orderParams) => this.request('POST', '/derivatives/api/v3/sendorder', orderParams, true);
    editOrder = (editParams) => this.request('POST', '/derivatives/api/v3/editorder', editParams, true);
    cancelOrder = (cancelParams) => this.request('POST', '/derivatives/api/v3/cancelorder', cancelParams, true);
    cancelAllOrders = (symbol) => this.request('POST', '/derivatives/api/v3/cancelallorders', { symbol }, true);
    cancelAllOrdersAfter = (timeoutSeconds) => this.request('POST', '/derivatives/api/v3/cancelallordersafter', { timeout: timeoutSeconds }, true);
    batchOrder = (batchJson) => this.request('POST', '/derivatives/api/v3/batchorder', { json: JSON.stringify(batchJson) }, true);
    getTransfers = (lastTransferTime) => this.request('GET', '/derivatives/api/v3/transfers', { lastTransferTime }, true);
    getNotifications = () => this.request('GET', '/derivatives/api/v3/notifications', {}, true);
}


// #########################################
// ## Comprehensive Test Runner with File Logging ##
// #########################################

async function main() {
    // --- Configuration ---
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';
    const TRADEABLE_SYMBOL = 'pf_xbtusd';
    const LOG_FILE = 'test-run-results.log'; // The file to write results to

    if (KRAKEN_API_KEY === 'YOUR_API_KEY' || KRAKEN_API_SECRET === 'YOUR_API_SECRET') {
        console.error("FATAL: Please replace 'YOUR_API_KEY' and 'YOUR_API_SECRET' in the script.");
        return;
    }

    // --- Initialize Log File ---
    const startTime = new Date().toISOString();
    fs.writeFileSync(LOG_FILE, `Comprehensive API Test Run - Started at: ${startTime}\n`);
    console.log(`Test results will be written to ${LOG_FILE}`);

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);
    let testOrderId = null;

    // --- Helper function to run and log each test to a file ---
    const runTest = async (name, fn) => {
        const separator = '--------------------------------------------------\n';
        let logContent = `${separator}--- Running test: ${name} ---\n${separator}`;
        console.log(`Running test: ${name}...`); // Keep console output minimal

        try {
            const result = await fn();
            logContent += `Success! Result:\n${JSON.stringify(result, null, 2)}\n\n`;
            fs.appendFileSync(LOG_FILE, logContent);
            return result;
        } catch (e) {
            logContent += `FAILED! Error:\n${JSON.stringify(e, null, 2)}\n\n`;
            fs.appendFileSync(LOG_FILE, logContent);
            console.error(`--- Test FAILED: ${name} (see ${LOG_FILE} for details) ---`);
        }
    };

    // --- Execute All Tests ---
    await runTest("getInstruments", () => api.getInstruments());
    await runTest("getTickers", () => api.getTickers());
    await runTest("getOrderbook", () => api.getOrderbook(TRADEABLE_SYMBOL));
    await runTest("getHistory", () => api.getHistory(TRADEABLE_SYMBOL));
    await runTest("getAccounts", () => api.getAccounts());
    await runTest("getOpenPositions", () => api.getOpenPositions());
    await runTest("getOpenOrders", () => api.getOpenOrders());
    await runTest("getRecentOrders", () => api.getRecentOrders(TRADEABLE_SYMBOL));
    await runTest("getFills", () => api.getFills());
    await runTest("getAccountLog", () => api.getAccountLog());
    await runTest("getTransfers", () => api.getTransfers());
    await runTest("getNotifications", () => api.getNotifications());

    const sendOrderResult = await runTest("sendOrder", () => api.sendOrder({
        orderType: 'lmt', symbol: TRADEABLE_SYMBOL, side: 'buy', size: 1, limitPrice: 1000.0
    }));

    if (sendOrderResult && sendOrderResult.sendStatus && sendOrderResult.sendStatus.status === 'placed') {
        testOrderId = sendOrderResult.sendStatus.order_id;
        fs.appendFileSync(LOG_FILE, `\nCaptured order ID for subsequent tests: ${testOrderId}\n`);

        await runTest("editOrder", () => api.editOrder({ orderId: testOrderId, size: 2, limitPrice: 1001.0 }));
        await runTest("cancelOrder", () => api.cancelOrder({ order_id: testOrderId }));
    } else {
        const warning = "\nSkipping editOrder and cancelOrder tests because sendOrder did not return a valid order ID.\n";
        console.warn(warning);
        fs.appendFileSync(LOG_FILE, warning);
    }

    await runTest("batchOrder", () => api.batchOrder({
        "batchOrder": [{ "order": "send", "order_tag": "1", "orderType": "lmt", "symbol": TRADEABLE_SYMBOL, "side": "buy", "size": 1, "limitPrice": 1002.0 }]
    }));
    
    await runTest("cancelAllOrders", () => api.cancelAllOrders(TRADEABLE_SYMBOL));
    await runTest("cancelAllOrdersAfter", () => api.cancelAllOrdersAfter(60));

    const endTime = new Date().toISOString();
    const finalMessage = `\nComprehensive test run finished at: ${endTime}\n`;
    fs.appendFileSync(LOG_FILE, finalMessage);
    console.log(`\nTest run finished. All results are in ${LOG_FILE}.`);
}

main();
0,
        availableMargin: accounts?.accounts?.margin?.['USD']?.availableMargin || 0,
        unrealisedPnl: openPositions?.openPositions?.reduce((sum, p) => sum + (p.unrealisedPnl || 0), 0) || 0
    };

    // 2. Summarize Open Positions: The AI needs to know what it's currently holding.
    // We don't need every single field.
    const summarizedPositions = openPositions?.openPositions?.map(p => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.price,
        unrealisedPnl: p.unrealisedPnl
    })) || [];

    // 3. Summarize Open Orders: The AI needs to know what orders are waiting to be filled.
    const summarizedOrders = openOrders?.orders?.map(o => ({
        orderId: o.orderId,
        symbol: o.symbol,
        side: o.side,
        type: o.orderType,
        size: o.size,
        limitPrice: o.limitPrice,
        status: o.status
    })) || [];

    // 4. Process the rest of the data (which is already quite lean)
    const ticker = tickers?.tickers?.find(t => t.symbol === this.symbol) || null;
    const orderBook = (orderBookData?.bids && orderBookData?.asks)
        ? {
            bids: orderBookData.bids.slice(0, 5), // Keep slicing to top 5
            asks: orderBookData.asks.slice(0, 5)
          }
        : null;
    const history = historyData?.history?.slice(0, 10) || null; // Keep slicing to last 10

    // 5. Return the final, compact object
    return {
        accounts: summarizedAccounts,
        openPositions: summarizedPositions,
        openOrders: summarizedOrders,
        ticker,
        orderBook,
        history
    };
}
// In TradingBot class, REPLACE the old runDecisionCycle with this updated version.

async runDecisionCycle() {
    console.log(`\n--- [${new Date().toLocaleTimeString()}] Starting new decision cycle ---`);

    // 1. Gather all necessary data (this part remains the same)
    console.log("Fetching latest market and account data...");
    const [
        accounts, openPositions, openOrders, tickers, orderBookData, historyData
    ] = await Promise.all([
        this.api.getAccounts().catch(e => { console.error("Error fetching accounts:", e); return null; }),
        this.api.getOpenPositions().catch(e => { console.error("Error fetching open positions:", e); return null; }),
        this.api.getOpenOrders().catch(e => { console.error("Error fetching open orders:", e); return null; }),
        this.api.getTickers().catch(e => { console.error("Error fetching tickers:", e); return null; }),
        this.api.getOrderbook(this.symbol).catch(e => { console.error(`Error fetching order book for ${this.symbol}:`, e); return null; }),
        this.api.getHistory(this.symbol).catch(e => { console.error(`Error fetching history for ${this.symbol}:`, e); return null; })
    ]);

    if (!accounts) {
        console.error("Could not fetch essential account data. Skipping this cycle.");
        return;
    }

    // 2. *** USE THE NEW SUMMARIZER ***
    // This creates a much smaller, more focused data object for the prompt.
    const marketData = this.summarizeMarketData({
        accounts,
        openPositions,
        openOrders,
        tickers,
        orderBookData,
        historyData
    });

    // 3. Construct the prompt and get AI decision
    console.log("Constructing prompt and querying AI...");
    const prompt = this.constructPrompt(marketData);
    const aiResponseString = await callDeepSeekAPI(prompt);

    if (!aiResponseString) {
        console.error("Failed to get a response from AI. Skipping cycle.");
        return;
    }

    // 4. Parse and execute the decision (This part remains the same)
    let decision;
    try {
        decision = JSON.parse(aiResponseString);
    } catch (e) {
        console.error("Failed to parse AI response into JSON. Response was:", aiResponseString);
        this.conversationHistory.push({
            command: { function: "parseError", parameters: {} },
            result: { error: "Invalid JSON response from AI.", response: aiResponseString }
        });
        return;
    }
    if (!decision) {
        console.error("AI returned a null decision. Skipping cycle.");
        return;
    }

    console.log(`AI Decision: ${decision.function}`, decision.parameters || '');

    let executionResult;
    try {
        switch (decision.function) {
            case "sendOrder":
                executionResult = await this.api.sendOrder(decision.parameters);
                break;
            case "editOrder":
                executionResult = await this.api.editOrder(decision.parameters);
                break;
            case "cancelOrder":
                executionResult = await this.api.cancelOrder(decision.parameters);
                break;
            case "cancelAllOrders":
                executionResult = await this.api.cancelAllOrders(decision.parameters.symbol);
                break;
            case "doNothing":
                executionResult = { status: "success", reason: decision.parameters.reason };
                break;
            default:
                throw new Error(`Unknown function '${decision.function}' received from AI.`);
        }
        console.log("Execution Result:", executionResult);
    } catch (error) {
        console.error("Error executing AI command:", error);
        executionResult = { status: "error", details: error };
    }

    // 5. Update conversation history
    this.conversationHistory.push({ command: decision, result: executionResult });
}
start() {
        if (this.isRunning) {
            console.log("Bot is already running.");
            return;
        }
        console.log(`Starting trading bot for ${this.symbol}. Decision interval: ${this.interval / 1000}s.`);
        this.isRunning = true;
        // Run the first cycle immediately, then set the interval
        this.runDecisionCycle().finally(() => {
            setInterval(() => this.runDecisionCycle(), this.interval);
        });
    }
} // <--- +++ THIS CLOSING BRACE WAS MISSING +++

// #############################
// ##      RUN THE BOT        ##
// #############################

function main() {
    // --- CONFIGURATION ---
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';    const TRADEABLE_SYMBOL = 'pf_xbtusd'; // The symbol you want the bot to trade
    const DECISION_INTERVAL_MS = 30000; // 30 seconds

    if (KRAKEN_API_KEY === 'YOUR_KRAKEN_API_KEY' || KRAKEN_API_SECRET === 'YOUR_KRAKEN_API_SECRET') {
        console.error("FATAL: Please replace 'YOUR_KRAKEN_API_KEY' and 'YOUR_KRAKEN_API_SECRET' in the script.");
        return;
    }

    const bot = new TradingBot(KRAKEN_API_KEY, KRAKEN_API_SECRET, TRADEABLE_SYMBOL, DECISION_INTERVAL_MS);
    bot.start();
}

main();

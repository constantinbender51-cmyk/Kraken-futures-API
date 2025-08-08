const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

// Paste the complete KrakenFuturesApi class here...
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


// #############################
// ## Comprehensive Test Runner ##
// #############################

async function main() {
    // IMPORTANT: Replace with your actual, working API credentials
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';    const TRADEABLE_SYMBOL = 'pf_xbtusd'; // A symbol you are able to trade

    if (KRAKEN_API_KEY === 'YOUR_API_KEY' || KRAKEN_API_SECRET === 'YOUR_API_SECRET') {
        console.error("FATAL: Please replace 'YOUR_API_KEY' and 'YOUR_API_SECRET' in the script.");
        return;
    }

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);
    let testOrderId = null; // To store the ID of the order we create

    // Helper function to run and log each test
    const runTest = async (name, fn) => {
        try {
            console.log(`\n--- Running test: ${name} ---`);
            const result = await fn();
            console.log(`Success! Result:`, JSON.stringify(result, null, 2));
            return result;
        } catch (e) {
            console.error(`--- Test FAILED: ${name} ---`);
        }
    };

    console.log("Starting comprehensive API test run...");

    // --- Public Endpoints ---
    await runTest("getInstruments", () => api.getInstruments());
    await runTest("getTickers", () => api.getTickers());
    await runTest("getOrderbook", () => api.getOrderbook(TRADEABLE_SYMBOL));
    await runTest("getHistory", () => api.getHistory(TRADEABLE_SYMBOL));

    // --- Private Account Endpoints ---
    await runTest("getAccounts", () => api.getAccounts());
    await runTest("getOpenPositions", () => api.getOpenPositions());
    await runTest("getOpenOrders", () => api.getOpenOrders());
    await runTest("getRecentOrders", () => api.getRecentOrders(TRADEABLE_SYMBOL));
    await runTest("getFills", () => api.getFills());
    await runTest("getAccountLog", () => api.getAccountLog());
    await runTest("getTransfers", () => api.getTransfers());
    await runTest("getNotifications", () => api.getNotifications());

    // --- Private Trading Endpoints (Interactive) ---
    const sendOrderResult = await runTest("sendOrder", () => api.sendOrder({
        orderType: 'lmt',
        symbol: TRADEABLE_SYMBOL,
        side: 'buy',
        size: 1,
        limitPrice: 1000.0 // Use a price far from the market to avoid instant fill
    }));

    if (sendOrderResult && sendOrderResult.sendStatus && sendOrderResult.sendStatus.status === 'placed') {
        testOrderId = sendOrderResult.sendStatus.order_id;
        console.log(`\nCaptured order ID for subsequent tests: ${testOrderId}`);

        await runTest("editOrder", () => api.editOrder({
            orderId: testOrderId,
            size: 2, // Edit the size
            limitPrice: 1001.0 // Edit the price
        }));

        await runTest("cancelOrder", () => api.cancelOrder({ order_id: testOrderId }));
    } else {
        console.warn("\nSkipping editOrder and cancelOrder tests because sendOrder did not return a valid order ID.");
    }

    await runTest("batchOrder", () => api.batchOrder({
        "batchOrder": [
            { "order": "send", "order_tag": "1", "orderType": "lmt", "symbol": TRADEABLE_SYMBOL, "side": "buy", "size": 1, "limitPrice": 1002.0 },
            { "order": "send", "order_tag": "2", "orderType": "lmt", "symbol": TRADEABLE_SYMBOL, "side": "sell", "size": 1, "limitPrice": 99999.0 }
        ]
    }));

    // --- Cleanup and Final Tests ---
    await runTest("cancelAllOrders", () => api.cancelAllOrders(TRADEABLE_SYMBOL));
    
    // Note: cancelAllOrdersAfter is a "dead man's switch". It doesn't return anything immediately.
    // It returns a confirmation that the timer has been set.
    await runTest("cancelAllOrdersAfter", () => api.cancelAllOrdersAfter(60)); // Set a 60-second timer

    console.log("\n\nComprehensive test run finished.");
}

main();

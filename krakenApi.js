const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

/**
 * A comprehensive client for the Kraken Futures API (V3).
 * This class handles authentication and provides methods for all major public and private endpoints.
 */
class KrakenFuturesApi {
    /**
     * @param {string} apiKey Your Kraken Futures API key.
     * @param {string} apiSecret Your Kraken Futures API secret (in Base64 format).
     * @param {string} [baseUrl='https://futures.kraken.com'] The base URL for the API.
     */
    constructor(apiKey, apiSecret, baseUrl = 'https://futures.kraken.com') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
        this.nonceCounter = 0;
    }

    // ##################################
    // ## Core Request & Auth Methods ##
    // ##################################

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
            } else { // GET
                headers['Content-Type'] = 'application/json';
                if (Object.keys(params).length > 0) {
                    requestConfig.url += '?' + qs.stringify(params);
                }
            }
            
            headers['Authent'] = this.signRequest(endpoint, nonce, postData);
            requestConfig.headers = headers;
        } else {
            // Public GET request
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

    // ######################
    // ## Public Endpoints ##
    // ######################

    /** Returns all instruments with their specifications. */
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');

    /** Returns market data for all instruments. */
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');

    /** Returns the entire order book for a given symbol. */
    getOrderbook = (symbol) => this.request('GET', '/derivatives/api/v3/orderbook', { symbol });

    /** Returns historical data for a given symbol. */
    getHistory = (symbol, lastTime) => this.request('GET', '/derivatives/api/v3/history', { symbol, lastTime });

    // #######################
    // ## Private Endpoints ##
    // #######################

    // === Account Information ===
    /** Returns key account information. */
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts', {}, true);
    
    /** Returns all open positions. */
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions', {}, true);

    /** Returns all open orders. */
    getOpenOrders = () => this.request('GET', '/derivatives/api/v3/openorders', {}, true);

    /** Returns recent orders, optionally for a specific symbol. */
    getRecentOrders = (symbol) => this.request('GET', '/derivatives/api/v3/recentorders', { symbol }, true);

    /** Returns filled orders, optionally since a specific time. */
    getFills = (lastFillTime) => this.request('GET', '/derivatives/api/v3/fills', { lastFillTime }, true);

    /** Returns account activity log. */
    getAccountLog = () => this.request('GET', '/api/history/v2/account-log', {}, true);

    // === Trading ===
    /** Sends a new order. */
    sendOrder = (orderParams) => this.request('POST', '/derivatives/api/v3/sendorder', orderParams, true);

    /** Edits an existing order. */
    editOrder = (editParams) => this.request('POST', '/derivatives/api/v3/editorder', editParams, true);

    /** Cancels an existing order by `order_id` or `cliOrdId`. */
    cancelOrder = (cancelParams) => this.request('POST', '/derivatives/api/v3/cancelorder', cancelParams, true);

    /** Cancels all orders, optionally for a specific symbol. */
    cancelAllOrders = (symbol) => this.request('POST', '/derivatives/api/v3/cancelallorders', { symbol }, true);

    /** Cancels all orders after a specified timeout in seconds. */
    cancelAllOrdersAfter = (timeoutSeconds) => this.request('POST', '/derivatives/api/v3/cancelallordersafter', { timeout: timeoutSeconds }, true);

    /** Sends a batch of order commands (send, cancel, edit). */
    batchOrder = (batchJson) => this.request('POST', '/derivatives/api/v3/batchorder', { json: JSON.stringify(batchJson) }, true);

    // === Transfers & Notifications ===
    /** Returns wallet transfer history. */
    getTransfers = (lastTransferTime) => this.request('GET', '/derivatives/api/v3/transfers', { lastTransferTime }, true);

    /** Returns all system notifications. */
    getNotifications = () => this.request('GET', '/derivatives/api/v3/notifications', {}, true);
}


// #################
// ## Example Usage ##
// #################

async function main() {
    // Replace with your actual, working API credentials
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';
    if (KRAKEN_API_KEY === 'YOUR_API_KEY') {
        console.log("Please add your API credentials to run the example.");
        return;
    }

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);

    try {
        console.log("--- 1. Public: Get Instruments ---");
        const instruments = await api.getInstruments();
        console.log(`Found ${instruments.instruments.length} instruments.`);

        console.log("\n--- 2. Private GET: Get Accounts ---");
        const accounts = await api.getAccounts();
        console.log("Accounts:", JSON.stringify(accounts, null, 2));

        console.log("\n--- 3. Private POST: Send Order ---");
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pf_xbtusd', // Use a tradeable symbol
            side: 'buy',
            size: 1,
            limitPrice: 1000.0
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("Send Order Result:", JSON.stringify(orderResult, null, 2));
        
        // If the order was successful and you have an order_id, you can cancel it
        if (orderResult.sendStatus && orderResult.sendStatus.order_id) {
            const orderId = orderResult.sendStatus.order_id;
            console.log(`\n--- 4. Private POST: Cancel Order (ID: ${orderId}) ---`);
            const cancelResult = await api.cancelOrder({ order_id: orderId });
            console.log("Cancel Order Result:", JSON.stringify(cancelResult, null, 2));
        }

        console.log("\n--- 5. Private POST: Batch Order (Example) ---");
        const batch = {
            "batchOrder": [
                { "order": "send", "order_tag": "1", "orderType": "lmt", "symbol": "pf_xbtusd", "side": "buy", "size": 1, "limitPrice": 1001.0 },
                { "order": "send", "order_tag": "2", "orderType": "lmt", "symbol": "pf_xbtusd", "side": "buy", "size": 1, "limitPrice": 1002.0 }
            ]
        };
        const batchResult = await api.batchOrder(batch);
        console.log("Batch Order Result:", JSON.stringify(batchResult, null, 2));

    } catch (e) {
        console.log("\nExecution halted due to a caught error.");
    }
}

main();

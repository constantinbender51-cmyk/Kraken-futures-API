const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

class KrakenFuturesApi {
    /**
     * @param {string} apiKey - Your Kraken Futures API key.
     * @param {string} apiSecret - Your Kraken Futures API secret.
     * @param {string} [baseUrl='https://futures.kraken.com'] - The base URL for the API.
     */
    constructor(apiKey, apiSecret, baseUrl = 'https://futures.kraken.com') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
        this.nonceCounter = 0;
    }

    /**
     * Creates a unique nonce for each request.
     * @returns {string} A timestamp-based nonce.
     */
    createNonce() {
        if (this.nonceCounter > 9999) this.nonceCounter = 0;
        // Pad with leading zeros to 5 digits
        const padding = '00000';
        const counterStr = (padding + this.nonceCounter++).slice(-5);
        return Date.now() + counterStr;
    }

    /**
     * Signs the request data to create the 'Authent' header.
     * @param {string} endpoint - The API endpoint path (e.g., '/derivatives/api/v3/sendorder').
     * @param {string} nonce - The unique nonce for this request.
     * @param {string} [postData=''] - The URL-encoded string of parameters for POST requests.
     * @returns {string} The Base64-encoded signature.
     */
    signRequest(endpoint, nonce, postData = '') {
        const path = endpoint.startsWith('/derivatives') ? endpoint.slice('/derivatives'.length) : endpoint;
        const message = postData + nonce + path;
        const hash = crypto.createHash('sha256').update(message).digest();
        const secretDecoded = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha512', secretDecoded);
        return hmac.update(hash).digest('base64');
    }

    /**
     * Makes an API request.
     * @param {string} method - The HTTP method ('GET' or 'POST').
     * @param {string} endpoint - The API endpoint path.
     * @param {Object} [params={}] - The request parameters.
     * @returns {Promise<Object>} The API response data.
     */
    async request(method, endpoint, params = {}) {
        const url = this.baseUrl + endpoint;
        const nonce = this.createNonce();
        let postData = '';
        let headers = {
            'APIKey': this.apiKey,
            'Nonce': nonce,
            'User-Agent': 'Kraken-Futures-JS-Client/1.0'
        };

        if (method === 'POST') {
            postData = qs.stringify(params);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        headers['Authent'] = this.signRequest(endpoint, nonce, postData);

        const requestConfig = { method, url, headers };
        if (method === 'POST') {
            requestConfig.data = postData;
        } else if (Object.keys(params).length > 0) {
            requestConfig.url += '?' + qs.stringify(params);
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
    // ### Public Methods ###
    // ######################

    /** Returns all instruments with their specifications. */
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');

    /** Returns market data for all instruments. */
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');

    /** Returns the entire order book for a given symbol. */
    getOrderbook = (params) => this.request('GET', '/derivatives/api/v3/orderbook', params);

    /** Returns historical data for a given symbol. */
    getHistory = (params) => this.request('GET', '/derivatives/api/v3/history', params);

    // #######################
    // ### Private Methods ###
    // #######################

    /** Returns key account information. */
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts');

    /** Places a new order. */
    sendOrder = (params) => this.request('POST', '/derivatives/api/v3/sendorder', params);

    /** Edits an existing order. */
    editOrder = (params) => this.request('POST', '/derivatives/api/v3/editorder', params);

    /** Cancels an existing order. */
    cancelOrder = (params) => this.request('POST', '/derivatives/api/v3/cancelorder', params);

    /** Cancels all orders, optionally for a specific symbol. */
    cancelAllOrders = (params) => this.request('POST', '/derivatives/api/v3/cancelallorders', params);

    /** Cancels all orders after a specified timeout. */
    cancelAllOrdersAfter = (params) => this.request('POST', '/derivatives/api/v3/cancelallordersafter', params);

    /** Sends a batch of order commands (send, cancel, edit). */
    batchOrder = (params) => this.request('POST', '/derivatives/api/v3/batchorder', params);

    /** Returns all open orders. */
    getOpenOrders = () => this.request('GET', '/derivatives/api/v3/openorders');

    /** Returns all open positions. */
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions');

    /** Returns recent orders, optionally for a specific symbol. */
    getRecentOrders = (params) => this.request('GET', '/derivatives/api/v3/recentorders', params);

    /** Returns filled orders (executions). */
    getFills = (params) => this.request('GET', '/derivatives/api/v3/fills', params);

    /** Returns account activity log. */
    getAccountLog = () => this.request('GET', '/api/history/v2/account-log');

    /** Returns wallet transfer history. */
    getTransfers = (params) => this.request('GET', '/derivatives/api/v3/transfers', params);

    /** Returns system notifications. */
    getNotifications = () => this.request('GET', '/derivatives/api/v3/notifications');
}

// --- Main Execution Example ---
async function main() {
    // IMPORTANT: Replace with your actual API credentials.
    // These keys are for demonstration and will not work.
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';
    if (KRAKEN_API_KEY === 'YOUR_API_KEY' || KRAKEN_API_SECRET === 'YOUR_API_SECRET') {
        console.log("Please add your API credentials to run the example.");
        return;
    }

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);

    try {
        console.log("--- Testing Public GET Request (getTickers) ---");
        const tickers = await api.getTickers();
        console.log("getTickers Success! First 2 Tickers:", JSON.stringify(tickers.tickers.slice(0, 2), null, 2));

        console.log("\n--- Testing Private GET Request (getAccounts) ---");
        const accounts = await api.getAccounts();
        console.log("getAccounts Success! Response:", JSON.stringify(accounts, null, 2));

        console.log("\n--- Testing Private POST Request (sendOrder) ---");
        // This is an example and will likely fail if you don't have funds or if the price is invalid.
        // Use a tradeable symbol like 'pf_xbtusd'.
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pf_xbtusd',
            side: 'buy',
            size: 1,
            limitPrice: 1000.00 // Use a price far from the market to avoid execution
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("sendOrder Success! Response:", JSON.stringify(orderResult, null, 2));

        // If the order was successful, we can try to cancel it.
        if (orderResult.sendStatus && orderResult.sendStatus.order_id) {
            console.log("\n--- Testing Private POST Request (cancelOrder) ---");
            const cancelParams = { order_id: orderResult.sendStatus.order_id };
            const cancelResult = await api.cancelOrder(cancelParams);
            console.log("cancelOrder Success! Response:", JSON.stringify(cancelResult, null, 2));
        }

    } catch (e) {
        console.log("\nExecution halted due to an error.");
    }
}

// At the very end of krakenApi.js

// This makes the class available as a named export.
module.exports = {
    KrakenFuturesApi
};


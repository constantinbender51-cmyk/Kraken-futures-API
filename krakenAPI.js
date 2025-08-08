const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

class KrakenFuturesApi {
    /**
     * @param {string} apiKey The API key.
     * @param {string} apiSecret The API secret.
     * @param {string} baseUrl The base URL for the API endpoint.
     */
    constructor(apiKey, apiSecret, baseUrl = 'https://futures.kraken.com') {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
        this.nonceCounter = 0;
    }

    /**
     * Creates a nonce for the API request.
     * @returns {string} The nonce.
     */
    async createNonce() {
        if (this.nonceCounter === 9999) {
            this.nonceCounter = 0;
        }
        const timestamp = Date.now();
        return timestamp + ('0000' + this.nonceCounter++).slice(-5);
    }

    /**
     * Generates authentication headers for a private API request.
     * @param {string} endpoint The API endpoint.
     * @param {string} postData The data to be sent in the request body.
     * @returns {object} The authentication headers.
     */
   async getAuthHeaders(endpoint, postData = '') {
        const path = endpoint.startsWith('/derivatives') ? endpoint.slice('/derivatives'.length) : endpoint;
        const nonce = this.createNonce();
        const message = postData + nonce + path;

        const hash = crypto.createHash('sha256').update(message).digest();
        const secretDecoded = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha512', secretDecoded);
        const signature = hmac.update(hash).digest('base64');

        return {
            'APIKey': this.apiKey,
            'Nonce': nonce,
            'Authent': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }

    /**
     * Makes an API request.
     * @param {string} method The HTTP method (GET or POST).
     * @param {string} endpoint The API endpoint.
     * @param {object} [params={}] The request parameters.
     * @param {boolean} [isPrivate=false] Whether the endpoint is private.
     * @returns {Promise<object>} The API response data.
     */
    async request(method, endpoint, params = {}, isPrivate = false) {
        const url = this.baseUrl + endpoint;
        const headers = { 'Accept': 'application/json' };
        let requestConfig = { method, url, headers };

        if (isPrivate) {
            if (method === 'GET') {
                const queryString = qs.stringify(params);
                requestConfig.url += queryString ? `?${queryString}` : '';
                Object.assign(headers, this.getAuthHeaders(endpoint, queryString));
            } else { // POST
                const postData = qs.stringify(params);
                Object.assign(headers, this.getAuthHeaders(endpoint, postData));
                requestConfig.data = postData;
            }
        } else if (method === 'GET') {
            requestConfig.url += `?${qs.stringify(params)}`;
        }

        try {
            const response = await axios(requestConfig);
            return response.data;
        } catch (error) {
            console.error(`Error with ${method} ${endpoint}:`, error.response ? error.response.data : error.message);
            throw error;
        }
    }

    // ######################
    // ## Public Endpoints ##
    // ######################

    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');
    getOrderbook = (symbol) => this.request('GET', '/derivatives/api/v3/orderbook', { symbol });
    getHistory = (symbol, lastTime) => this.request('GET', '/derivatives/api/v3/history', { symbol, lastTime });

    // #######################
    // ## Private Endpoints ##
    // #######################

    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts', {}, true);
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions', {}, true);
    getOpenOrders = () => this.request('GET', '/derivatives/api/v3/openorders', {}, true);
    getRecentOrders = (symbol) => this.request('GET', '/derivatives/api/v3/recentorders', { symbol }, true);
    getFills = (lastFillTime) => this.request('GET', '/derivatives/api/v3/fills', { lastFillTime }, true);
    getTransfers = (lastTransferTime) => this.request('GET', '/derivatives/api/v3/transfers', { lastTransferTime }, true);
    getNotifications = () => this.request('GET', '/derivatives/api/v3/notifications', {}, true);
    getAccountLog = () => this.request('GET', '/api/history/v2/account-log', {}, true);

    sendOrder = (orderType, symbol, side, size, limitPrice, stopPrice = null, clientOrderId = null) => {
        const params = { orderType, symbol, side, size, limitPrice };
        if (stopPrice) params.stopPrice = stopPrice;
        if (clientOrderId) params.cliOrdId = clientOrderId;
        return this.request('POST', '/derivatives/api/v3/sendorder', params, true);
    };

    editOrder = (edit) => this.request('POST', '/derivatives/api/v3/editorder', edit, true);
    
    cancelOrder = (order_id, cliOrdId) => {
        const params = order_id ? { order_id } : { cliOrdId };
        return this.request('POST', '/derivatives/api/v3/cancelorder', params, true);
    };

    cancelAllOrders = (symbol) => this.request('POST', '/derivatives/api/v3/cancelallorders', { symbol }, true);
    cancelAllOrdersAfter = (timeout) => this.request('POST', '/derivatives/api/v3/cancelallordersafter', { timeout }, true);
    
    batchOrder = (elementJson) => {
        const params = { json: JSON.stringify(elementJson) };
        return this.request('POST', '/derivatives/api/v3/batchorder', params, true);
    };
}

// #################
// ## Example Usage ##
// #################

async function main() {
    // IMPORTANT: Replace with your actual API key and secret.
    const API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';

    const api = new KrakenFuturesApi(API_KEY, API_SECRET);

    try {
        console.log('--- Testing Public Endpoints ---');
        
        const instruments = await api.getInstruments();
        console.log('Instruments:', instruments.result === 'success' ? `${instruments.instruments.length} instruments found.` : instruments.error);

        const tickers = await api.getTickers();
        console.log('Tickers:', tickers.result === 'success' ? `${tickers.tickers.length} tickers found.` : tickers.error);

        const orderbook = await api.getOrderbook('PI_XBTUSD');
        console.log('Orderbook for PI_XBTUSD:', orderbook.result === 'success' ? 'Orderbook received.' : orderbook.error);

        console.log('\n--- Testing Private Endpoints ---');
        // Note: These will fail without valid API credentials.

        const accounts = await api.getAccounts();
        console.log('Accounts:', accounts);

        const openPositions = await api.getOpenPositions();
        console.log('Open Positions:', openPositions);
        
        // Example of sending an order (this will fail with dummy credentials)
        /*
        const orderResult = await api.sendOrder('lmt', 'PI_XBTUSD', 'buy', 1, 10000.0);
        console.log('Send Order Result:', orderResult);
        */

    } catch (error) {
        // Error logging is handled within the request method
    }
}

main();

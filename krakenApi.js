const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

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

    async request(method, endpoint, params = {}) {
        const url = this.baseUrl + endpoint;
        const nonce = this.createNonce();
        let headers = { 'APIKey': this.apiKey, 'Nonce': nonce };
        let requestConfig = { method, url, headers };
        
        if (method === 'GET') {
            // Following the logic of your working example for GET requests.
            // The signature for GET is always created with an empty string.
            const authent = this.signRequest(endpoint, nonce, '');
            headers['Authent'] = authent;
            // The Content-Type header is included, as in your working code.
            headers['Content-Type'] = 'application/json';

            // Append params to URL if they exist.
            const queryString = qs.stringify(params);
            if (queryString) {
                requestConfig.url += '?' + queryString;
            }

        } else { // POST
            // For POST, the signature is created from the URL-encoded body.
            const postData = qs.stringify(params);
            const authent = this.signRequest(endpoint, nonce, postData);
            headers['Authent'] = authent;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestConfig.data = postData;
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

    // Public endpoints don't need signing, so we can make a simpler request.
    async publicRequest(endpoint, params = {}) {
        let url = this.baseUrl + endpoint;
        const queryString = qs.stringify(params);
        if (queryString) {
            url += '?' + queryString;
        }
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            // ... error handling ...
        }
    }

    // --- Public API Methods ---
    getInstruments = () => this.publicRequest('/derivatives/api/v3/instruments');
    getTickers = () => this.publicRequest('/derivatives/api/v3/tickers');
    getOrderbook = (symbol) => this.publicRequest('/derivatives/api/v3/orderbook', { symbol });
    getHistory = (symbol, lastTime) => this.publicRequest('/derivatives/api/v3/history', { symbol, lastTime });

    // --- Private API Methods ---
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts');
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions');
    sendOrder = (params) => this.request('POST', '/derivatives/api/v3/sendorder', params);
    // ... other private methods ...
}

// --- Main Execution ---
async function main() {
    // Replace with your actual, working API credentials
    const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
    const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';

    const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);

    try {
        console.log("Fetching open positions using the class method...");
        const positions = await api.getOpenPositions();
        console.log("Success! Response:", JSON.stringify(positions, null, 2));

        console.log("\nSending a test order...");
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pi_xbtusd',
            side: 'buy',
            size: 1,
            limitPrice: 1000.0
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("Order placement result:", JSON.stringify(orderResult, null, 2));
        // This is expected to fail with an insufficient funds error, not an auth error.

    } catch (e) {
        // Errors are already logged in the request method.
        console.log("\nExecution halted due to an error.");
    }
}

main();

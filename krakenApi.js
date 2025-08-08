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
        let postData = '';
        let headers = {
            'APIKey': this.apiKey,
            'Nonce': nonce
        };

        // Determine postData and Content-Type based on method
        if (method === 'POST') {
            postData = qs.stringify(params);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else { // GET
            // As confirmed by your working code, Content-Type is included for GET
            headers['Content-Type'] = 'application/json';
            // For GET requests, the signature uses an empty string for postData
        }
        
        // The signature is created with the correct postData string (empty for GET, encoded for POST)
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
    
    // --- Public API Methods ---
    getInstruments = () => this.request('GET', '/derivatives/api/v3/instruments');
    getTickers = () => this.request('GET', '/derivatives/api/v3/tickers');
    
    // --- Private API Methods ---
    getAccounts = () => this.request('GET', '/derivatives/api/v3/accounts');
    getOpenPositions = () => this.request('GET', '/derivatives/api/v3/openpositions');
    sendOrder = (params) => this.request('POST', '/derivatives/api/v3/sendorder', params);
    cancelOrder = (params) => this.request('POST', '/derivatives/api/v3/cancelorder', params);
    // ... add all other API functions here following the same pattern
}

// --- Main Execution ---
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
        console.log("--- Testing GET Request ---");
        const positions = await api.getOpenPositions();
        console.log("getOpenPositions Success! Response:", JSON.stringify(positions, null, 2));

        console.log("\n--- Testing POST Request ---");
        // As you discovered, using a tradeable symbol like 'pf_xbtusd' is the key.
        const orderParams = {
            orderType: 'lmt',
            symbol: 'pf_xbtusd', // Using the correct, tradeable symbol
            side: 'buy',
            size: 1,
            limitPrice: 1000.0
        };
        const orderResult = await api.sendOrder(orderParams);
        console.log("sendOrder Success! Response:", JSON.stringify(orderResult, null, 2));

    } catch (e) {
        console.log("\nExecution halted due to an error.");
    }
}

main();
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

// Correctly import the class from your `krakenApi.js` file.
const { KrakenFuturesApi } = require('./krakenApi.js');

// ##################################################################
// ### Using the hard-coded API keys as requested for testing.    ###
// ##################################################################
const KRAKEN_API_KEY = '2J/amVE61y0K0k34qVduE2fSiQTMpppw6Y+K+b+qt9zk7o+UvtBQTwBq';
const KRAKEN_API_SECRET = '6CEQlIa0+YrlxBXWAfdvkpcCpVK3UT5Yidpg/o/36f60WWETLU1bU1jJwHK14LqFJq1T3FRj1Pdj/kk8zuhRiUJi';
// ##################################################################

const api = new KrakenFuturesApi(KRAKEN_API_KEY, KRAKEN_API_SECRET);

// --- Helper function to pause execution ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Helper Function to Run and Log Tests ---
async function runTest(testName, testFunction) {
    console.log(`\n--- Running Test: ${testName} ---`);
    try {
        const result = await testFunction();
        console.log(`✅ SUCCESS: ${testName}`);
        console.log(JSON.stringify(result, null, 2));
        return result; // Return result for chained tests
    } catch (error) {
        console.error(`❌ FAILED: ${testName}`);
    }
    return null; // Return null on failure
}

// --- Main Test Execution ---
async function main() {
    console.log("🚀 Starting Kraken Futures API Function Tests... (with 1-second delay between calls) 🚀");

    // =====================================
    // === Public Endpoint Tests (No Auth) ===
    // =====================================
    await sleep(1000);
    await runTest("getInstruments", () => api.getInstruments());

    await sleep(1000);
    await runTest("getTickers", () => api.getTickers());

    await sleep(1000);
    await runTest("getOrderbook (PI_XBTUSD)", () => api.getOrderbook({ symbol: 'PI_XBTUSD' }));

    await sleep(1000);
    await runTest("getHistory (PI_XBTUSD)", () => api.getHistory({ symbol: 'PI_XBTUSD' }));

    // =======================================
    // === Private Endpoint Tests (Auth Needed) ===
    // =======================================
    await sleep(1000);
    await runTest("getAccounts", () => api.getAccounts());

    await sleep(1000);
    await runTest("getOpenPositions", () => api.getOpenPositions());

    await sleep(1000);
    await runTest("getOpenOrders", () => api.getOpenOrders());

    await sleep(1000);
    await runTest("getRecentOrders (all symbols)", () => api.getRecentOrders());

    await sleep(1000);
    await runTest("getFills", () => api.getFills());

    await sleep(1000);
    await runTest("getTransfers", () => api.getTransfers());

    await sleep(1000);
    await runTest("getNotifications", () => api.getNotifications());

    await sleep(1000);
    await runTest("getAccountLog", () => api.getAccountLog());

    // =======================================
    // === Action/POST Endpoint Tests (Auth Needed) ===
    // =======================================
    
    // --- Send Order Test ---
    const orderParams = {
        orderType: 'lmt',
        symbol: 'pf_xbtusd',
        side: 'buy',
        size: 1,
        limitPrice: 1000.00,
        cliOrdId: `my-test-order-${Date.now()}`
    };
    await sleep(1000);
    const sendOrderResult = await runTest("sendOrder", () => api.sendOrder(orderParams));

    // --- Chained Tests: Edit and Cancel the order just created ---
    if (sendOrderResult && sendOrderResult.sendStatus && sendOrderResult.sendStatus.status === 'placed') {
        const orderId = sendOrderResult.sendStatus.order_id;
        console.log(`\nOrder placed successfully (order_id: ${orderId}). Proceeding with Edit and Cancel tests...`);

        const editParams = { orderId: orderId, size: 2 };
        await sleep(1000);
        await runTest("editOrder", () => api.editOrder(editParams));

        await sleep(1000);
        await runTest("cancelOrder", () => api.cancelOrder({ order_id: orderId }));
    } else {
        console.log("\nSkipping Edit/Cancel tests because initial order placement failed or was not 'placed'.");
    }

    // --- Batch Order Test ---
    const batchParams = {
        json: JSON.stringify({
            "batchOrder": [
                { "order": "send", "order_tag": "1", "orderType": "lmt", "symbol": "pf_xbtusd", "side": "buy", "size": 1, "limitPrice": 1000.0 },
                { "order": "send", "order_tag": "2", "orderType": "lmt", "symbol": "pf_ethusd", "side": "sell", "size": 1, "limitPrice": 9999.0 }
            ]
        })
    };
    await sleep(1000);
    const batchResult = await runTest("batchOrder", () => api.batchOrder(batchParams));

    // --- Cancel All Orders for a Symbol ---
    if (batchResult && batchResult.batchStatus) {
         await sleep(1000);
         await runTest("cancelAllOrders (pf_xbtusd)", () => api.cancelAllOrders({ symbol: 'pf_xbtusd' }));
         
         await sleep(1000);
         await runTest("cancelAllOrders (pf_ethusd)", () => api.cancelAllOrders({ symbol: 'pf_ethusd' }));
    }

    // --- Cancel All Orders After (Dead Man's Switch) ---
    await sleep(1000);
    await runTest("cancelAllOrdersAfter (set timer for 60s)", () => api.cancelAllOrdersAfter({ timeout: 60 }));
    
    await sleep(1000);
    await runTest("cancelAllOrdersAfter (check status)", () => api.cancelAllOrdersAfter({}));
    
    await sleep(1000);
    await runTest("cancelAllOrdersAfter (cancel timer)", () => api.cancelAllOrdersAfter({ timeout: 0 }));

    console.log("\n\n✅ All tests completed.");
}

main().catch(err => {
    console.error("An unexpected error occurred during the test run:", err);
});
        limitPrice: 1000.00,
        cliOrdId: `my-test-order-${Date.now()}` // Unique client order id
    };
    const sendOrderResult = await runTest("sendOrder", () => api.sendOrder(orderParams));

    // --- Chained Tests: Edit and Cancel the order just created ---
    if (sendOrderResult && sendOrderResult.sendStatus && sendOrderResult.sendStatus.status === 'placed') {
        const orderId = sendOrderResult.sendStatus.order_id;
        console.log(`\nOrder placed successfully (order_id: ${orderId}). Proceeding with Edit and Cancel tests...`);

        // --- Edit Order Test ---
        const editParams = {
            orderId: orderId,
            size: 2, // Change size from 1 to 2
        };
        await runTest("editOrder", () => api.editOrder(editParams));

        // --- Cancel Order Test ---
        await runTest("cancelOrder", () => api.cancelOrder({ order_id: orderId }));
    } else {
        console.log("\nSkipping Edit/Cancel tests because initial order placement failed or was not 'placed'.");
        if (sendOrderResult && sendOrderResult.error) {
             console.log(`Reason: ${sendOrderResult.error}`);
        }
    }

    // --- Batch Order Test ---
    const batchParams = {
        json: JSON.stringify({
            "batchOrder": [
                { "order": "send", "order_tag": "1", "orderType": "lmt", "symbol": "pf_xbtusd", "side": "buy", "size": 1, "limitPrice": 1000.0 },
                { "order": "send", "order_tag": "2", "orderType": "lmt", "symbol": "pf_ethusd", "side": "sell", "size": 1, "limitPrice": 9999.0 }
            ]
        })
    };
    const batchResult = await runTest("batchOrder", () => api.batchOrder(batchParams));

    // --- Cancel All Orders for a Symbol ---
    // This will cancel the orders from the batch test above.
    if (batchResult && batchResult.batchStatus) {
         await runTest("cancelAllOrders (pf_xbtusd)", () => api.cancelAllOrders({ symbol: 'pf_xbtusd' }));
         await runTest("cancelAllOrders (pf_ethusd)", () => api.cancelAllOrders({ symbol: 'pf_ethusd' }));
    }

    // --- Cancel All Orders After (Dead Man's Switch) ---
    // Sets a 60-second timer. If connection is lost, all orders are cancelled.
    // A zero value `{ timeout: 0 }` cancels any existing timer.
    await runTest("cancelAllOrdersAfter (set timer for 60s)", () => api.cancelAllOrdersAfter({ timeout: 60 }));
    await runTest("cancelAllOrdersAfter (check status)", () => api.cancelAllOrdersAfter({})); // Check current timer
    await runTest("cancelAllOrdersAfter (cancel timer)", () => api.cancelAllOrdersAfter({ timeout: 0 }));

    console.log("\n\n✅ All tests completed.");
}

main().catch(err => {
    console.error("An unexpected error occurred during the test run:", err);
});

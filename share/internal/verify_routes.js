const baseUrl = 'http://127.0.0.1:5001/api/merchants';

async function run() {
    try {
        console.log("1. Registering Merchant...");
        const registerRes = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                business: { name: "RouteTester", contactEmail: "tester@example.com" },
                wallet: { address: `0xRouteTest${Date.now()}` }, // Unique
                api: { baseUrl: "http://example.com" },
                limits: { maxRequestsPerMinute: 60 }
            })
        });
if (!registerRes.ok) throw new Error(`Registration failed: ${await registerRes.text()}`);
       
         const { merchantId } = await registerRes.json();
        console.log("Merchant ID:", merchantId);

        console.log("2. Adding Route...");
        const addRes = await fetch(`${baseUrl}/${merchantId}/routes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method: 'GET',
                path: '/test/path',
                price: '0.5',
                currency: 'USDC'
            })
        });
        if (!addRes.ok) throw new Error(`Add Route failed: ${await addRes.text()}`);
        const routes = await addRes.json();
        const routeId = routes[0]._id;
        console.log("Route Added. ID:", routeId);

        console.log("3. Fetching Routes...");
        const getRes = await fetch(`${baseUrl}/${merchantId}/routes`);
        const fetchedRoutes = await getRes.json();
        console.log("Fetched Routes Count:", fetchedRoutes.length);
        if (fetchedRoutes.length !== 1) throw new Error("Expected 1 route");

        console.log("4. Updating Price...");
        const updateRes = await fetch(`${baseUrl}/${merchantId}/routes/${routeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: '1.0' })
        });
        if (!updateRes.ok) throw new Error(`Update Service failed: ${await updateRes.text()}`);
        const updatedRoutes = await updateRes.json();
        if (updatedRoutes[0].price !== '1.0') throw new Error("Price update failed");
        console.log("Price Updated to 1.0");

        console.log("5. Disabling Route...");
        const disableRes = await fetch(`${baseUrl}/${merchantId}/routes/${routeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false })
        });
        const disabledRoutes = await disableRes.json();
        if (disabledRoutes[0].active !== false) throw new Error("Disable failed");
        console.log("Route Disabled (active: false)");

        console.log("6. Deleting Route...");
        const deleteRes = await fetch(`${baseUrl}/${merchantId}/routes/${routeId}`, {
            method: 'DELETE'
        });
        const finalRoutes = await deleteRes.json();
        if (finalRoutes.length !== 0) throw new Error("Delete failed");
        console.log("Route Deleted.");

        console.log("SUCCESS: All tests passed!");

    } catch (e) {
        console.error("ERROR:", e);
    }
}

run();

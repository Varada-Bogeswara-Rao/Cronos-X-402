
import { AgentClient } from "../AgentClient";

/**
 * Cronos AI Tool Adapter
 * -----------------------
 * This file allows your AgentClient to be registered as a standard "Tool"
 * within the Cronos AI SDK or any LangChain-compatible agent framework.
 * 
 * Usage:
 *    const myWallet = new AgentClient({...});
 *    const paymentTool = createPaymentTool(myWallet);
 *    myAgent.registerTool(paymentTool);
 */

export interface PaymentToolSchema {
    name: string;
    description: string;
    parameters: object;
    handler: (args: any) => Promise<any>; // Changed return type to Promise<object>
}

export function createPaymentTool(client: AgentClient): PaymentToolSchema {
    return {
        name: "pay_for_resource", // Renamed tool
        description: "Pays for and fetches premium/monetized API resources using the x402 protocol. Use this tool when you need to access data that requires crypto payment.", // Updated description
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The full URL of the monetized resource to fetch (e.g. https://api.example.com/premium-data)"
                },
                method: {
                    type: "string",
                    enum: ["GET", "POST"],
                    description: "The HTTP method to use (default GET)"
                },
                body: {
                    type: "object",
                    description: "Optional JSON body for POST requests"
                },
                timeoutMs: { // Added timeoutMs parameter
                    type: "number",
                    description: "Optional timeout in milliseconds (default 15000)"
                }
            },
            required: ["url"]
        },
        handler: async (args: any) => {
            try {
                const { url, method, body, timeoutMs } = args; // Destructure timeoutMs
                console.log(`[AI Tool] Paying for resource: ${url}`);

                // Use fetchWithDetails to get payment metadata
                const result = await client.fetchWithDetails(url, { // Changed to fetchWithDetails
                    method: method || "GET",
                    body,
                    timeoutMs // Pass timeoutMs
                });

                // Return structured object (not string)
                return {
                    success: true,
                    data: result.data,
                    payment: result.payment
                };

            } catch (error: any) {
                // Fail loudly
                throw new Error(`PAYMENT_TOOL_FAILED: ${error.message}`); // Throw error instead of returning string
            }
        }
    };
}

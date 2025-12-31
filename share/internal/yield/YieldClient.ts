import axios from "axios";
import { YieldDecision } from "./YieldDecision"; // Shared type local copy

export class YieldClient {
    constructor(private baseUrl: string) { }

    /**
     * Request a decision from the Facilitator.
     * The Agent acts as the client here.
     */
    async fetchDecision(sourceId: string, agentAddress: string): Promise<YieldDecision> {
        try {
            const url = `${this.baseUrl}/api/yield-sources/decision`;
            const response = await axios.get(url, {
                params: { sourceId, agent: agentAddress }
            });
            return response.data as YieldDecision;
        } catch (error: any) {
            console.error(`[YieldClient] Failed to fetch decision: ${error.message}`);
            throw error;
        }
    }
}

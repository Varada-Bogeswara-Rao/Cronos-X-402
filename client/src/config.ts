import { http, createConfig } from 'wagmi'
import { cronosTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
    chains: [cronosTestnet],
    connectors: [
        injected(),
    ],
    transports: {
        [cronosTestnet.id]: http(),
    },
})

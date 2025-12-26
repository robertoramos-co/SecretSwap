import { createConfig, createStorage, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

const memoryStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  storage: createStorage({
    storage: memoryStorage,
  }),
  ssr: false,
});

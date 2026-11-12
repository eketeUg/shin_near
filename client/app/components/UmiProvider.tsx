import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { useWallet } from '@solana/wallet-adapter-react';
import { ReactNode, createContext, useContext, useMemo } from 'react';
import { Umi } from '@metaplex-foundation/umi';

const UmiContext = createContext<Umi | null>(null);

export function UmiProvider({ children }: { children: ReactNode }) {
    const wallet = useWallet();
    
    const umi = useMemo(() => {
        // Use a Devnet RPC for now
        const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        
        const umiInstance = createUmi(rpcEndpoint)
            .use(mplCore());

        // Bind the React Wallet to Umi so we can sign transactions
        if (wallet.publicKey) {
            umiInstance.use(walletAdapterIdentity(wallet));
        }
        
        return umiInstance;
    }, [wallet]);

    return (
        <UmiContext.Provider value={umi}>
            {children}
        </UmiContext.Provider>
    );
}

export function useUmi(): Umi {
    const context = useContext(UmiContext);
    if (!context) {
        throw new Error('useUmi must be used within a UmiProvider');
    }
    return context;
}

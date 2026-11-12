'use client';

import React, { useState, createContext, useContext } from 'react';

interface NetworkContextState {
  network: 'testnet' | 'mainnet';
  setNetwork: (network: 'testnet' | 'mainnet') => void;
}

const NetworkContext = createContext<NetworkContextState>({
  network: 'testnet',
  setNetwork: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

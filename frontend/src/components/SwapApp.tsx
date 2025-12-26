import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, isAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract, formatUnits, parseEther } from 'ethers';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { SEPOLIA_RPC_URL } from '../config/wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { Header } from './Header';
import '../styles/SwapApp.css';

const USDT_DECIMALS = 6n;
const USDT_PER_ETH = 2300n * 10n ** USDT_DECIMALS;
const WEI_PER_ETH = 10n ** 18n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

function quoteUsdtFromWei(ethInWei: bigint): bigint {
  return (ethInWei * USDT_PER_ETH) / WEI_PER_ETH;
}

export function SwapApp() {
  const { address, isConnected, chainId } = useAccount();
  const signerPromise = useEthersSigner({ chainId });
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [ethAmount, setEthAmount] = useState('0.01');
  const [encryptedBalance, setEncryptedBalance] = useState<string>(ZERO_HANDLE);
  const [clearBalance, setClearBalance] = useState<bigint | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isContractConfigured = useMemo(
    () => isAddress(CONTRACT_ADDRESS) && CONTRACT_ADDRESS.toLowerCase() !== ZERO_ADDRESS,
    [],
  );

  const quotedUsdt = useMemo(() => {
    try {
      const wei = parseEther(ethAmount);
      return quoteUsdtFromWei(wei);
    } catch {
      return 0n;
    }
  }, [ethAmount]);

  const refreshBalance = useCallback(async () => {
    if (!isConnected || !address) return;
    if (!isContractConfigured) return;

    try {
      setError(null);
      const encrypted = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'encryptedBalanceOf',
        args: [address],
      });
      setEncryptedBalance(encrypted);
    } catch (e) {
      console.error(e);
      setError('Failed to read encrypted balance');
    }
  }, [address, isConnected, isContractConfigured]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const onSwap = useCallback(async () => {
    if (!isConnected || !address) {
      setError('Connect your wallet first');
      return;
    }
    if (!isContractConfigured) {
      setError('Contract address is not configured');
      return;
    }
    if (!signerPromise) {
      setError('Wallet signer is not available');
      return;
    }

    setIsSwapping(true);
    setError(null);
    setStatus(null);
    setClearBalance(null);

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.swapExactETHForUSDT({ value: parseEther(ethAmount) });
      setStatus(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      setStatus('Swap confirmed');
      await refreshBalance();
    } catch (e) {
      console.error(e);
      setError('Swap failed');
    } finally {
      setIsSwapping(false);
    }
  }, [address, ethAmount, isConnected, isContractConfigured, refreshBalance, signerPromise]);

  const onDecrypt = useCallback(async () => {
    if (!isConnected || !address) {
      setError('Connect your wallet first');
      return;
    }
    if (!isContractConfigured) {
      setError('Contract address is not configured');
      return;
    }
    if (!signerPromise) {
      setError('Wallet signer is not available');
      return;
    }
    if (zamaLoading) {
      setError('Encryption service is still initializing');
      return;
    }
    if (zamaError) {
      setError(zamaError);
      return;
    }
    if (!instance) {
      setError('Encryption service is not available');
      return;
    }

    if (!encryptedBalance || encryptedBalance === ZERO_HANDLE) {
      setClearBalance(0n);
      return;
    }

    setIsDecrypting(true);
    setError(null);
    setStatus(null);

    try {
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: encryptedBalance, contractAddress: CONTRACT_ADDRESS }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace(/^0x/, ''),
        contractAddresses,
        await signer.getAddress(),
        startTimeStamp,
        durationDays,
      );

      const value = result[encryptedBalance];
      const asBigInt = typeof value === 'bigint' ? value : BigInt(value);
      setClearBalance(asBigInt);
    } catch (e) {
      console.error(e);
      setError('Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  }, [
    address,
    encryptedBalance,
    instance,
    isConnected,
    isContractConfigured,
    signerPromise,
    zamaError,
    zamaLoading,
  ]);

  return (
    <div className="swap-app">
      <Header />

      <main className="swap-main">
        <section className="swap-card">
          <h2 className="swap-title">Swap ETH → USDT (encrypted)</h2>
          <p className="swap-subtitle">Fixed rate: 1 ETH = 2300 USDT</p>

          {!isContractConfigured && (
            <div className="swap-alert">
              <strong>Contract address not set.</strong> Update <code>frontend/src/config/contracts.ts</code> with the
              deployed Sepolia address.
            </div>
          )}

          <div className="swap-row">
            <label className="swap-label" htmlFor="ethAmount">
              ETH amount
            </label>
            <input
              id="ethAmount"
              className="swap-input"
              inputMode="decimal"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              placeholder="0.01"
            />
          </div>

          <div className="swap-row">
            <div className="swap-label">Estimated USDT</div>
            <div className="swap-value">{formatUnits(quotedUsdt, 6)} USDT</div>
          </div>

          <button className="swap-button" onClick={onSwap} disabled={!isConnected || isSwapping || !isContractConfigured}>
            {isSwapping ? 'Swapping…' : 'Swap'}
          </button>

          <div className="swap-divider" />

          <h3 className="swap-section-title">Your encrypted balance</h3>
          <div className="swap-row">
            <div className="swap-label">Ciphertext handle</div>
            <div className="swap-mono">{encryptedBalance}</div>
          </div>

          <div className="swap-row">
            <div className="swap-label">Decrypted balance</div>
            <div className="swap-value">{clearBalance === null ? '—' : `${formatUnits(clearBalance, 6)} USDT`}</div>
          </div>

          <div className="swap-actions">
            <button className="swap-secondary" onClick={refreshBalance} disabled={!isConnected || !isContractConfigured}>
              Refresh
            </button>
            <button
              className="swap-secondary"
              onClick={onDecrypt}
              disabled={!isConnected || isDecrypting || !isContractConfigured}
            >
              {isDecrypting ? 'Decrypting…' : 'Decrypt'}
            </button>
          </div>

          {status && <div className="swap-status">{status}</div>}
          {error && <div className="swap-error">{error}</div>}
        </section>
      </main>
    </div>
  );
}

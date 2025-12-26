import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { parseEther } from "ethers";

task("task:secretswap:address", "Prints the SecretSwap address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;
  const deployment = await deployments.get("SecretSwap");
  console.log("SecretSwap address is " + deployment.address);
});

task("task:secretswap:swap", "Swaps ETH for encrypted USDT (SecretSwap)")
  .addOptionalParam("address", "Optionally specify the SecretSwap contract address")
  .addParam("eth", "ETH amount to swap (example: 0.01)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const ethAmount = String(taskArguments.eth);
    const value = parseEther(ethAmount);

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SecretSwap");
    const signers = await ethers.getSigners();
    const swap = await ethers.getContractAt("SecretSwap", deployment.address);

    const tx = await swap.connect(signers[0]).swapExactETHForUSDT({ value });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`SecretSwap swapExactETHForUSDT(${ethAmount} ETH) succeeded!`);
  });

task("task:secretswap:decrypt-balance", "Decrypts encrypted USDT balance for the caller")
  .addOptionalParam("address", "Optionally specify the SecretSwap contract address")
  .addOptionalParam("account", "Optionally specify the account address to read (defaults to signer[0])")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SecretSwap");
    const signers = await ethers.getSigners();
    const account = (taskArguments.account as string | undefined) ?? signers[0].address;

    const swap = await ethers.getContractAt("SecretSwap", deployment.address);
    const encryptedBalance = await swap.encryptedBalanceOf(account);

    if (encryptedBalance === ethers.ZeroHash) {
      console.log(`Encrypted balance: ${encryptedBalance}`);
      console.log("Clear balance    : 0");
      return;
    }

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      deployment.address,
      signers[0],
    );

    console.log(`Account          : ${account}`);
    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : ${clearBalance}`);
  });


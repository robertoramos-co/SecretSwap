import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { SecretSwap, SecretSwap__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecretSwap")) as SecretSwap__factory;
  const contract = (await factory.deploy()) as SecretSwap;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("SecretSwap", function () {
  let signers: Signers;
  let swap: SecretSwap;
  let swapAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
    ({ contract: swap, address: swapAddress } = await deployFixture());
  });

  it("encrypted balance should be uninitialized after deployment", async function () {
    const encrypted = await swap.encryptedBalanceOf(signers.alice.address);
    expect(encrypted).to.eq(ethers.ZeroHash);
  });

  it("swap 1 ETH should mint 2300 USDT (6 decimals)", async function () {
    const tx = await swap.connect(signers.alice).swapExactETHForUSDT({ value: ethers.parseEther("1.0") });
    await tx.wait();

    const encrypted = await swap.encryptedBalanceOf(signers.alice.address);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, encrypted, swapAddress, signers.alice);

    expect(clear).to.eq(2_300_000_000n);
  });

  it("multiple swaps should add up", async function () {
    let tx = await swap.connect(signers.alice).swapExactETHForUSDT({ value: ethers.parseEther("1.0") });
    await tx.wait();

    tx = await swap.connect(signers.alice).swapExactETHForUSDT({ value: ethers.parseEther("0.5") });
    await tx.wait();

    const encrypted = await swap.encryptedBalanceOf(signers.alice.address);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, encrypted, swapAddress, signers.alice);

    expect(clear).to.eq(3_450_000_000n);
  });
});


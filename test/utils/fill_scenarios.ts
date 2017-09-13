import * as BigNumber from 'bignumber.js';
import {ZeroEx, Token, SignedOrder} from '../../src';
import {orderFactory} from '../utils/order_factory';
import {constants} from './constants';

export class FillScenarios {
    private zeroEx: ZeroEx;
    private userAddresses: string[];
    private tokens: Token[];
    private coinbase: string;
    private zrxTokenAddress: string;
    private exchangeContractAddress: string;
    constructor(zeroEx: ZeroEx, userAddresses: string[],
                tokens: Token[], zrxTokenAddress: string, exchangeContractAddress: string) {
        this.zeroEx = zeroEx;
        this.userAddresses = userAddresses;
        this.tokens = tokens;
        this.coinbase = userAddresses[0];
        this.zrxTokenAddress = zrxTokenAddress;
        this.exchangeContractAddress = exchangeContractAddress;
    }
    public async createFillableSignedOrderAsync(makerTokenAddress: string, takerTokenAddress: string,
                                                makerAddress: string, takerAddress: string,
                                                fillableAmount: BigNumber.BigNumber,
                                                expirationUnixTimestampSec?: BigNumber.BigNumber):
                                           Promise<SignedOrder> {
        return this.createAsymmetricFillableSignedOrderAsync(
            makerTokenAddress, takerTokenAddress, makerAddress, takerAddress,
            fillableAmount, fillableAmount, expirationUnixTimestampSec,
        );
    }
    public async createFillableSignedOrderWithFeesAsync(
        makerTokenAddress: string, takerTokenAddress: string,
        makerFee: BigNumber.BigNumber, takerFee: BigNumber.BigNumber,
        makerAddress: string, takerAddress: string,
        fillableAmount: BigNumber.BigNumber,
        feeRecepient: string, expirationUnixTimestampSec?: BigNumber.BigNumber,
    ): Promise<SignedOrder> {
        return this.createAsymmetricFillableSignedOrderWithFeesAsync(
            makerTokenAddress, takerTokenAddress, makerFee, takerFee, makerAddress, takerAddress,
            fillableAmount, fillableAmount, feeRecepient, expirationUnixTimestampSec,
        );
    }
    public async createAsymmetricFillableSignedOrderAsync(
        makerTokenAddress: string, takerTokenAddress: string, makerAddress: string, takerAddress: string,
        makerFillableAmount: BigNumber.BigNumber, takerFillableAmount: BigNumber.BigNumber,
        expirationUnixTimestampSec?: BigNumber.BigNumber): Promise<SignedOrder> {
        const makerFee = new BigNumber(0);
        const takerFee = new BigNumber(0);
        const feeRecepient = constants.NULL_ADDRESS;
        return this.createAsymmetricFillableSignedOrderWithFeesAsync(
            makerTokenAddress, takerTokenAddress, makerFee, takerFee, makerAddress, takerAddress,
            makerFillableAmount, takerFillableAmount, feeRecepient, expirationUnixTimestampSec,
        );
    }
    public async createPartiallyFilledSignedOrderAsync(makerTokenAddress: string, takerTokenAddress: string,
                                                       takerAddress: string, fillableAmount: BigNumber.BigNumber,
                                                       partialFillAmount: BigNumber.BigNumber) {
        const [makerAddress] = this.userAddresses;
        const signedOrder = await this.createAsymmetricFillableSignedOrderAsync(
            makerTokenAddress, takerTokenAddress, makerAddress, takerAddress,
            fillableAmount, fillableAmount,
        );
        const shouldThrowOnInsufficientBalanceOrAllowance = false;
        await this.zeroEx.exchange.fillOrderAsync(signedOrder, partialFillAmount, shouldThrowOnInsufficientBalanceOrAllowance, takerAddress);
        return signedOrder;
    }
    private async createAsymmetricFillableSignedOrderWithFeesAsync(
        makerTokenAddress: string, takerTokenAddress: string,
        makerFee: BigNumber.BigNumber, takerFee: BigNumber.BigNumber,
        makerAddress: string, takerAddress: string,
        makerFillableAmount: BigNumber.BigNumber, takerFillableAmount: BigNumber.BigNumber,
        feeRecepient: string, expirationUnixTimestampSec?: BigNumber.BigNumber): Promise<SignedOrder> {

        await Promise.all([
            this.increaseBalanceAndAllowanceAsync(makerTokenAddress, makerAddress, makerFillableAmount),
            this.increaseBalanceAndAllowanceAsync(takerTokenAddress, takerAddress, takerFillableAmount),
        ]);
        await Promise.all([
            this.increaseWETHBalanceAndAllowanceAsync(this.zrxTokenAddress, makerAddress, makerFee),
            this.increaseWETHBalanceAndAllowanceAsync(this.zrxTokenAddress, takerAddress, takerFee),
        ]);

        const signedOrder = await orderFactory.createSignedOrderAsync(this.zeroEx,
            makerAddress, takerAddress, makerFee, takerFee,
            makerFillableAmount, makerTokenAddress, takerFillableAmount, takerTokenAddress,
            this.exchangeContractAddress, feeRecepient, expirationUnixTimestampSec);
        return signedOrder;
    }

    private async increaseWETHBalanceAndAllowanceAsync(
        tokenAddress: string, address: string, amount: BigNumber.BigNumber): Promise<void> {
        if (amount.isZero()) {
            return; // noop
        }
        const depositWeiAmount = (this.zeroEx as any)._web3Wrapper.toWei(amount);

        const txHash = await this.zeroEx.etherToken.depositAsync(depositWeiAmount, address);
        await this.zeroEx.awaitTransactionMinedAsync(txHash);
        await this.increaseAllowanceAsync(tokenAddress, address, amount);

        const postETHBalanceInWei = await (this.zeroEx as any)._web3Wrapper.getBalanceInWeiAsync(address);
        const postWETHBalanceInBaseUnits = await this.zeroEx.token.getBalanceAsync(tokenAddress, address);
    }

    private async increaseBalanceAndAllowanceAsync(
        tokenAddress: string, address: string, amount: BigNumber.BigNumber): Promise<void> {
        if (amount.isZero()) {
            return; // noop
        }
        await Promise.all([
            this.increaseBalanceAsync(tokenAddress, address, amount),
            this.increaseAllowanceAsync(tokenAddress, address, amount),
        ]);
    }
    private async increaseBalanceAsync(
        tokenAddress: string, address: string, amount: BigNumber.BigNumber): Promise<void> {
        await this.zeroEx.token.transferAsync(tokenAddress, this.coinbase, address, amount);
    }
    private async increaseAllowanceAsync(
        tokenAddress: string, address: string, amount: BigNumber.BigNumber): Promise<void> {
        const oldMakerAllowance = await this.zeroEx.token.getProxyAllowanceAsync(tokenAddress, address);
        const newMakerAllowance = oldMakerAllowance.plus(amount);
        await this.zeroEx.token.setProxyAllowanceAsync(
            tokenAddress, address, newMakerAllowance,
        );
    }
}

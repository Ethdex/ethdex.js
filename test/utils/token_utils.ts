import * as _ from 'lodash';
import {Token, ZeroExError} from '../../src';

const PROTOCOL_TOKEN_SYMBOL = 'WETH';

export class TokenUtils {
    private tokens: Token[];
    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }
    public getProtocolTokenOrThrow(): Token {
        const zrxToken = _.find(this.tokens, {symbol: PROTOCOL_TOKEN_SYMBOL});
        if (_.isUndefined(zrxToken)) {
            throw new Error(ZeroExError.ZrxNotInTokenRegistry);
        }
        return zrxToken;
    }
    public getNonProtocolTokens(): Token[] {
        const nonProtocolTokens = _.filter(this.tokens, token => {
            return token.symbol !== PROTOCOL_TOKEN_SYMBOL;
        });
        return nonProtocolTokens;
    }
}

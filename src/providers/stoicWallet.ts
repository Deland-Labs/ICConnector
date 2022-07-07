import { WalletConnectError, WalletConnectErrorCode } from '../exception';
import { principalToAccountID } from '../helper';
import { IWalletConnector, WalletAuth, WalletType } from '..';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { StoicIdentity } from './ic-stoic-identity';
declare const window: any;
export class StoicWalletConnector implements IWalletConnector {
  public type = WalletType.StoicWallet;
  public connected: boolean = false;

  private icHost: string;
  private whiteList: Array<string> = [];
  private providerUrl: string;
  private dev: boolean;
  private identity?: Identity = undefined;
  constructor(
    icHost: string,
    whitelist: string[] = [],
    dev: boolean = false,
    providerUrl: string = 'https://www.stoicwallet.com'
  ) {
    this.icHost = icHost;
    this.whiteList = whitelist;
    this.dev = dev;
    this.providerUrl = providerUrl;
  }

  connect = async (): Promise<WalletAuth> => {
    const stoicConn = await StoicIdentity.load();
    try {
      if (stoicConn === false) {
        this.identity = await StoicIdentity.connect();
      } else {
        this.identity = stoicConn;
      }

      if (!this.identity) {
        throw new WalletConnectError(
          WalletConnectErrorCode.StoicWalletConnectFailed,
          `StoicWalletConnector.connect: connect failed`
        );
      }
      console.debug('StoicWalletConnector.connect: connected');
      this.connected = true;
      const principalId = this.identity.getPrincipal();
      const accountId = principalToAccountID(principalId);
      sessionStorage.setItem('walletType', 'Stoic');
      return {
        type: WalletType.StoicWallet,
        principal: principalId.toText(),
        accountId
      };
    } catch (error) {
      throw new WalletConnectError(
        WalletConnectErrorCode.StoicWalletConnectFailed,
        `StoicWalletConnector.connect: connect failed ${error}`
      );
    }
  };

  createActor = async <T>(
    canisterId: string,
    idlFactory: IDL.InterfaceFactory
  ) => {
    const agent = new HttpAgent({
      host: this.icHost,
      identity: this.identity
    });

    // Fetch root key for certificate validation during development
    if (this.dev) {
      agent.fetchRootKey().catch(err => {
        console.error(
          'Unable to fetch root key. Check to ensure that your local replica is running',
          err
        );
      });
    }

    return Actor.createActor<T>(idlFactory, {
      agent,
      canisterId
    });
  };

  disconnect = async () => {
    StoicIdentity.disconnect();
  };
}
